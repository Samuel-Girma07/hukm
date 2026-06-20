/**
 * HUKM — Environment Validation
 *
 * Provides typed access to environment variables. Missing required vars
 * are NOT eagerly validated at module load (the previous behavior
 * crashed the entire app on any missing var, producing 500s on every
 * request with a stack trace). Instead, individual accesses via `env`
 * return the value or throw with a clear message naming the missing var.
 *
 * Use `getMissingRequiredVars()` to surface missing vars for diagnostics
 * (e.g. in a health-check endpoint or admin dashboard) without crashing.
 *
 * IMPORTANT: SUPABASE_SERVICE_ROLE_KEY must NEVER be referenced in
 * client-side code. Importing this module from a client component
 * will cause a build-time error because the file is server-only.
 */

import "server-only";

type RequiredVar =
  | "NVIDIA_API_KEY"
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY";

const REQUIRED_VARS: ReadonlyArray<RequiredVar> = [
  "NVIDIA_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

/**
 * Reads a required env var. Throws a clear error naming the variable
 * if it's missing — but only when actually accessed, not at module load.
 * This means a missing var only affects the route that needs it, not
 * every route that transitively imports lib/env.
 */
function readRequired(name: RequiredVar): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `[hukm/env] Missing required environment variable: ${name}. ` +
        `Add it to .env.local (development) or your deployment provider's ` +
        `environment configuration.`,
    );
  }
  return value;
}

/**
 * Returns the names of any required env vars that are missing.
 * Use this in health-check / admin endpoints to surface config issues
 * without crashing the app.
 */
export function getMissingRequiredVars(): string[] {
  const missing: string[] = [];
  for (const name of REQUIRED_VARS) {
    const value = process.env[name];
    if (typeof value !== "string" || value.trim() === "") {
      missing.push(name);
    }
  }
  return missing;
}

/**
 * Returns true if all required env vars are configured.
 */
export function isEnvConfigured(): boolean {
  return getMissingRequiredVars().length === 0;
}

export const env = {
  /**
   * Required vars — accessors throw on missing. Wrap in a function
   * so the throw only happens when actually read, not at module load.
   * Use env.NVIDIA_API_KEY etc. as before — the getter is transparent.
   */
  get NVIDIA_API_KEY(): string {
    return readRequired("NVIDIA_API_KEY");
  },
  get SUPABASE_URL(): string {
    return readRequired("NEXT_PUBLIC_SUPABASE_URL");
  },
  get SUPABASE_ANON_KEY(): string {
    return readRequired("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get SUPABASE_SERVICE_ROLE_KEY(): string {
    return readRequired("SUPABASE_SERVICE_ROLE_KEY");
  },
  REDIS_URL: process.env.REDIS_URL ?? null,
  SENTRY_DSN: process.env.SENTRY_DSN ?? null,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? null,
  PINO_LOG_LEVEL: process.env.PINO_LOG_LEVEL ?? "info",
  APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? null,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  STRONG_SIMILARITY_THRESHOLD: process.env.STRONG_SIMILARITY_THRESHOLD ?? null,
  MODERATE_SIMILARITY_THRESHOLD: process.env.MODERATE_SIMILARITY_THRESHOLD ?? null,
  HIGH_CONFIDENCE_STRONG_COUNT: process.env.HIGH_CONFIDENCE_STRONG_COUNT ?? null,
  MEDIUM_CONFIDENCE_STRONG_COUNT: process.env.MEDIUM_CONFIDENCE_STRONG_COUNT ?? null,
} as const;
