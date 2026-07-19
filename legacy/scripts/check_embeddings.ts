import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check a few embeddings
  const { data, error } = await supabase
    .from("law_chunks")
    .select("id, article_reference, embedding")
    .limit(10);

  if (error) {
    console.error(error);
    return;
  }

  console.log("=== Embedding Dimensions Check ===");
  data?.forEach((c: { id: number; article_reference: string; embedding: number[] }) => {
    const len = c.embedding?.length || 0;
    const status = len === 1024 ? "OK" : `WRONG (${len})`;
    console.log(`ID ${c.id}: ${c.article_reference} - ${status}`);
  });

  // Count how many have wrong dimensions
  const { data: all } = await supabase
    .from("law_chunks")
    .select("id, embedding");

  if (all) {
    const correct = all.filter(
      (c: { id: number; embedding: number[] }) => c.embedding?.length === 1024
    ).length;
    const wrong = all.length - correct;
    console.log(`\n=== Summary ===`);
    console.log(`Total chunks: ${all.length}`);
    console.log(`Correct (1024): ${correct}`);
    console.log(`Wrong: ${wrong}`);
  }
}

check().catch(console.error);
