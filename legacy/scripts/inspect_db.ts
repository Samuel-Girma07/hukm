import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function inspect() {
  // Get sample chunks from anti-corruption document
  const { data, error } = await supabase
    .from("law_chunks")
    .select("id, article_reference, content, document_name")
    .eq("document_name", "anti-corruption-881-2015")
    .ilike("article_reference", "%Article 10%")
    .limit(5);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("=== Article 10 Chunks ===");
  console.log(`Found ${data?.length || 0} chunks`);
  
  data?.forEach((chunk, i) => {
    console.log(`\n--- Chunk ${i + 1} ---`);
    console.log(`Article: ${chunk.article_reference}`);
    console.log(`Content length: ${chunk.content.length} chars`);
    console.log(`Content preview: ${chunk.content.substring(0, 200)}...`);
  });

  // Get total counts per document
  const { data: counts } = await supabase
    .rpc("get_document_counts");
  
  console.log("\n=== Document Counts ===");
  
  // Alternative: manual count
  const { data: docs } = await supabase
    .from("law_chunks")
    .select("document_name");
  
  const docCounts: Record<string, number> = {};
  docs?.forEach(d => {
    docCounts[d.document_name] = (docCounts[d.document_name] || 0) + 1;
  });
  
  Object.entries(docCounts).forEach(([doc, count]) => {
    console.log(`${doc}: ${count} chunks`);
  });
}

inspect().catch(console.error);
