#!/usr/bin/env python3
"""
HUKM — ETHIOPIAN SENTENCING ASSISTANT
PDF / HTML Ingestion Script for Vector Database

This script reads legal source files (PDF or HTML — some "legal-docs/*.pdf"
files are actually HTML downloads with a .pdf extension), extracts text,
chunks by article boundaries, applies a quality gate, embeds via NVIDIA's
embedding endpoint, and stores in Supabase pgvector.

INSTALLATION:
    pip install pymupdf supabase python-dotenv requests beautifulsoup4

USAGE:
    python scripts/ingest.py                                    # all docs
    python scripts/ingest.py --only criminal-code-414-2004      # one doc by stem
    python scripts/ingest.py --only criminal-code-414-2004 --dry-run

REQUIREMENTS:
    - .env or .env.local in project root with:
      - NVIDIA_API_KEY
      - NEXT_PUBLIC_SUPABASE_URL
      - SUPABASE_SERVICE_ROLE_KEY
    - Source files in legal-docs/ directory

Quality gate:
    - Chunks shorter than MIN_CHUNK_LENGTH are dropped.
    - Chunks where >25% of characters are "junk" (non-ASCII outside the
      Ethiopic Unicode block) are dropped — those are almost always
      OCR garbage from the PDF text-extractor.
    - Chunks that look like OCR-spray (lots of 1–2 char tokens stitched
      together) are dropped.
"""

import argparse
import os
import re
import sys
import time
from pathlib import Path
from typing import List, Optional, Tuple
from dotenv import load_dotenv
import fitz  # PyMuPDF
import requests
from supabase import create_client, Client

# Optional dependency: BeautifulSoup for HTML extraction. We import lazily
# so a Python env without bs4 installed can still ingest pure PDFs.
try:
    from bs4 import BeautifulSoup  # type: ignore
    HTML_OK = True
except ImportError:
    HTML_OK = False

# ============================================================================
# CONFIGURATION
# ============================================================================

# Embedding configuration
# Using nvidia/nv-embedqa-e5-v5 which returns 1024-dimensional vectors
# Compatible with ivfflat index (max 2000 dims)
EMBEDDING_MODEL_ID = "nvidia/nv-embedqa-e5-v5"
EMBEDDING_ENDPOINT = "https://integrate.api.nvidia.com/v1/embeddings"
EMBEDDING_DIMENSIONS = 1024  # This model returns 1024-dimensional vectors
EMBEDDING_INPUT_TYPE_PASSAGE = "passage"

# Chunking configuration
MAX_CHUNK_LENGTH = 400  # Reduced to fit within 512 token limit
MIN_CHUNK_LENGTH = 80   # Drop tiny fragments — they were a major source of OCR garbage in v1.
CHUNK_OVERLAP = 50

# Quality gate
MAX_JUNK_RATIO = 0.25
MIN_AMHARIC_LENGTH = 200  # Long Amharic passages get a free pass on junk-ratio

# Rate limiting
API_DELAY = 0.5  # Seconds between API calls

# Directories
PROJECT_ROOT = Path(__file__).parent.parent
LEGAL_DOCS_DIR = PROJECT_ROOT / "legal-docs"
ENV_FILE = PROJECT_ROOT / ".env"
ENV_LOCAL_FILE = PROJECT_ROOT / ".env.local"

# ============================================================================
# ENVIRONMENT SETUP
# ============================================================================

