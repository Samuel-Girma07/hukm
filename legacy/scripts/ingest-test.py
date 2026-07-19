#!/usr/bin/env python3
"""
HUKM — Quick Test Ingestion Script

Ingests ONLY the constitution-1995.pdf (smallest file) to verify the pipeline works.
Should complete in 5-10 minutes.

USAGE:
    python scripts/ingest-test.py
"""

import os
import sys
import re
import time
from pathlib import Path
from dotenv import load_dotenv
import fitz  # PyMuPDF
from supabase import create_client, Client
import requests

# ============================================================================
# CONFIGURATION
# ============================================================================

EMBEDDING_MODEL_ID = "nvidia/nv-embedqa-e5-v5"
EMBEDDING_ENDPOINT = "https://integrate.api.nvidia.com/v1/embeddings"
EMBEDDING_DIMENSIONS = 1024
EMBEDDING_INPUT_TYPE_PASSAGE = "passage"
API_DELAY = 0.5

PROJECT_ROOT = Path(__file__).parent.parent
LEGAL_DOCS_DIR = PROJECT_ROOT / "legal-docs"
ENV_FILE = PROJECT_ROOT / ".env"

# Test with the smallest PDF
TEST_PDF_NAME = "constitution-1995.pdf"

# ============================================================================
# ENVIRONMENT
# ============================================================================

