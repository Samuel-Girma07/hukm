"use client";

import React from "react";

/**
 * HeroCornerDecoration — abstract tech-style corner animation for the hero page.
 *
 * Placed in the top-right corner, flipped horizontally so the motion
 * originates from / points toward the corner edge.
 *
 * Colors are adapted for the HUKM dark theme (subtle off-white
 * instead of the original light-grey so it shows on #0A0A0A).
 */
export function HeroCornerDecoration(): React.ReactElement {
  return (
    <>

      {/* Container: fixed top-right, flipped horizontally so the motion
          aligns with the right edge. Pointer-events none so it never
          blocks interaction with the composer or header. */}
      <div
        className="pointer-events-none absolute right-0 top-0 z-0"
        style={{
          width: 150,
          height: 150,
          transform: "scaleX(-1)",
        }}
        aria-hidden="true"
      >
        {/* Main crossing lines */}
        <div
          className="absolute"
          style={{
            width: 15,
            height: 65,
            animation: "hukm-move-h 1.2s infinite cubic-bezier(0.65, 0.05, 0.36, 1)",
            backgroundColor: "rgba(255, 255, 255, 0.25)",
          }}
        />
        <div
          className="absolute"
          style={{
            width: 15,
            height: 60,
            transform: "rotate(90deg)",
            animation: "hukm-move-v 1.2s infinite cubic-bezier(0.65, 0.05, 0.36, 1)",
            backgroundColor: "rgba(255, 255, 255, 0.25)",
          }}
        />

        {/* Decorative elements */}
        <div
          className="absolute"
          style={{
            width: 1,
            height: 40,
            opacity: 0.3,
            top: 0,
            left: "8%",
            animation: "hukm-effect 0.2s 0.1s infinite linear",
            backgroundColor: "rgba(255, 255, 255, 0.35)",
          }}
        />
        <div
          className="absolute"
          style={{
            width: 60,
            height: 1,
            opacity: 0.8,
            top: "8%",
            left: 0,
            animation: "hukm-effect 0.3s 0.2s infinite linear",
            backgroundColor: "rgba(255, 255, 255, 0.35)",
          }}
        />
        <div
          className="absolute"
          style={{
            top: "10%",
            left: "12%",
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            fontWeight: 900,
            fontSize: 18,
            color: "rgba(255, 255, 255, 0.45)",
            animation: "hukm-rot 0.8s infinite cubic-bezier(0.65, 0.05, 0.36, 1)",
          }}
        >
          X
        </div>
        <div
          className="absolute"
          style={{
            width: 1,
            height: 40,
            opacity: 0.3,
            top: "90%",
            right: "10%",
            animation: "hukm-effect 0.2s 0.1s infinite linear",
            backgroundColor: "rgba(255, 255, 255, 0.35)",
          }}
        />
        <div
          className="absolute"
          style={{
            width: 40,
            height: 1,
            opacity: 0.3,
            top: "100%",
            right: 0,
            animation: "hukm-effect 0.3s 0.2s infinite linear",
            backgroundColor: "rgba(255, 255, 255, 0.35)",
          }}
        />
        <div
          className="absolute"
          style={{
            top: "100%",
            right: 0,
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            fontSize: 32,
            color: "rgba(255, 255, 255, 0.25)",
            animation: "hukm-scale 0.8s infinite cubic-bezier(0.65, 0.05, 0.36, 1)",
          }}
        >
          *
        </div>
        <div
          className="absolute"
          style={{
            width: 1,
            height: 20,
            bottom: 0,
            left: 0,
            transform: "rotate(45deg)",
            animation: "hukm-height 1s infinite cubic-bezier(0.65, 0.05, 0.36, 1)",
            backgroundColor: "rgba(255, 255, 255, 0.35)",
          }}
        />
        <div
          className="absolute"
          style={{
            width: 20,
            height: 1,
            bottom: "50%",
            left: 0,
            animation: "hukm-width 1.5s infinite cubic-bezier(0.65, 0.05, 0.36, 1)",
            backgroundColor: "rgba(255, 255, 255, 0.35)",
          }}
        />
      </div>
    </>
  );
}
