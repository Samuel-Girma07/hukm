import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RetrievedChunk {
  document_name: string;
  article_reference: string;
  content: string;
  similarity: number;
}

interface ArticleChunk {
  article_reference: string;
  content: string;
}

async function test() {
  const query =
    "What does Article 10 of the Anti-Corruption Proclamation 881/2015 say about officials accepting gifts or advantages?";

  console.log("Query:", query);
  console.log("");

  // Get embedding
  const embedRes = await fetch(
    "https://integrate.api.nvidia.com/v1/embeddings",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.NVIDIA_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: [query],
        model: "nvidia/nv-embedqa-e5-v5",
        input_type: "query",
      }),
    }
  );

  const embedData = await embedRes.json();
  const embedding = embedData.data[0].embedding;

  // Call match_law_chunks
  const { data, error } = await supabase.rpc("match_law_chunks", {
    query_embedding: embedding,
    match_threshold: 0.3,
    match_count: 8,
  });

  if (error) {
    console.error(error);
    return;
  }

  console.log("=== Top 8 Retrieved Chunks ===");
  (data as RetrievedChunk[]).forEach((chunk, i) => {
    console.log(
      `\n--- Chunk ${i + 1} (similarity: ${(chunk.similarity * 100).toFixed(1)}%) ---`
    );
    console.log(`Document: ${chunk.document_name}`);
    console.log(`Article: ${chunk.article_reference}`);
    console.log(`Content preview: ${chunk.content.substring(0, 200)}...`);
  });

  // Also check what Article 10 chunks exist in the database
  console.log("\n\n=== All Article 10 Chunks in Database ===");
  const { data: article10Chunks } = await supabase
    .from("law_chunks")
    .select("id, article_reference, content, document_name")
    .ilike("article_reference", "%Article 10%")
    .eq("document_name", "anti-corruption-881-2015")
    .limit(20);

  (article10Chunks as ArticleChunk[] | null)?.forEach((chunk, i) => {
    console.log(`\n--- DB Chunk ${i + 1} ---`);
    console.log(`Article: ${chunk.article_reference}`);
    console.log(`Length: ${chunk.content.length} chars`);
    console.log(`Preview: ${chunk.content.substring(0, 150)}...`);
  });
}

test().catch(console.error);
