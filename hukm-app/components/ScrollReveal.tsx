"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  /** Delay (ms) before the entry animation begins after the element intersects. */
  delay?: number;
  /**
   * Ratio of the element that must be in view before triggering. 0 →
   * any pixel; 1 → fully on-screen. Default 0.15 — a graceful tail.
   */
  threshold?: number;
  /** When true, also re-animate when scrolling back into view. Default false. */
  repeat?: boolean;
  /** HTML element to render. Default "div". */
  as?:
    | "div"
    | "section"
    | "article"
    | "header"
    | "footer"
    | "li"
    | "main"
    | "h1"
    | "h2"
    | "h3"
    | "p"
    | "span"
    | "ul";
  className?: string;
  style?: CSSProperties;
}

/**
 * Heavy editorial scroll-reveal wrapper.
 *
 * On entry the child fades up 64px, blurs in from 8px, and lands over
 * 800ms with `cubic-bezier(0.32, 0.72, 0, 1)` — the same Apple/Linear
 * curve the rest of the system uses. Entirely transform + filter, so
 * it stays on the GPU.
 *
 * Honours `prefers-reduced-motion` automatically (the global rule in
 * `globals.css` collapses every animation to 1ms).
 *
 * Uses IntersectionObserver, never a scroll listener — so it doesn't
 * cause continuous reflows on mobile.
 */
export function ScrollReveal({
  children,
  delay = 0,
  threshold = 0.15,
  repeat = false,
  as = "div",
  className = "",
  style,
}: ScrollRevealProps): React.ReactElement {
  const ref = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setRevealed(true); // SSR / unsupported → show immediately
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            if (!repeat) obs.disconnect();
          } else if (repeat) {
            setRevealed(false);
          }
        }
      },
      { threshold, rootMargin: "0px 0px -10% 0px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [repeat, threshold]);

  const Tag = as as React.ElementType;

  return (
    <Tag
      ref={ref as React.Ref<HTMLElement>}
      className={`transition-[opacity,transform] duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
        revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      } ${className}`}
      style={{
        transitionDelay: `${delay}ms`,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
