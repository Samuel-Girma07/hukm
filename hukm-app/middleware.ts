import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";

/**
 * Middleware: UX routing + sliding session renewal.
 *
 * Zero network calls — the only crypto is local HS256 verification via
 * `jose` (CPU-only, sub-millisecond), preserving the original design
 * goal that middleware can never time out on Supabase/network calls.
 *
 * Responsibilities:
 *   1. /admin/*      → pass through (separate hukm-admin-auth model; the
 *                      dashboard page client-gates and every /api/admin/*
 *                      route enforces server-side).
 *   2. /share/*      → public by design (token IS the credential).
 *   3. Auth routes   → logged-in users are bounced home.
 *   4. Protected     → no cookie / invalid / expired token redirects to
 *                      /onboarding?next=<original>, so login returns the
 *                      user to where they were.
 *   5. Sliding       → a valid token with < RENEW_THRESHOLD left is
 *                      transparently re-issued for 24h so active users
 *                      never hit a hard mid-session expiry.
 */

const COOKIE_NAME = "hukm_token";
const TOKEN_TTL_SECONDS = 60 * 60 * 24; // 24h
/** Renew when less than half the token's life remains. */
const RENEW_THRESHOLD_MS = 12 * 60 * 60 * 1000;

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? "";
  return new TextEncoder().encode(secret);
}

interface VerifiedSession {
  sub: string;
  email: string;
}

async function verifySession(
  token: string,
): Promise<{ payload: VerifiedSession; expiresAtMs: number } | null> {
  if (!process.env.JWT_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const exp = typeof payload.exp === "number" ? payload.exp : 0;
    if (!payload.sub || typeof payload.email !== "string" || exp === 0) {
      return null;
    }
    return { payload: { sub: payload.sub, email: payload.email }, expiresAtMs: exp * 1000 };
  } catch {
    return null;
  }
}

async function mintToken(session: VerifiedSession): Promise<string> {
  return new SignJWT({ email: session.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.sub)
    .setIssuedAt()
    // jose treats a NUMERIC expiration as an absolute unix timestamp;
    // pass a relative-duration STRING so this is "now + 24h".
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  // Admin routes use their own auth model — skip entirely.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.next();
  }

  // Public share links: the token in the URL is the credential.
  if (pathname.startsWith("/share")) {
    return NextResponse.next();
  }

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/onboarding");

  const token = request.cookies.get(COOKIE_NAME)?.value;

  // ── No cookie at all ────────────────────────────────────────────────
  if (!token) {
    if (isAuthRoute) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Preserve destination so login can bring the user back.
    redirect.cookies.set("hukm_next", `${pathname}${search}`, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
      secure: process.env.NODE_ENV === "production",
    });
    return redirect;
  }

  // ── Cookie present: verify ──────────────────────────────────────────
  const verified = await verifySession(token);
  if (!verified) {
    // Stale/garbage cookie behaves like no cookie (previously it silently
    // passed middleware and exploded deeper in the stack).
    if (isAuthRoute) {
      const res = NextResponse.next();
      res.cookies.delete(COOKIE_NAME);
      return res;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    redirect.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
    redirect.cookies.set("hukm_next", `${pathname}${search}`, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
      secure: process.env.NODE_ENV === "production",
    });
    return redirect;
  }

  // ── Valid session: slide expiry when past the renewal threshold ─────
  const remainingMs = verified.expiresAtMs - Date.now();
  let response: NextResponse;
  if (isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    response = NextResponse.redirect(url);
    response.cookies.delete("hukm_next");
  } else {
    response = NextResponse.next();
  }
  if (remainingMs < RENEW_THRESHOLD_MS) {
    try {
      const fresh = await mintToken(verified.payload);
      response.cookies.set(COOKIE_NAME, fresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: TOKEN_TTL_SECONDS,
      });
    } catch {
      // Renewal is best-effort; the still-valid token keeps working.
    }
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - _next/static, _next/image  (Next.js internals)
     *   - favicon.ico
     *   - /api/*                     (API routes handle their own auth)
     *   - common static asset extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|api/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)',
  ],
};
