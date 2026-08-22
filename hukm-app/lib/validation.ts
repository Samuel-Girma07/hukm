/**
 * HUKM — Auth input validation helpers.
 *
 * Pure functions shared by the login/signup server actions. Kept free of
 * Next.js imports so they can be unit-tested directly.
 *
 * Why 72 bytes: bcrypt silently truncates input beyond 72 bytes, meaning a
 * 200-character password and its first 72 bytes would BOTH authenticate.
 * We reject over-long passwords up front instead of silently truncating.
 */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** bcrypt's hard input limit. */
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_MIN_CHARS = 6;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

export function utf8ByteLength(input: string): number {
  return new TextEncoder().encode(input).length;
}

/**
 * Returns a human-readable reason when `password` violates policy,
 * or null when acceptable.
 */
export function passwordPolicyError(password: string): string | null {
  if (password.length < PASSWORD_MIN_CHARS) {
    return `Password must be at least ${PASSWORD_MIN_CHARS} characters long.`;
  }
  if (utf8ByteLength(password) > PASSWORD_MAX_BYTES) {
    return `Password must be no longer than ${PASSWORD_MAX_BYTES} characters.`;
  }
  return null;
}

/**
 * Validates a post-auth redirect target. Only same-origin relative paths
 * are allowed ("//evil.com" and absolute URLs are rejected).
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  return next;
}
