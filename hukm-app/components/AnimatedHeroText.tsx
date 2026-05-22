"use client";

import { useEffect, useRef } from "react";
import anime from "animejs";

interface AnimatedTextProps {
  text: string;
  className?: string;
}

export function AnimatedHeroText({ text, className = "" }: AnimatedTextProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!svgRef.current || hasAnimated.current) return;
    hasAnimated.current = true;

    const texts = svgRef.current.querySelectorAll(".hero-stroke-text");
    if (texts.length === 0) return;

    // Set dasharray to path length for each text element
    texts.forEach((el) => {
      const textEl = el as SVGTextElement;
      const length = textEl.getComputedTextLength();
      textEl.style.strokeDasharray = `${length}`;
      textEl.style.strokeDashoffset = `${length}`;
    });

    // Animate stroke drawing
    anime({
      targets: texts,
      strokeDashoffset: [anime.setDashoffset, 0],
      easing: "easeInOutQuad",
      duration: 2000,
      delay: anime.stagger(80),
      loop: true,
      direction: "alternate",
    });
  }, []);

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
