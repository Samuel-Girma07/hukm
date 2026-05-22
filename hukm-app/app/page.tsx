"use client";

import { ScenarioForm } from "@/components/ScenarioForm";
import { useT } from "@/contexts/LanguageContext";
import dynamic from "next/dynamic";

const LightRays = dynamic(() => import("@/components/LightRays"));
const AnimatedHeroText = dynamic(() => import("@/components/AnimatedHeroText").then((mod) => mod.AnimatedHeroText));
const HeroCornerDecoration = dynamic(() => import("@/components/HeroCornerDecoration").then((mod) => mod.HeroCornerDecoration));

/**
 * Home / scenario entry.
 *
 * Centered Perplexity-style prompt screen. Hero title above the
 * composer; composer + suggestion cards stacked below.
 */
export default function HomePage(): React.ReactElement {
  const t = useT();

  return (
    <div className="relative flex w-full flex-col">
      {/* Background light rays - hero page only, full-width behind header */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden"
        style={{ height: "600px" }}
      >
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
        {/* Fade overlay so rays blend into page background */}
        <div
          className="absolute inset-x-0 bottom-0 h-40"
          style={{
            background:
              "linear-gradient(to bottom, transparent, rgb(10,10,10))",
          }}
        />
      </div>

      {/* Abstract corner decoration — top-right, flipped to align with edge */}
      <HeroCornerDecoration />

      <div className="relative mx-auto flex w-full max-w-[820px] flex-col gap-8 pt-8 sm:pt-14 lg:pt-20">
        <header className="flex flex-col items-center gap-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
            {t("home.eyebrow")}
          </p>
          <h1 className="font-display text-editorial text-on-surface text-balance">
            {t("home.heading")}
          </h1>
          {/* Animated stroke text - hero page only */}
          <AnimatedHeroText
            text={t("home.body")}
            className="max-w-prose h-8 sm:h-10"
          />
        </header>

        <ScenarioForm />
      </div>
    </div>
  );
}
