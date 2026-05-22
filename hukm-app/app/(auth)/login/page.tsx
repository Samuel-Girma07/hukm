import { login } from '../actions'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border border-surface-variant bg-surface p-8 shadow-sm">
        <h1 className="mb-6 text-center font-display text-2xl font-semibold text-on-surface">
          Sign In to HUKM
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
          <div className="mt-2 flex justify-center w-full">
            <button
              formAction={login}
              className="Btn Btn-primary"
            >
              <div className="sign">
                <svg viewBox="0 0 512 512"><path d="M217.9 105.9L340.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L217.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM352 416l64 0c17.7 0 32-14.3 32-32l0-256c0-17.7-14.3-32-32-32l-64 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l64 0c53 0 96 43 96 96l0 256c0 53-43 96-96 96l-64 0c-17.7 0-32-14.3-32-32s14.3-32 32-32z"></path></svg>
              </div>
              <div className="text">Sign In</div>
            </button>
          </div>
        </form>
        <p className="mt-6 text-center text-sm text-on-surface-variant">
          Don't have an account?{' '}
          <a href="/signup" className="text-primary hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  )
}
