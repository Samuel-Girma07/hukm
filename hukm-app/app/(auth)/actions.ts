'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { userQuery } from '@/lib/db/userQuery'
import { comparePassword, hashPassword, signToken, setAuthCookie, clearAuthCookie } from '@/lib/auth'
import { isValidEmail, passwordPolicyError, safeNextPath } from '@/lib/validation'
import { checkAuthRateLimit } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'

/**
 * Resolves the post-auth redirect target: explicit form field first,
 * then the hukm_next cookie the middleware plants when bouncing an
 * unauthenticated visitor away from a protected route.
 */
async function resolveNext(formData: FormData): Promise<string> {
  const fromForm = String(formData.get('next') ?? '')
  if (fromForm) return safeNextPath(fromForm)
  try {
    const store = await cookies()
    const fromCookie = store.get('hukm_next')?.value
    if (fromCookie) {
      store.delete('hukm_next')
      return safeNextPath(fromCookie)
    }
  } catch {
    // cookies() unavailable — fall through
  }
  return '/'
}

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
  // Throttle before touching credentials. Successful logins consume quota
  // too (same policy as /api/admin/login) so attackers can't distinguish
  // outcomes by throughput.
  const rateLimit = await checkAuthRateLimit('login')
  if (!rateLimit.allowed) {
    redirect(
      '/login?error=' +
        encodeURIComponent(
          `Too many attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
        ),
    )
  }

  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect('/login?error=' + encodeURIComponent('Email and password are required.'))
  }

  if (!isValidEmail(email)) {
    redirect('/login?error=' + encodeURIComponent('Please enter a valid email address.'))
  }

  const nextPath = await resolveNext(formData)

  try {
    const user = await userQuery.findByEmail(email)
    if (!user) {
      redirect('/login?error=' + encodeURIComponent('Invalid email or password.'))
    }

    const isValidPassword = await comparePassword(password, user.password_hash)
    if (!isValidPassword) {
      redirect('/login?error=' + encodeURIComponent('Invalid email or password.'))
    }

    const token = await signToken({ sub: user.id, email: user.email })
    await setAuthCookie(token)
  } catch (error: any) {
    // If the redirect itself throws, we let it bubble up
    if (error.message === 'NEXT_REDIRECT') throw error;
    redirect('/login?error=' + encodeURIComponent('An error occurred during login.'))
  }

  // Force layout to re-render so Server Components pick up the new session.
  revalidatePath('/', 'layout')
  redirect(nextPath)
}

/**
 * Sign up a new user, then immediately sign them in.
 *
 * On success: redirect to "/".
 * On error:   redirect to "/signup?error=<message>".
 */
export async function signup(formData: FormData) {
  // Throttle account creation per IP to prevent bulk spam signups.
  const rateLimit = await checkAuthRateLimit('signup')
  if (!rateLimit.allowed) {
    redirect(
      '/signup?error=' +
        encodeURIComponent(
          `Too many attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
        ),
    )
  }

  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect('/signup?error=' + encodeURIComponent('Email and password are required.'))
  }

  if (!isValidEmail(email)) {
    redirect('/signup?error=' + encodeURIComponent('Please enter a valid email address.'))
  }

  const policyError = passwordPolicyError(password)
  if (policyError) {
    redirect('/signup?error=' + encodeURIComponent(policyError))
  }

  const nextPath = await resolveNext(formData)

  try {
    const existingUser = await userQuery.findByEmail(email)
    if (existingUser) {
      redirect('/signup?error=' + encodeURIComponent('An account with that email already exists.'))
    }

    const hashed = await hashPassword(password)
    const newUser = await userQuery.create(email, hashed)

    const token = await signToken({ sub: newUser.id, email: newUser.email })
    await setAuthCookie(token)
  } catch (error: any) {
    if (error.message === 'NEXT_REDIRECT') throw error;
    // Handle Postgres unique constraint violation explicitly just in case
    if (error.code === '23505') {
      redirect('/signup?error=' + encodeURIComponent('An account with that email already exists.'))
    }
    // Never surface internal error details to the client — log them instead.
    logger.error('[auth/signup] account creation failed', {
      message: error instanceof Error ? error.message : String(error),
      code: error?.code,
    })
    redirect('/signup?error=' + encodeURIComponent('Could not create your account. Please try again.'))
  }

  revalidatePath('/', 'layout')
  redirect(nextPath)
}

/**
 * Log the user out and send them to /onboarding (the landing page that has
 * both Sign In and Sign Up CTAs).
 */
export async function logout() {
  await clearAuthCookie()

  // Force layout re-render so Server Components see no session.
  revalidatePath('/', 'layout')

  redirect('/onboarding')
}
