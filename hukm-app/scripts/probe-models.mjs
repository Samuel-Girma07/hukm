/**
 * Probe the Google Gemini Flash roster for the models we register.
 * For each candidate id, fire a tiny chat completion and report:
 *   ✓ ok (returned text)        → the model works
 *   ✗ HTTP <code>               → reason returned by upstream
 * The script is deliberately conservative (max_tokens=24) so it costs
 * almost nothing per run.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const KEY = process.env.GOOGLE_API_KEY;
if (!KEY) throw new Error("Missing GOOGLE_API_KEY");

const ENDPOINT =
  process.env.GOOGLE_CHAT_URL ||
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
];

async function probe(id) {
  const start = Date.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: id,
        messages: [{ role: "user", content: "Reply with one word: ok" }],
        max_tokens: 24,
        temperature: 0,
        stream: false,
      }),
    });
    const ms = Date.now() - start;
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { id, ok: false, status: res.status, ms, error: txt.slice(0, 140) };
    }
    const json = await res.json();
    const reply = json?.choices?.[0]?.message?.content?.trim() ?? "";
    return { id, ok: true, status: 200, ms, reply: reply.slice(0, 80) };
  } catch (err) {
    return { id, ok: false, ms: Date.now() - start, error: String(err) };
  }
}

const results = await Promise.all(CANDIDATES.map(probe));

const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
console.log(pad("model", 50), pad("status", 8), pad("ms", 6), "reply / error");
console.log("-".repeat(110));
for (const r of results) {
  if (r.ok) {
    console.log(pad(r.id, 50), pad("✓ 200", 8), pad(String(r.ms), 6), r.reply);
  } else {
    console.log(
      pad(r.id, 50),
      pad("✗ " + (r.status ?? "?"), 8),
      pad(String(r.ms), 6),
      (r.error ?? "").slice(0, 80),
    );
  }
}
