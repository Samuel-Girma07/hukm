import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testSimilarity() {
  // The actual Article 10 chunk
  const article10Content = `Article 10 (I). (2) or (3) of this Proclamation. 21 Whenever anyone of the persons mentioned under sub·article (I) solicits or accepts an advantage or gift. before or after perfonning an act entrusted to him, he shall, according to the circumstances of the case, be punishable with one of the penalties prescribed under Article II (1) or (2) of this Proclamation.`;

  // Test query
  const query =
    "What does Article 10 of the Anti-Corruption Proclamation 881/2015 say about officials accepting gifts or advantages?";

  console.log("=== Testing Similarity ===");
  console.log("Query:", query);
  console.log("");
  console.log("Article 10 Content:");
  console.log(article10Content);
  console.log("");

  // Get embeddings for both
  const [queryEmbedRes, contentEmbedRes] = await Promise.all([
    fetch("https://integrate.api.nvidia.com/v1/embeddings", {
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
    }),
    fetch("https://integrate.api.nvidia.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.NVIDIA_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: [article10Content],
        model: "nvidia/nv-embedqa-e5-v5",
        input_type: "passage",
      }),
    }),
  ]);

  const queryData = await queryEmbedRes.json();
  const contentData = await contentEmbedRes.json();

  const queryEmbed = queryData.data[0].embedding;
  const contentEmbed = contentData.data[0].embedding;

  // Calculate cosine similarity
  let dotProduct = 0;
  let queryNorm = 0;
  let contentNorm = 0;

  for (let i = 0; i < queryEmbed.length; i++) {
    dotProduct += queryEmbed[i] * contentEmbed[i];
    queryNorm += queryEmbed[i] * queryEmbed[i];
    contentNorm += contentEmbed[i] * contentEmbed[i];
  }

  const similarity = dotProduct / (Math.sqrt(queryNorm) * Math.sqrt(contentNorm));

  console.log("=== Similarity Calculation ===");
  console.log(`Query embedding dimensions: ${queryEmbed.length}`);
  console.log(`Content embedding dimensions: ${contentEmbed.length}`);
  console.log(`Cosine similarity: ${(similarity * 100).toFixed(2)}%`);
  console.log("");

  // Now let's test with a more direct query
  const directQuery = "Article 10 solicits or accepts an advantage or gift";
  const directEmbedRes = await fetch(
    "https://integrate.api.nvidia.com/v1/embeddings",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.NVIDIA_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: [directQuery],
        model: "nvidia/nv-embedqa-e5-v5",
        input_type: "query",
      }),
    }
  );

  const directData = await directEmbedRes.json();
  const directEmbed = directData.data[0].embedding;

  let directDot = 0;
  let directNorm = 0;
  for (let i = 0; i < directEmbed.length; i++) {
    directDot += directEmbed[i] * contentEmbed[i];
    directNorm += directEmbed[i] * directEmbed[i];
  }

  const directSimilarity =
    directDot / (Math.sqrt(directNorm) * Math.sqrt(contentNorm));

  console.log("=== Direct Query Test ===");
  console.log(`Query: "${directQuery}"`);
  console.log(`Similarity: ${(directSimilarity * 100).toFixed(2)}%`);
}

testSimilarity().catch(console.error);
