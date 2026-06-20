import { NextResponse, type NextRequest } from 'next/server'

/**
 * Bulletproof middleware — zero network calls, zero Supabase client init.
 *
 * Why this exists:
 *   The previous version used `supabase.auth.getSession()` via `@supabase/ssr`'s
 *   `createServerClient`. Even though `getSession()` itself doesn't make a
 *   network call, the Supabase client initialization on Vercel Edge cold
 *   starts can add enough latency (combined with any token auto-refresh
 *   background work) to exceed Vercel's middleware timeout and return
 *   `504 MIDDLEWARE_INVOCATION_TIMEOUT`.
 *
 * What this version does:
 *   Just checks whether a Supabase auth cookie exists. If yes, the request
 *   passes through. If no (and the route isn't an auth route), redirect to
 *   /onboarding. That's it — synchronous, sub-millisecond, cannot time out.
 *
 * What about session validity?
 *   The middleware is NOT the place to validate the session — it's only for
 *   UX routing (redirect unauth'd users to /onboarding). Authoritative auth
 *   checks happen inside Server Components and Route Handlers via
 *   `supabase.auth.getUser()` (which DOES make a network call, but runs on
 *   Node.js runtime where timeouts are far more generous than Edge).
 *
 * Cookie name format:
 *   `@supabase/ssr` stores the session in cookies named:
 *     - `sb-<project-ref>-auth-token`             (small sessions)
 *     - `sb-<project-ref>-auth-token.0`, `.1`, …   (chunked for large sessions)
 *   So we look for any cookie whose name matches `sb-*-auth-token*`.
 */

const AUTH_COOKIE_PATTERN = /^sb-.+-auth-token(\..*)?$/

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/onboarding')

  // Synchronous O(n) scan of request cookies — n is typically < 10.
  const cookies = request.cookies.getAll()
  const hasAuthCookie = cookies.some((c) => AUTH_COOKIE_PATTERN.test(c.name))

  // Unauthenticated user hitting a protected route → send to onboarding.
  if (!hasAuthCookie && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Authenticated user hitting an auth route → send to home.
  if (hasAuthCookie && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
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
}
