import * as bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { env } from './env';

const SALT_ROUNDS = 12;
const TOKEN_EXPIRES_IN = '24h';
const COOKIE_NAME = 'hukm_token';

// A generic session payload
export interface SessionPayload {
  sub: string; // user id
  email: string;
}

/**
 * Hashes a plaintext password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plaintext password with a hash.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Signs a JWT with the user's information.
 */
export async function signToken(payload: SessionPayload): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRES_IN)
    .sign(secret);
}

/**
 * Verifies a JWT and extracts the payload.
 */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch (error) {
    // Token is invalid or expired
    return null;
  }
}

/**
 * Helper to set the HTTP-only cookie with the JWT token.
 */
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours in seconds
  });
}

/**
 * Helper to delete the HTTP-only cookie.
 */
export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Helper to read and verify the HTTP-only cookie.
 */
export async function getSessionPayload(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}
