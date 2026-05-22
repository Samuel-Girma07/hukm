import { signup } from '../actions'

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border border-surface-variant bg-surface p-8 shadow-sm">
        <h1 className="mb-6 text-center font-display text-2xl font-semibold text-on-surface">
          Create an Account
        </h1>
        {searchParams?.error && (
          <div className="mb-4 rounded bg-error/10 p-3 text-sm text-error">
            {searchParams.error}
          </div>
        )}
        <form className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface" htmlFor="email">
              Email
            </label>
            <input
              className="rounded-md border border-surface-variant bg-surface-variant/30 px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
              id="email"
              name="email"
              type="email"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface" htmlFor="password">
              Password
            </label>
            <input
              className="rounded-md border border-surface-variant bg-surface-variant/30 px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
              id="password"
              name="password"
              type="password"
              required
            />
          </div>
          <button
            formAction={signup}
            className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
          >
            Sign Up
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-on-surface-variant">
          Already have an account?{' '}
          <a href="/login" className="text-primary hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
