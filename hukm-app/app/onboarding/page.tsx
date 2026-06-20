"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

import { useT } from "@/contexts/LanguageContext";

const LightRays = dynamic(() => import("@/components/LightRays"));
const AnimatedHeroText = dynamic(() => import("@/components/AnimatedHeroText").then((mod) => mod.AnimatedHeroText));
const HeroCornerDecoration = dynamic(() => import("@/components/HeroCornerDecoration").then((mod) => mod.HeroCornerDecoration));

export default function OnboardingPage() {
  const t = useT();
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[rgb(var(--bg))] text-on-surface">
      {/* Background light rays */}
      <div className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden" style={{ height: "600px" }}>
        <LightRays
          raysOrigin="top-center"
          raysColor="#ffffff"
          raysSpeed={1.2}
          lightSpread={0.6}
          rayLength={2.5}
          fadeDistance={1.8}
          saturation={1.0}
          followMouse={false}
          mouseInfluence={0}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-40"
          style={{ background: "linear-gradient(to bottom, transparent, rgb(var(--bg)))" }}
        />
      </div>

      <HeroCornerDecoration />

      <main className="z-10 flex w-full max-w-md flex-col items-center gap-10 px-6 text-center">
        {/* Logo and Intro */}
        <div className="flex flex-col items-center gap-6">
          <h1 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            {t("onboarding.welcomeTitle")}
          </h1>
          <AnimatedHeroText
            text={t("onboarding.welcomeBody")}
            className="h-8 max-w-prose sm:h-10 text-on-surface-variant"
          />
        </div>

        {/* Auth Links */}
        <div className="flex w-full flex-col gap-4">
          <Link
            href="/signup"
            className="group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-full bg-white text-lg font-semibold text-black transition-transform active:scale-95"
          >
            <span className="relative z-10 transition-transform group-hover:-translate-y-10">
              {t("onboarding.getCta")}
            </span>
            <span className="absolute inset-0 z-10 flex items-center justify-center translate-y-10 transition-transform group-hover:translate-y-0">
              {t("onboarding.getCtaHover")}
            </span>
          </Link>

          <Link
            href="/login"
            className="group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-full border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] text-lg font-semibold text-white transition-transform active:scale-95"
          >
            <span className="relative z-10 transition-transform group-hover:-translate-y-10">
              {t("onboarding.signInCta")}
            </span>
            <span className="absolute inset-0 z-10 flex items-center justify-center translate-y-10 transition-transform group-hover:translate-y-0">
              {t("onboarding.signInCtaHover")}
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
