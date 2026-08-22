/**
 * Test stub for the `server-only` package.
 *
 * The real package throws on import outside a React Server Component
 * environment. Lib modules guarded by `server-only` are safe to exercise
 * in plain Node unit tests, so vitest aliases this stub over it
 * (see vitest.config.ts).
 */
export {};