def load_environment():
    """Load environment variables from .env or .env.local"""
    loaded = False
    if ENV_LOCAL_FILE.exists():
        load_dotenv(ENV_LOCAL_FILE)
        print(f"Loaded environment from {ENV_LOCAL_FILE}")
        loaded = True
    if ENV_FILE.exists():
        load_dotenv(ENV_FILE, override=False)
        print(f"Loaded environment from {ENV_FILE}")
        loaded = True
    if not loaded:
        print("Warning: no .env or .env.local found. Using system environment variables.")

    required_vars = ["NVIDIA_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    missing = [var for var in required_vars if not os.getenv(var)]

    if missing:
        print(f"Error: Missing required environment variables: {', '.join(missing)}")
        print("Please ensure your .env or .env.local contains all required variables.")
        sys.exit(1)

def get_supabase_client() -> Client:
    """Create and return Supabase client"""
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(supabase_url, supabase_key)

# ============================================================================
# FILE-TYPE DETECTION + HTML EXTRACTION
# ============================================================================

def detect_kind(path: Path) -> str:
    """Return 'pdf', 'html', or 'unknown' based on the file's first bytes."""
    try:
        with path.open("rb") as f:
            head = f.read(2048)
    except OSError:
        return "unknown"
    if head.startswith(b"%PDF"):
        return "pdf"
    head_lower = head.lstrip().lower()
    if head_lower.startswith(b"<!doctype html") or head_lower.startswith(b"<html") or b"<head" in head_lower:
        return "html"
    return "unknown"


def extract_text_from_html(path: Path) -> str:
    """Extract readable plain text from an HTML file."""
    if not HTML_OK:
        print(
            "  Warning: this file is HTML but BeautifulSoup is not installed. "
            "Run `pip install beautifulsoup4` and retry."
        )
        return ""
    print(f"  Extracting text from HTML {path.name}...")
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        print(f"  Error reading HTML: {e}")
        return ""
    soup = BeautifulSoup(raw, "html.parser")
    # Strip script/style blocks; they would otherwise pollute the text.
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    # Collapse whitespace runs.
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    print(f"  Extracted {len(text):,} characters of HTML text")
    return text


# ============================================================================
# QUALITY GATE
# ============================================================================

def junk_ratio(text: str) -> float:
    if not text:
        return 1.0
    junk = 0
    for ch in text:
        cp = ord(ch)
        # ASCII printable + tab/newline/CR
        if 0x20 <= cp <= 0x7E:
            continue
        if cp in (0x09, 0x0A, 0x0D):
            continue
        # Ethiopic blocks
        if 0x1200 <= cp <= 0x137F:
            continue
        if 0x1380 <= cp <= 0x139F:
            continue
        if 0x2D80 <= cp <= 0x2DDF:
            continue
        junk += 1
    return junk / len(text)


def amharic_length(text: str) -> int:
    return sum(1 for ch in text if 0x1200 <= ord(ch) <= 0x137F)


def looks_like_ocr_spray(text: str) -> bool:
    tokens = [t for t in text.split() if t]
    if len(tokens) < 12:
        return False
    short_garbled = sum(
        1
        for t in tokens
        if len(t) <= 3 and re.search(r"[^A-Za-z0-9\u1200-\u137F]", t)
    )
    return short_garbled / len(tokens) > 0.5


def is_garbage_chunk(content: str) -> Tuple[bool, str]:
    """Return (True, reason) if the chunk should be dropped before insertion."""
    if len(content) < MIN_CHUNK_LENGTH:
        return True, f"too-short({len(content)})"
    ratio = junk_ratio(content)
    amh = amharic_length(content)
    if ratio > MAX_JUNK_RATIO and amh < MIN_AMHARIC_LENGTH:
        return True, f"junk-ratio({ratio*100:.1f}%)"
    if looks_like_ocr_spray(content):
        return True, "ocr-spray"
    return False, ""


# ============================================================================
# PDF TEXT EXTRACTION
# ============================================================================

def extract_text_from_pdf(pdf_path: Path) -> str:
    """
    Extract text from a PDF file using PyMuPDF

    Args:
        pdf_path: Path to the PDF file

    Returns:
        Extracted text as string
    """
    print(f"  Extracting text from {pdf_path.name}...")

    doc = None
    try:
        # Check if file exists and is readable
        if not pdf_path.exists():
            print(f"  Error: File not found: {pdf_path}")
            return ""
        
        # Check file size
        file_size = pdf_path.stat().st_size
        if file_size == 0:
            print(f"  Error: File is empty (0 bytes): {pdf_path.name}")
            return ""
        
        print(f"  File size: {file_size / 1024 / 1024:.2f} MB")
        
        # Open document
        doc = fitz.open(pdf_path)
        
        # Check if document is valid
        page_count = doc.page_count
        if page_count == 0:
            print(f"  Error: PDF has no pages: {pdf_path.name}")
            doc.close()
            return ""
        
        print(f"  Pages: {page_count}")
        
        # Check if PDF is encrypted
        if doc.is_encrypted:
            print(f"  Warning: PDF is encrypted: {pdf_path.name}. Attempting to open...")
            # Try to open with no password (sometimes works for permission-only encryption)
            if not doc.authenticate(""):
                print(f"  Error: PDF requires password: {pdf_path.name}")
                doc.close()
                return ""
        
        text_pages = []
        empty_pages = 0
        
        for page_num in range(page_count):
            page = doc[page_num]
            text = page.get_text("text")
            
            # Check if page has text
            if not text or text.strip() == "":
                empty_pages += 1
            else:
                text_pages.append(text)
        
        doc.close()
        doc = None
        
        full_text = "\n".join(text_pages)
        
        if empty_pages == page_count:
            print(f"  Warning: All pages are image-based (no extractable text): {pdf_path.name}")
            print(f"  This PDF may need OCR processing.")
            return ""
        
        if empty_pages > 0:
            print(f"  Note: {empty_pages}/{page_count} pages had no text (image-based)")
        
        print(f"  Extracted {len(full_text):,} characters from {len(text_pages)} pages with text")
        return full_text
        
    except Exception as e:
        error_type = type(e).__name__
        if 'Password' in error_type:
            print(f"  Error: PDF is password-protected: {pdf_path.name} - {e}")
        elif 'FileData' in error_type or 'EmptyFile' in error_type:
            print(f"  Error: PDF is corrupted or invalid: {pdf_path.name} - {e}")
        else:
            print(f"  Error extracting text from {pdf_path.name}: {error_type} - {e}")
        
        # Ensure document is closed on error
        if doc is not None:
            try:
                doc.close()
            except:
                pass
        
        return ""

def clean_text(text: str) -> str:
    """
    Clean extracted text: remove excessive whitespace, normalize line breaks
    
    Args:
        text: Raw extracted text
        
    Returns:
        Cleaned text
    """
    # Remove excessive whitespace
    text = re.sub(r'[ \t]+', ' ', text)
    
    # Normalize line breaks (remove multiple consecutive newlines)
    text = re.sub(r'\n\s*\n', '\n\n', text)
    
    # Remove page headers/footers that repeat (common patterns)
    # This is a simple heuristic - may need adjustment for specific PDFs
    text = re.sub(r'\n\d+\n', '\n', text)  # Remove standalone page numbers
    
    # Strip leading/trailing whitespace
    text = text.strip()
    
    return text

# ============================================================================
# TEXT CHUNKING
# ============================================================================

def split_into_articles(text: str, document_name: str) -> List[Tuple[str, str]]:
    """
    Split text into chunks using article boundaries
    
    Args:
        text: Cleaned text
        document_name: Name of the document for logging
        
    Returns:
        List of (article_reference, chunk_text) tuples
    """
    # Primary split pattern: "Article" followed by number
    # Ethiopian legal documents typically use "Article" or "Art." 
    article_pattern = r'(Article\s+\d+[^.\n]*\.|Art\.\s+\d+[^.\n]*\.)'
    
    # Find all article markers
    articles = re.split(article_pattern, text, flags=re.IGNORECASE)
    
    chunks = []
    
    # articles list will be: [before_first, article_1, content_1, article_2, content_2, ...]
    # We need to pair them up
    
    if len(articles) <= 1:
        # No articles found, treat entire text as one chunk
        if len(text.strip()) > MIN_CHUNK_LENGTH:
            chunks.append(("General Provisions", text.strip()))
        return chunks
    
    # Process articles
    i = 0
    while i < len(articles):
        if re.match(article_pattern, articles[i].strip(), re.IGNORECASE):
            # This is an article marker
            article_ref = articles[i].strip()
            # Next element should be content (or end of list)
            content = articles[i + 1].strip() if i + 1 < len(articles) else ""
            
            # Combine article ref with content
            full_chunk = f"{article_ref}\n{content}".strip()
            
            if len(full_chunk) >= MIN_CHUNK_LENGTH:
                chunks.append((article_ref, full_chunk))
            elif chunks:
                # Merge with previous chunk if too short
                prev_ref, prev_content = chunks[-1]
                chunks[-1] = (prev_ref, f"{prev_content}\n\n{full_chunk}")
            
            i += 2
        else:
            # This is content before first article
            if len(articles[i].strip()) > MIN_CHUNK_LENGTH:
                chunks.append(("Preamble", articles[i].strip()))
            i += 1
    
    return chunks

def split_long_chunk(chunk: str, article_ref: str) -> List[Tuple[str, str]]:
    """
    Split a chunk that's too long at paragraph or sentence boundaries

    Args:
        chunk: The chunk to split
        article_ref: Article reference

    Returns:
        List of (article_reference, chunk_text) tuples
    """
    if len(chunk) <= MAX_CHUNK_LENGTH:
        return [(article_ref, chunk)]

    # Split at paragraph boundaries
    paragraphs = re.split(r'\n\n+', chunk)
    sub_chunks = []
    current_chunk = ""
    chunk_index = 1

    for para in paragraphs:
        # If paragraph itself is too long, split at sentence level
        if len(para) > MAX_CHUNK_LENGTH:
            # First, save any current chunk
            if current_chunk:
                sub_chunks.append((f"{article_ref} (Part {chunk_index})", current_chunk.strip()))
                chunk_index += 1
                current_chunk = ""
            
            # Split paragraph into sentences
            sentences = re.split(r'(?<=[.!?])\s+', para)
            para_chunk = ""
            
            for sentence in sentences:
                if len(para_chunk) + len(sentence) + 50 <= MAX_CHUNK_LENGTH:
                    para_chunk += " " + sentence if para_chunk else sentence
                else:
                    if para_chunk:
                        sub_chunks.append((f"{article_ref} (Part {chunk_index})", para_chunk.strip()))
                        chunk_index += 1
                    para_chunk = sentence
            
            if para_chunk:
                sub_chunks.append((f"{article_ref} (Part {chunk_index})", para_chunk.strip()))
                chunk_index += 1
        elif len(current_chunk) + len(para) + 2 <= MAX_CHUNK_LENGTH:
            current_chunk += f"\n\n{para}" if current_chunk else para
        else:
            if current_chunk:
                sub_chunks.append((f"{article_ref} (Part {chunk_index})", current_chunk.strip()))
                chunk_index += 1
            current_chunk = para
    
    if current_chunk:
        sub_chunks.append((f"{article_ref} (Part {chunk_index})", current_chunk.strip()))
    
    return sub_chunks if sub_chunks else [(article_ref, chunk)]

# ============================================================================
# EMBEDDING
# ============================================================================

def embed_text(text: str) -> Optional[List[float]]:
    """
    Embed text using NVIDIA Embeddings API
    
    Args:
        text: Text to embed
        
    Returns:
        Embedding vector as list of floats, or None if failed
    """
    api_key = os.getenv("NVIDIA_API_KEY")
    
    try:
        response = requests.post(
            EMBEDDING_ENDPOINT,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json={
                "input": [text],
                "model": EMBEDDING_MODEL_ID,
                "input_type": EMBEDDING_INPUT_TYPE_PASSAGE,
            },
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"    API error: {response.status_code} - {response.text[:200]}")
            return None
        
        data = response.json()
        
        if not data.get("data") or len(data["data"]) == 0:
            print("    API returned no embeddings")
            return None
        
        embedding = data["data"][0].get("embedding")
        
        if not embedding or len(embedding) != EMBEDDING_DIMENSIONS:
            print(f"    Invalid embedding dimensions: {len(embedding) if embedding else 'None'}")
            return None
        
        return embedding
        
    except requests.exceptions.Timeout:
        print("    API timeout")
        return None
    except Exception as e:
        print(f"    Embedding error: {e}")
        return None

# ============================================================================
# SUPABASE INSERTION
# ============================================================================

def parse_proclamation_number(document_name: str) -> Optional[str]:
    """
    Extract proclamation number from document name
    
    Args:
        document_name: Filename without extension
        
    Returns:
        Proclamation number string or None
    """
    # Pattern: xxx-YYY-ZZZZ where YYY is the proclamation number
    match = re.search(r'-(\d+)-', document_name)
    if match:
        return f"{match.group(1)}/{document_name.split('-')[-1]}"
    return None

def insert_chunk(
    supabase: Client,
    document_name: str,
    article_reference: str,
    content: str,
    embedding: List[float]
) -> bool:
    """
    Insert a chunk into Supabase law_chunks table
    
    Args:
        supabase: Supabase client
        document_name: Name of the document
        article_reference: Article reference
        content: Chunk text
        embedding: Embedding vector
        
    Returns:
        True if successful, False otherwise
    """
    try:
        metadata = {
            "source": f"{document_name}.pdf",
            "proclamationNumber": parse_proclamation_number(document_name),
        }
        
        data = {
            "document_name": document_name,
            "article_reference": article_reference,
            "content": content,
            "metadata": metadata,
            "embedding": embedding,
        }
        
        result = supabase.table("law_chunks").insert(data).execute()
        
        if result.data:
            return True
        else:
            print(f"    Insert failed: {result}")
            return False
            
    except Exception as e:
        print(f"    Insert error: {e}")
        return False

# ============================================================================
# MAIN INGESTION PIPELINE
# ============================================================================

def ingest_document(
    supabase: Optional[Client],
    pdf_path: Path,
    dry_run: bool = False,
) -> Tuple[int, int, int]:
    """
    Ingest a single source document (PDF or HTML).

    Args:
        supabase: Supabase client, or None when `dry_run=True`.
        pdf_path: Path to source file (the .pdf extension is misleading for
                  some entries — we sniff the file's actual type).
        dry_run:  When True, run the full extract+chunk+gate pipeline but
                  skip embedding + insertion.

    Returns:
        Tuple of (successful_chunks, error_count, dropped_garbage)
    """
    document_name = pdf_path.stem  # Filename without extension
    print(f"\nProcessing: {document_name}")

    kind = detect_kind(pdf_path)
    print(f"  Detected file kind: {kind}")
    if kind == "pdf":
        raw_text = extract_text_from_pdf(pdf_path)
    elif kind == "html":
        raw_text = extract_text_from_html(pdf_path)
    else:
        print(f"  Error: unsupported file kind for {pdf_path.name}")
        return 0, 1, 0

    if not raw_text:
        return 0, 1, 0

    # Clean text
    cleaned_text = clean_text(raw_text)

    # Split into articles
    articles = split_into_articles(cleaned_text, document_name)
    print(f"  Found {len(articles)} article(s)")

    successful = 0
    errors = 0
    dropped = 0

    for article_ref, chunk_text in articles:
        # Split long chunks
        sub_chunks = split_long_chunk(chunk_text, article_ref)

        for sub_ref, sub_text in sub_chunks:
            # Quality gate: skip OCR-garbled or tiny fragments before
            # spending an embedding API call on them.
            is_garbage, reason = is_garbage_chunk(sub_text)
            if is_garbage:
                dropped += 1
                if dropped <= 5:
                    print(f"  [drop] {sub_ref[:50]}: {reason}")
                continue

            if dry_run:
                successful += 1
                if successful <= 3:
                    print(f"  [dry-run keep] {sub_ref[:50]} ({len(sub_text)} chars)")
                continue

            # Embed
            print(f"  Embedding: {sub_ref[:50]}...")
            embedding = embed_text(sub_text)

            if not embedding:
                errors += 1
                continue

            # Insert into Supabase
            time.sleep(API_DELAY)  # Rate limiting

            if supabase is not None and insert_chunk(
                supabase, document_name, sub_ref, sub_text, embedding
            ):
                successful += 1
            else:
                errors += 1

    return successful, errors, dropped

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="HUKM legal-doc ingestion")
    parser.add_argument(
        "--only",
        action="append",
        default=[],
        help=(
            "Stem (filename without extension) of a single document to ingest. "
            "Can be passed multiple times. Default: all *.pdf in legal-docs/."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Extract + chunk + apply quality gate, but skip embedding/insert.",
    )
    return parser.parse_args()


def main():
    """Main ingestion pipeline"""
    args = parse_args()

    print("=" * 70)
    print("HUKM — Legal-doc Ingestion Script" + (" (DRY-RUN)" if args.dry_run else ""))
    print("=" * 70)

    # Load environment
    load_environment()

    # Check legal-docs directory
    if not LEGAL_DOCS_DIR.exists():
        print(f"Error: {LEGAL_DOCS_DIR} directory not found")
        sys.exit(1)

    # Find files to ingest. We iterate over *.pdf even though some entries
    # are actually HTML; detect_kind() does the routing per file.
    all_files = sorted(LEGAL_DOCS_DIR.glob("*.pdf"))

    if args.only:
        wanted = set(args.only)
        files = [p for p in all_files if p.stem in wanted]
        missing = wanted - {p.stem for p in files}
        if missing:
            print(f"Error: --only specified unknown stem(s): {', '.join(sorted(missing))}")
            print(f"Available: {', '.join(p.stem for p in all_files)}")
            sys.exit(1)
    else:
        files = all_files

    if not files:
        print(f"No source files found in {LEGAL_DOCS_DIR}")
        print("Please download the legal documents and place them in this directory.")
        print("See legal-docs/README.md for instructions.")
        sys.exit(0)

    print(f"Will process {len(files)} file(s)")
    for f in files:
        print(f"  - {f.name}")

    supabase = None
    if not args.dry_run:
        supabase = get_supabase_client()
        print("Connected to Supabase")

    total_successful = 0
    total_errors = 0
    total_dropped = 0
    start_time = time.time()

    for path in files:
        successful, errors, dropped = ingest_document(supabase, path, dry_run=args.dry_run)
        total_successful += successful
        total_errors += errors
        total_dropped += dropped

    elapsed_time = time.time() - start_time

    print("\n" + "=" * 70)
    print("INGESTION COMPLETE" + (" (DRY-RUN)" if args.dry_run else ""))
    print("=" * 70)
    print(f"Total chunks {'kept' if args.dry_run else 'ingested'}: {total_successful}")
    print(f"Total dropped (quality gate): {total_dropped}")
    print(f"Total errors: {total_errors}")
    print(f"Total time: {elapsed_time:.2f} seconds ({elapsed_time/60:.2f} minutes)")
    print("=" * 70)


if __name__ == "__main__":
    main()
