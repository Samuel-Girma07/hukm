import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  // Get sample chunks from anti-corruption document for Article 10
  const { data, error } = await supabase
    .from("law_chunks")
    .select("id, article_reference, content, document_name")
    .eq("document_name", "anti-corruption-881-2015")
    .ilike("article_reference", "%Article 10%")
    .limit(10);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("=== Article 10 Chunks ===");
  console.log(`Found ${data?.length || 0} chunks\n`);
  
  data?.forEach((chunk, i) => {
    console.log(`--- Chunk ${i + 1} ---`);
    console.log(`Article Ref: ${chunk.article_reference}`);
    console.log(`Content Length: ${chunk.content.length} chars`);
    console.log(`Content Preview: ${chunk.content.substring(0, 300)}...`);
    console.log("");
  });

  // Get total counts per document
  const { data: allDocs } = await supabase
    .from("law_chunks")
    .select("document_name");
  
  const docCounts: Record<string, number> = {};
  allDocs?.forEach(d => {
    docCounts[d.document_name] = (docCounts[d.document_name] || 0) + 1;
  });
  
  console.log("=== Document Counts ===");
  Object.entries(docCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([doc, count]) => {
      console.log(`${doc}: ${count} chunks`);
    });
  
  // Check chunk size distribution
  const { data: sampleChunks } = await supabase
    .from("law_chunks")
    .select("content")
    .limit(100);
  
  if (sampleChunks) {
    const lengths = sampleChunks.map(c => c.content.length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const max = Math.max(...lengths);
    const min = Math.min(...lengths);
    console.log(`\n=== Chunk Size Stats (sample of 100) ===`);
    console.log(`Average: ${Math.round(avg)} chars`);
    console.log(`Min: ${min} chars`);
    console.log(`Max: ${max} chars`);
  }
}

inspect().catch(console.error);
