import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function compareEmbeddings() {
  // Get the stored embedding for Article 10 chunk ID 71
  const { data, error } = await supabase
    .from("law_chunks")
    .select("id, content, embedding")
    .eq("id", 71)
    .single();

  if (error) {
    console.error("Error fetching chunk:", error);
    return;
  }

  console.log("=== Article 10 Chunk (ID 71) ===");
  console.log("Content:", data.content);
  console.log("Embedding dimensions:", data.embedding.length);
  console.log("First 10 values:", data.embedding.slice(0, 10));
  console.log("");

  // Get fresh embedding for same content
  const embedRes = await fetch(
    "https://integrate.api.nvidia.com/v1/embeddings",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.NVIDIA_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: [data.content],
        model: "nvidia/nv-embedqa-e5-v5",
        input_type: "passage",
      }),
    }
  );

  const embedData = await embedRes.json();
  const freshEmbed = embedData.data[0].embedding;

  console.log("=== Fresh Embedding ===");
  console.log("Dimensions:", freshEmbed.length);
  console.log("First 10 values:", freshEmbed.slice(0, 10));
  console.log("");

  // Compare stored vs fresh
  let dotProduct = 0;
  let storedNorm = 0;
  let freshNorm = 0;

  for (let i = 0; i < data.embedding.length; i++) {
    dotProduct += data.embedding[i] * freshEmbed[i];
    storedNorm += data.embedding[i] * data.embedding[i];
    freshNorm += freshEmbed[i] * freshEmbed[i];
  }

  const similarity =
    dotProduct / (Math.sqrt(storedNorm) * Math.sqrt(freshNorm));

  console.log("=== Comparison ===");
  console.log(
    `Similarity between stored and fresh embedding: ${(similarity * 100).toFixed(2)}%`
  );
  console.log("");

  if (similarity < 0.99) {
    console.log(
      "WARNING: Stored embedding differs significantly from fresh embedding!"
    );
    console.log("This suggests re-embedding is needed.");
  } else {
    console.log("Embeddings match closely.");
  }

  // Now test query against stored embedding
  const query =
    "What does Article 10 of the Anti-Corruption Proclamation 881/2015 say about officials accepting gifts or advantages?";
  const queryEmbedRes = await fetch(
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

  const queryData = await queryEmbedRes.json();
  const queryEmbed = queryData.data[0].embedding;

  // Compare query to stored embedding
  let queryDot = 0;
  let queryNorm = 0;
  for (let i = 0; i < queryEmbed.length; i++) {
    queryDot += queryEmbed[i] * data.embedding[i];
    queryNorm += queryEmbed[i] * queryEmbed[i];
  }

  const querySimilarity =
    queryDot / (Math.sqrt(queryNorm) * Math.sqrt(storedNorm));

  console.log("");
  console.log("=== Query vs Stored Embedding ===");
  console.log(`Similarity: ${(querySimilarity * 100).toFixed(2)}%`);
}

compareEmbeddings().catch(console.error);
