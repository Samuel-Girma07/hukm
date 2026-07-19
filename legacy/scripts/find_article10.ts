import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Get all chunks that have actual readable Article 10 content
  const { data, error } = await supabase
    .from("law_chunks")
    .select("id, article_reference, content")
    .eq("document_name", "anti-corruption-881-2015")
    .ilike("content", "%solicits%")
    .limit(5);

  if (error) {
    console.error(error);
    return;
  }

  console.log('Chunks containing "solicits":');
  data?.forEach((c, i) => {
    console.log(`\n--- Chunk ${i + 1} ---`);
    console.log(`ID: ${c.id}`);
    console.log(`Article: ${c.article_reference}`);
    console.log(`Content:`);
    console.log(c.content);
  });
}

check().catch(console.error);