def load_environment():
    if ENV_FILE.exists():
        load_dotenv(ENV_FILE)
        print(f"Loaded environment from {ENV_FILE}")
    else:
        print(f"Warning: {ENV_FILE} not found.")
    
    required_vars = ["NVIDIA_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    missing = [var for var in required_vars if not os.getenv(var)]
    
    if missing:
        print(f"Error: Missing environment variables: {', '.join(missing)}")
        sys.exit(1)

def get_supabase_client() -> Client:
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(supabase_url, supabase_key)

# ============================================================================
# PDF EXTRACTION
# ============================================================================

def extract_text_from_pdf(pdf_path: Path) -> str:
    print(f"  Extracting text from {pdf_path.name}...")
    
    doc = None
    try:
        file_size = pdf_path.stat().st_size
        print(f"  File size: {file_size / 1024 / 1024:.2f} MB")
        
        doc = fitz.open(pdf_path)
        page_count = doc.page_count
        
        if page_count == 0:
            print(f"  Error: PDF has no pages")
            return ""
        
        print(f"  Pages: {page_count}")
        
        if doc.is_encrypted:
            print(f"  Warning: PDF is encrypted")
            if not doc.authenticate(""):
                print(f"  Error: PDF requires password")
                doc.close()
                return ""
        
        text_pages = []
        empty_pages = 0
        
        for page_num in range(page_count):
            page = doc[page_num]
            text = page.get_text("text")
            
            if not text or text.strip() == "":
                empty_pages += 1
            else:
                text_pages.append(text)
        
        doc.close()
        doc = None
        
        full_text = "\n".join(text_pages)
        
        if empty_pages == page_count:
            print(f"  Warning: All pages are image-based (no extractable text)")
            return ""
        
        print(f"  Extracted {len(full_text):,} characters from {len(text_pages)} pages")
        return full_text
        
    except Exception as e:
        print(f"  Error: {type(e).__name__} - {e}")
        if doc is not None:
            try:
                doc.close()
            except:
                pass
        return ""

# ============================================================================
# CHUNKING
# ============================================================================

def split_into_chunks(text: str, max_chunk_size: int = 400) -> list:
    """Split text into smaller chunks that fit within token limits"""
    
    # First split by Article boundaries
    article_pattern = r'(Article\s+\d+[^.\n]*\.|Art\.\s+\d+[^.\n]*\.|\bPART\s+\w+)'
    sections = re.split(article_pattern, text, flags=re.IGNORECASE)
    
    chunks = []
    i = 0
    while i < len(sections):
        section = sections[i].strip()
        
        if not section:
            i += 1
            continue
            
        # If this looks like an article/part header, combine with next section
        if re.match(article_pattern, section, re.IGNORECASE):
            header = section
            content = sections[i + 1].strip() if i + 1 < len(sections) else ""
            full_text = f"{header}\n{content}".strip()
            
            # Split long content into smaller chunks
            if len(full_text) > max_chunk_size:
                # Split by paragraphs
                paragraphs = re.split(r'\n\n+', full_text)
                current_chunk = ""
                chunk_num = 1
                
                for para in paragraphs:
                    if len(current_chunk) + len(para) + 50 <= max_chunk_size:
                        current_chunk += f"\n\n{para}" if current_chunk else para
                    else:
                        if current_chunk:
                            chunks.append((f"{header} (Part {chunk_num})", current_chunk.strip()))
                            chunk_num += 1
                        current_chunk = para
                
                if current_chunk:
                    chunks.append((f"{header} (Part {chunk_num})", current_chunk.strip()))
            else:
                chunks.append((header, full_text))
            
            i += 2
        else:
            # Regular text section - split into smaller chunks
            if len(section) > max_chunk_size:
                # Split by sentences
                sentences = re.split(r'(?<=[.!?])\s+', section)
                current_chunk = ""
                chunk_num = 1
                
                for sentence in sentences:
                    if len(current_chunk) + len(sentence) + 50 <= max_chunk_size:
                        current_chunk += " " + sentence if current_chunk else sentence
                    else:
                        if current_chunk:
                            chunks.append((f"Section {chunk_num}", current_chunk.strip()))
                            chunk_num += 1
                        current_chunk = sentence
                
                if current_chunk:
                    chunks.append((f"Section {chunk_num}", current_chunk.strip()))
            elif len(section) > 50:
                chunks.append(("Section", section))
            
            i += 1
    
    return chunks

# ============================================================================
# EMBEDDING
# ============================================================================

def embed_text(text: str) -> list:
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
            error_text = response.text[:200]
            print(f"    API error: {response.status_code} - {error_text}")
            return None
        
        data = response.json()
        
        if not data.get("data") or len(data["data"]) == 0:
            return None
        
        embedding = data["data"][0].get("embedding")
        
        if not embedding or len(embedding) != EMBEDDING_DIMENSIONS:
            print(f"    Invalid dimensions: {len(embedding) if embedding else 'None'}")
            return None
        
        return embedding
        
    except Exception as e:
        print(f"    Embedding error: {e}")
        return None

# ============================================================================
# INSERTION
# ============================================================================

def insert_chunk(supabase: Client, document_name: str, article_ref: str, content: str, embedding: list) -> bool:
    try:
        data = {
            "document_name": document_name,
            "article_reference": article_ref,
            "content": content,
            "metadata": {"source": f"{document_name}.pdf"},
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
# MAIN
# ============================================================================

def main():
    print("=" * 70)
    print("HUKM — Quick Test Ingestion")
    print("=" * 70)
    print(f"\nTesting with: {TEST_PDF_NAME}")
    print("This should take 5-10 minutes.\n")
    
    load_environment()
    
    pdf_path = LEGAL_DOCS_DIR / TEST_PDF_NAME
    
    if not pdf_path.exists():
        print(f"Error: {TEST_PDF_NAME} not found in legal-docs/")
        print("Please ensure the file exists.")
        sys.exit(1)
    
    supabase = get_supabase_client()
    print("Connected to Supabase\n")
    
    # Extract text
    raw_text = extract_text_from_pdf(pdf_path)
    if not raw_text:
        print("\nFailed to extract text. Aborting.")
        sys.exit(1)
    
    # Split into chunks
    print("\nSplitting into chunks...")
    chunks = split_into_chunks(raw_text, max_chunk_size=400)
    print(f"Found {len(chunks)} chunk(s)\n")
    
    # Embed and insert
    document_name = pdf_path.stem
    successful = 0
    errors = 0
    start_time = time.time()
    
    for article_ref, chunk_text in chunks:
        print(f"Embedding: {article_ref[:50]}... ({len(chunk_text)} chars)")
        embedding = embed_text(chunk_text)
        
        if not embedding:
            errors += 1
            continue
        
        time.sleep(API_DELAY)
        
        if insert_chunk(supabase, document_name, article_ref, chunk_text, embedding):
            successful += 1
            print(f"  ✓ Inserted")
        else:
            errors += 1
    
    elapsed_time = time.time() - start_time
    
    print("\n" + "=" * 70)
    print("TEST COMPLETE")
    print("=" * 70)
    print(f"Total chunks ingested: {successful}")
    print(f"Total errors: {errors}")
    print(f"Total time: {elapsed_time:.2f} seconds ({elapsed_time/60:.2f} minutes)")
    print("=" * 70)
    
    if successful > 0:
        print("\n✅ SUCCESS! The pipeline is working.")
        print("\nNow test the app:")
        print("1. Go to http://localhost:3000")
        print("2. Submit a scenario about constitutional rights")
        print("3. You should see Constitution articles retrieved!")
    else:
        print("\n❌ FAILED. Check errors above.")
    
    print("=" * 70)

if __name__ == "__main__":
    main()
