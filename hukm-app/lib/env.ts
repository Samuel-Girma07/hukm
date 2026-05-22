/**
 * HUKM â€” Environment Validation
 *
 * Validates all required environment variables at module load.
 * Throws a clear error naming the missing variable so deployments
 * fail fast instead of silently misbehaving.
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

function readVar(name: RequiredVar): string {
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

function validateAll(): void {
  const missing: string[] = [];
  for (const name of REQUIRED_VARS) {
    const value = process.env[name];
    if (typeof value !== "string" || value.trim() === "") {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `[hukm/env] Missing required environment variables: ${missing.join(", ")}. ` +
        `Add them to .env.local (development) or your deployment provider's ` +
        `environment configuration.`,
    );
  }
}

// Eagerly validate on first import so the app fails at startup, not on
// the first request.
validateAll();

export const env = {
  NVIDIA_API_KEY: readVar("NVIDIA_API_KEY"),
  SUPABASE_URL: readVar("NEXT_PUBLIC_SUPABASE_URL"),
  SUPABASE_ANON_KEY: readVar("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: readVar("SUPABASE_SERVICE_ROLE_KEY"),
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

