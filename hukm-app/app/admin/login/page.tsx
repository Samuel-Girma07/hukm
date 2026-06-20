"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ErrorState, InlineError } from "@/components/ErrorState";
import { Spinner } from "@/components/Spinner";
import { useT } from "@/contexts/LanguageContext";

interface ConfigResponse {
  success: boolean;
  configured?: boolean;
  error?: string;
}

interface LoginResponse {
  success: boolean;
  error?: string;
  code?: string;
}

export default function AdminLoginPage(): React.ReactElement {
  const t = useT();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/login");
        const data = (await response.json()) as ConfigResponse;
        if (cancelled) return;
        if (!data.success) {
          setError(data.error ?? `HTTP ${response.status}`);
          return;
        }
        setConfigured(Boolean(data.configured));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as LoginResponse;
      if (!response.ok || !data.success) {
        setError(data.error ?? `HTTP ${response.status}`);
        return;
      }
      // Server set the hukm-admin-auth HTTP-only cookie. Navigate to /admin.
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (configured === false) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState message={t("admin.notConfigured")} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <header className="flex flex-col items-center gap-2 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
          Admin
        </p>
        <h1 className="text-[clamp(28px,3vw,40px)] font-semibold tracking-tight text-on-surface">
          {t("admin.loginTitle")}
        </h1>
        <p className="text-[14px] leading-relaxed text-on-surface-variant">
          {t("admin.loginSubtitle")}
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))]"
      >
        <div className="flex flex-col gap-4 p-6 sm:p-7">
          <label className="flex flex-col gap-2">
            <span className="label mb-0">{t("admin.passwordLabel")}</span>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              autoComplete="current-password"
              disabled={submitting || configured !== true}
              required
            />
          </label>
          {error ? <InlineError message={error} /> : null}
          <button
            type="submit"
            disabled={submitting || configured !== true}
            className="btn-primary justify-center"
          >
            {submitting ? (
              <>
                <Spinner className="h-4 w-4" />
                <span>{t("admin.signingIn")}</span>
              </>
            ) : (
              <span>{t("admin.signIn")}</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
