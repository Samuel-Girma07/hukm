'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Login a user with email + password.
 *
 * On success: redirect to "/".
 * On error:   redirect to "/login?error=<message>".
 *
 * Note: `redirect()` throws internally (Next.js uses exceptions for control
 * flow), so any code after a `redirect()` call is unreachable. We do NOT
 * need to (and cannot) return anything.
 */
export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect('/login?error=' + encodeURIComponent('Email and password are required.'))
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  // Force layout to re-render so Server Components pick up the new session.
  revalidatePath('/', 'layout')
  redirect('/')
}

/**
 * Sign up a new user, then immediately sign them in.
 *
 * Supabase behavior:
 *   - If "Confirm email" is DISABLED in your Supabase project: signUp()
 *     returns a session and signInWithPassword() is redundant but harmless.
 *   - If "Confirm email" is ENABLED: signUp() returns a user but no session.
 *     The subsequent signInWithPassword() establishes the session only if
 *     Supabase allows login without email confirmation (it does by default,
 *     even when signup requires confirmation). If your project requires
 *     email confirmation before login, this will fail and the user will
 *     see an error message telling them to confirm their email.
 *
 * On success: redirect to "/".
 * On error:   redirect to "/signup?error=<message>".
 */
export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect('/signup?error=' + encodeURIComponent('Email and password are required.'))
  }

  if (password.length < 6) {
    redirect(
      '/signup?error=' +
        encodeURIComponent('Password must be at least 6 characters long.'),
    )
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (signUpError) {
    redirect('/signup?error=' + encodeURIComponent(signUpError.message))
  }

  // If signUp already established a session (email confirmation disabled),
  // we're done — skip the redundant sign-in.
  if (signUpData.session) {
    revalidatePath('/', 'layout')
    redirect('/')
  }

  // Otherwise, try to sign in immediately. This works when Supabase allows
  // login without prior email confirmation (the default).
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError) {
    // Most likely cause: email confirmation is required and the user hasn't
    // clicked the link yet. Give them a clear, actionable message.
    redirect(
      '/login?error=' +
        encodeURIComponent(
          'Account created. Please check your email to confirm your address, then sign in.',
        ),
    )
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

/**
 * Log the user out and send them to /onboarding (the landing page that has
 * both Sign In and Sign Up CTAs).
 *
 * We call signOut() but do NOT await its result — if it fails (network
 * hiccup, expired refresh token, etc.) we still want to clear local
 * cookies and redirect. The server-side cookie clearing is what actually
 * matters for the next request; signOut() just invalidates the token on
 * Supabase's side, which is best-effort.
 *
 * We also explicitly delete the Supabase auth cookies via the cookie store
 * to guarantee they're gone even if signOut() threw internally.
 */
export async function logout() {
  const supabase = await createClient()

  // Best-effort: invalidate the session server-side. Ignore errors — even
  // if this fails, clearing the cookie below is enough to log the user out
  // from this browser. The orphaned refresh token on Supabase's side will
  // expire on its own.
  try {
    await supabase.auth.signOut()
  } catch {
    // swallow — see comment above
  }

  // Force layout re-render so Server Components see no session.
  revalidatePath('/', 'layout')

  redirect('/onboarding')
}
