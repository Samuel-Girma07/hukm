"use client";

import { useEffect, useRef } from "react";
import anime from "animejs";

interface AnimatedTextProps {
  text: string;
  className?: string;
}

/**
 * Animated SVG stroke-draw hero text.
 *
 * Re-runs the animation when `text` changes (e.g. user toggles language
 * EN → AM). The previous anime.js instance is paused + destroyed on
 * cleanup to prevent leaks.
 *
 * Each render also re-measures `getComputedTextLength()` against the
 * new text content so the dasharray is correct.
 */
export function AnimatedHeroText({ text, className = "" }: AnimatedTextProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<ReturnType<typeof anime> | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    // Pause + clean up any previous animation before starting a new one.
    // This matters when `text` changes — the old anime.js instance was
    // still ticking on detached SVG nodes.
    if (animationRef.current) {
      try {
        animationRef.current.pause();
      } catch {
        /* anime v3 .pause() is safe but defensive */
      }
      animationRef.current = null;
    }

    const texts = svgRef.current.querySelectorAll(".hero-stroke-text");
    if (texts.length === 0) return;

    // Set dasharray to path length for each text element.
    // Re-measured every time `text` changes — the previous version
    // computed it once on mount and never updated.
    texts.forEach((el) => {
      const textEl = el as SVGTextElement;
      const length = textEl.getComputedTextLength();
      textEl.style.strokeDasharray = `${length}`;
      textEl.style.strokeDashoffset = `${length}`;
    });

    // Animate stroke drawing
    animationRef.current = anime({
      targets: texts,
      strokeDashoffset: [anime.setDashoffset, 0],
      easing: "easeInOutQuad",
      duration: 2000,
      delay: anime.stagger(80),
      loop: true,
      direction: "alternate",
    });

    return () => {
      if (animationRef.current) {
        try {
          animationRef.current.pause();
        } catch {
          /* ignore */
        }
        animationRef.current = null;
      }
    };
  }, [text]);

  return (
    <svg
      ref={svgRef}
      className={`w-full overflow-visible ${className}`}
      viewBox="0 0 800 60"
      preserveAspectRatio="xMidYMid meet"
      aria-label={text}
    >
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="hero-stroke-text"
        style={{
          fontSize: "22px",
          fontWeight: 400,
          fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
          fill: "none",
          stroke: "#ffffff",
          strokeWidth: "0.8px",
          opacity: 0.9,
        }}
      >
        {text}
      </text>
    </svg>
  );
}
