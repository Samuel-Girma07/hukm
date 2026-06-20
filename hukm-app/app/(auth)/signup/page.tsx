"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { HukmMarkMetallic } from "@/components/HukmMarkMetallic";
import { useT } from "@/contexts/LanguageContext";
import { signup } from "../actions";

export default function SignupPage() {
  const t = useT();
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? undefined;

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-background p-4">
      {/* Animated background blobs */}
      <div className="pointer-events-none absolute -left-[10%] -top-[20%] h-[60%] w-[60%] rounded-full bg-[rgb(var(--accent-blue))]/20 blur-[120px] animate-pulse" />
      <div className="pointer-events-none absolute -right-[10%] bottom-[0%] h-[50%] w-[50%] rounded-full bg-[rgb(var(--accent-red))]/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 w-full max-w-md rounded-[24px] border border-white/5 bg-[rgb(var(--surface))]/60 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[16px] shadow-lg bg-gradient-to-br from-white/10 to-transparent border border-white/10">
            <HukmMarkMetallic size={40} className="bg-transparent ring-0" />
          </div>
          <h1 className="text-center font-display text-3xl font-bold tracking-tight text-on-surface">
            {t("auth.signupTitle")}
          </h1>
          <p className="mt-2 text-center text-sm text-on-surface-variant">
            {t("auth.signupSubtitle")}
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-error/20 bg-error/10 p-4 text-sm text-error shadow-sm">
            {error}
          </div>
        ) : null}

        <form className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-on-surface" htmlFor="email">
              {t("auth.emailLabel")}
            </label>
            <input
              className="w-full rounded-xl border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-variant))]/30 px-4 py-3.5 text-sm text-on-surface outline-none transition-all focus:border-[rgb(var(--accent-blue))] focus:bg-[rgb(var(--surface-variant))]/50 focus:ring-1 focus:ring-[rgb(var(--accent-blue))]"
              id="email"
              name="email"
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-on-surface" htmlFor="password">
              {t("auth.passwordLabel")}
            </label>
            <input
              className="w-full rounded-xl border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-variant))]/30 px-4 py-3.5 text-sm text-on-surface outline-none transition-all focus:border-[rgb(var(--accent-blue))] focus:bg-[rgb(var(--surface-variant))]/50 focus:ring-1 focus:ring-[rgb(var(--accent-blue))]"
              id="password"
              name="password"
              type="password"
              placeholder={t("auth.passwordPlaceholder")}
              required
            />
          </div>

          <button
            formAction={signup}
            className="mt-4 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[rgb(var(--accent-blue))] to-[rgb(var(--accent-blue))]/80 px-4 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
          >
            {t("auth.signUpButton")}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-on-surface-variant">
          {t("auth.haveAccountPrompt")}{' '}
          <a href="/login" className="font-medium text-[rgb(var(--accent-blue))] transition-colors hover:text-[rgb(var(--accent-blue))]/80 hover:underline">
            {t("auth.haveAccountLink")}
          </a>
        </p>
      </div>
    </div>
  );
}
