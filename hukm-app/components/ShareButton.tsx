"use client";

import React from "react";

interface ShareButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  loading?: boolean;
}

/**
 * Dark glossy share button with subtle blue glow on hover.
 *
 * Adapted for the HUKM dark theme:
 *   - surface-overlay instead of #212121
 *   - accent-blue glow instead of generic blue
 *   - share-arrow SVG icon
 */
export function ShareButton({
  onClick,
  disabled = false,
  label,
  loading = false,
}: ShareButtonProps): React.ReactElement {
  return (
    <>

      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-lg px-5 py-2.5 text-[14px] font-medium text-white transition-all duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: "rgb(var(--surface-overlay))",
          outline: "0.1em solid rgb(53, 53, 53)",
          border: "0",
          boxShadow: "0 0 1em 1em rgba(0, 0, 0, 0.1)",
          aspectRatio: "1 / 0.25",
          cursor: disabled || loading ? "not-allowed" : "pointer",
        }}
        onMouseEnter={(e) => {
          if (disabled || loading) return;
          const btn = e.currentTarget;
          btn.style.transform = "scale(1.05)";
          btn.style.boxShadow = "0 0 1em 0.45em rgba(0, 0, 0, 0.15)";
          btn.style.background =
            "radial-gradient(circle at bottom, rgba(10, 132, 255, 0.35) 10%, rgb(var(--surface-overlay)) 70%)";
          btn.style.outline = "0";
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget;
          btn.style.transform = "scale(1)";
          btn.style.boxShadow = "0 0 1em 1em rgba(0, 0, 0, 0.1)";
          btn.style.background = "rgb(var(--surface-overlay))";
          btn.style.outline = "0.1em solid rgb(53, 53, 53)";
        }}
        onMouseDown={(e) => {
          if (disabled || loading) return;
          e.currentTarget.style.transform = "scale(0.98)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
        }}
      >
        {/* Share icon SVG */}
        <svg
          viewBox="0 0 512 512"
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 shrink-0 fill-white transition-transform duration-300 group-hover:translate-x-0.5"
          aria-hidden="true"
        >
          <path d="M307 34.8c-11.5 5.1-19 16.6-19 29.2v64H176C78.8 128 0 206.8 0 304C0 417.3 81.5 467.9 100.2 478.1c2.5 1.4 5.3 1.9 8.1 1.9c10.9 0 19.7-8.9 19.7-19.7c0-7.5-4.3-14.4-9.8-19.5C108.8 431.9 96 414.4 96 384c0-53 43-96 96-96h96v64c0 12.6 7.4 24.1 19 29.2s25 3 34.4-5.4l160-144c6.7-6.1 10.6-14.7 10.6-23.8s-3.8-17.7-10.6-23.8l-160-144c-9.4-8.5-22.9-10.6-34.4-5.4z" />
        </svg>

        <span className="relative z-10">{loading ? "Sharing…" : label}</span>
      </button>
    </>
  );
}
