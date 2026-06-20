import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// IMPORTANT: Do NOT read `env` here. lib/env.ts validates SUPABASE_SERVICE_ROLE_KEY
// and NVIDIA_API_KEY at import time. Middleware runs on the Edge runtime on every
// single request — if those keys are missing in any Vercel environment, the import
// would throw and you'd get 500s (or, combined with a slow getUser(), a 504).
// Middleware only needs the public anon key + URL, both safe to read from process.env.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // IMPORTANT: use getSession() here, NOT getUser().
  // getUser() makes a network call to Supabase Auth on every request and is the
  // #1 cause of Vercel MIDDLEWARE_INVOCATION_TIMEOUT / 504 errors.
  // getSession() just reads + verifies the JWT from the cookie — no network.
  // Do the authoritative getUser() check inside your protected Server Components
  // / Route Handlers instead.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const user = session?.user ?? null

  const isAuthRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup') ||
    request.nextUrl.pathname.startsWith('/onboarding')

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages to the main app
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
