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
          <div className="mt-2 flex justify-center w-full">
            <button
              formAction={signup}
              className="Btn Btn-primary"
            >
              <div className="sign">
                <svg viewBox="0 0 512 512"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM232 344l0-64-64 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l64 0 0-64c0-13.3 10.7-24 24-24s24 10.7 24 24l0 64 64 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-64 0 0 64c0 13.3-10.7 24-24 24s-24-10.7-24-24z"></path></svg>
              </div>
              <div className="text">Sign Up</div>
            </button>
          </div>
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
