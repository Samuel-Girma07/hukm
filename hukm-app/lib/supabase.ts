/**
 * HUKM — Supabase clients.
 *
 * `getServerClient()` uses the service role key and is the ONLY client that
 * touches the database. The browser never reads from Supabase directly —
 * all data flows through `/api/*` routes — so we don't ship an anon-key
 * client at all. That keeps the attack surface small and prevents any
 * accidental import of the service-role key into the bundle.
 */

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "./env";

let cached: SupabaseClient | null = null;

export function getServerClient(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    db: { schema: "public" },
  });
  return cached;
}
