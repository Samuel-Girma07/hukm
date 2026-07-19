'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { userQuery } from '@/lib/db/userQuery'
import { comparePassword, hashPassword, signToken, setAuthCookie, clearAuthCookie } from '@/lib/auth'

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
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect('/login?error=' + encodeURIComponent('Email and password are required.'))
  }

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
  redirect('/')
}

/**
 * Sign up a new user, then immediately sign them in.
 *
 * On success: redirect to "/".
 * On error:   redirect to "/signup?error=<message>".
 */
export async function signup(formData: FormData) {
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
    redirect('/signup?error=' + encodeURIComponent('Could not create account: ' + error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/')
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
