import type { Config } from "tailwindcss";

/**
 * HUKM design tokens â€" Perplexity Pro inspired dark theme.
 *
 * One canonical dark token set. The legacy `forest`/`cream`/`brand`/`ink`/
 * `accent` color scales are remapped to dark Perplexity equivalents so any
 * leftover class strings still in components render in the new system.
 *
 * Naming follows Material-3 (`primary-container`, `on-surface-variant`,
 * etc.) so component code reads the way the design system is described.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Always-dark; the attribute is still set by the no-flash script for any
  // selector that depends on it.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        // Body / everything else: Slabo 13px
        sans: [
          "Slabo 13px",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        // Hero / main header (large text): Sanchez
        // Primary headings: Sanchez
        // Second header: BenchNine
        display: [
          "Sanchez",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        h1: [
          "Sanchez",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        h2: [
          "BenchNine",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        "body-lg": [
          "Slabo 13px",
          "system-ui",
          "sans-serif",
        ],
        "body-md": [
          "Slabo 13px",
          "system-ui",
          "sans-serif",
        ],
        "label-sm": [
          "Slabo 13px",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        // Hero / display sizes scaled down to a Perplexity-pro feel.
        editorial: [
          "clamp(40px, 4.5vw + 1rem, 56px)",
          {
            lineHeight: "1.12",
            letterSpacing: "-0.02em",
            fontWeight: "400",
          },
        ],
        display: [
          "clamp(32px, 3.5vw + 0.5rem, 48px)",
          {
            lineHeight: "1.15",
            letterSpacing: "-0.02em",
            fontWeight: "400",
          },
        ],
        h1: [
          "clamp(24px, 2vw + 0.5rem, 36px)",
          {
            lineHeight: "1.2",
            letterSpacing: "-0.015em",
            fontWeight: "500",
          },
        ],
        h2: [
          "clamp(18px, 1.2vw + 0.4rem, 24px)",
          {
            lineHeight: "1.3",
            letterSpacing: "-0.01em",
            fontWeight: "600",
          },
        ],
        "body-lg": [
          "16px",
          {
            lineHeight: "1.65",
            fontWeight: "400",
          },
        ],
        "body-md": [
          "14px",
          {
            lineHeight: "1.65",
            fontWeight: "400",
          },
        ],
        "label-sm": [
          "11px",
          {
            lineHeight: "1",
            letterSpacing: "0.06em",
            fontWeight: "600",
          },
        ],
      },
      colors: {
        // ----- Material-3 token palette (CSS-variable backed) -----
        background: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface-elevated) / <alpha-value>)",
        "surface-bright": "rgb(var(--surface-overlay) / <alpha-value>)",
        "surface-dim": "rgb(var(--surface) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--bg) / <alpha-value>)",
        "surface-container-low": "rgb(var(--surface) / <alpha-value>)",
        "surface-container":
          "rgb(var(--surface-container) / <alpha-value>)",
        "surface-container-high":
          "rgb(var(--surface-container-high) / <alpha-value>)",
        "surface-container-highest":
          "rgb(var(--surface-container-highest) / <alpha-value>)",
        "surface-variant":
          "rgb(var(--surface-container) / <alpha-value>)",
        "on-background": "rgb(var(--on-surface) / <alpha-value>)",
        "on-surface": "rgb(var(--on-surface) / <alpha-value>)",
        "on-surface-variant":
          "rgb(var(--on-surface-variant) / <alpha-value>)",
        outline: "rgb(var(--outline) / <alpha-value>)",
        "outline-variant": "rgb(var(--outline-variant) / <alpha-value>)",

        primary: "rgb(var(--accent-blue) / <alpha-value>)",
        "primary-container": "rgb(var(--accent-blue) / <alpha-value>)",
        "primary-fixed": "rgb(var(--accent-blue) / <alpha-value>)",
        "primary-fixed-dim": "rgb(var(--accent-cyan) / <alpha-value>)",
        "on-primary": "#FFFFFF",
        "on-primary-container": "#FFFFFF",
        "inverse-primary": "rgb(var(--accent-cyan) / <alpha-value>)",

        secondary: "rgb(var(--accent-cyan) / <alpha-value>)",
        "secondary-container": "rgb(var(--surface-elevated) / <alpha-value>)",
        "secondary-fixed": "rgb(var(--surface-elevated) / <alpha-value>)",
        "on-secondary": "rgb(var(--text-primary) / <alpha-value>)",
        "on-secondary-container":
          "rgb(var(--text-secondary) / <alpha-value>)",

        tertiary: "rgb(var(--accent-cyan) / <alpha-value>)",
        "tertiary-container": "rgb(var(--accent-cyan) / 0.16)",
        "tertiary-fixed": "rgb(var(--surface-elevated) / <alpha-value>)",
        "tertiary-fixed-dim": "rgb(var(--accent-amber) / <alpha-value>)",
        "on-tertiary": "rgb(var(--text-primary) / <alpha-value>)",
        "on-tertiary-container":
          "rgb(var(--text-secondary) / <alpha-value>)",

        error: "rgb(var(--accent-red) / <alpha-value>)",
        "error-container": "rgb(var(--accent-red) / 0.16)",
        "on-error": "#FFFFFF",
        "on-error-container":
          "rgb(var(--text-secondary) / <alpha-value>)",

        // ----- Accent shortcuts -----
        "accent-blue": "rgb(var(--accent-blue) / <alpha-value>)",
        "accent-cyan": "rgb(var(--accent-cyan) / <alpha-value>)",
        "accent-green": "rgb(var(--accent-green) / <alpha-value>)",
        "accent-amber": "rgb(var(--accent-amber) / <alpha-value>)",
        "accent-red": "rgb(var(--accent-red) / <alpha-value>)",

        // ----- Border shortcuts -----
        "border-subtle": "rgb(var(--border-subtle) / <alpha-value>)",
        "border-visible": "rgb(var(--border-visible) / <alpha-value>)",

        // =====================================================================
        //  Legacy palette â†' dark Perplexity equivalents.
        //  These names appear in many existing class strings. Mapping every
        //  shade to a sensible dark value means leftover usages render
        //  correctly without us having to rewrite them all in one pass.
        // =====================================================================
        brand: {
          50: "#1C1C1E",
          100: "#1C1C1E",
          200: "#2C2C2E",
          300: "#5AC8FA", // cyan accent
          400: "#0A84FF", // blue accent (primary)
          500: "#0A84FF",
          600: "#0A84FF",
          700: "#0A84FF",
        },
        forest: {
          50: "#1C1C1E",
          100: "#1C1C1E",
          200: "#1C1C1E",
          300: "#2C2C2E",
          400: "#2C2C2E",
          500: "#2C2C2E",
          600: "#1C1C1E",
          700: "#1C1C1E",
          800: "#0A0A0A",
          900: "#0A0A0A",
        },
        cream: {
          50: "#1C1C1E",
          100: "#1C1C1E",
          200: "#2C2C2E",
          300: "#2C2C2E",
          400: "#2C2C2E",
          500: "#3A3A3C",
        },
        ink: {
          50: "#1C1C1E",
          100: "#2C2C2E",
          200: "#2C2C2E",
          300: "#5AC8FA",
          400: "#0A84FF",
          500: "#98989D",
          600: "#636366",
          700: "#1C1C1E",
          800: "#0A0A0A",
          900: "#0A0A0A",
        },
        accent: {
          50: "#1C1C1E",
          100: "#2C2C2E",
          200: "#5AC8FA",
          300: "#5AC8FA",
          400: "#0A84FF",
          500: "#0A84FF",
          600: "#0A84FF",
          700: "#0A84FF",
          800: "#0A84FF",
          900: "#0A84FF",
        },
      },
      borderRadius: {
        DEFAULT: "0.375rem",
        lg: "0.625rem",
        xl: "0.875rem",
        "2xl": "1rem",
        // Squircle aliases retained for compatibility â€" all map to ~14px.
        "squircle-1": "0.875rem",
        "squircle-2": "0.875rem",
        "squircle-3": "1rem",
        "squircle-4": "1.25rem",
        full: "9999px",
      },
      maxWidth: {
        prose: "68ch",
        container: "1280px",
      },
      keyframes: {
        cursorBlink: {
          "0%, 50%": { opacity: "1" },
          "50.01%, 100%": { opacity: "0" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        slideInLeft: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        pulseDot: {
          "0%, 100%": { transform: "scale(0.8)", opacity: "0.5" },
          "50%": { transform: "scale(1.2)", opacity: "1" },
        },
        riseIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.98) translateY(-6px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        softIn: {
          "0%": { opacity: "0", transform: "translateY(2px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        cursorBlink: "cursorBlink 1s step-end infinite",
        slideInRight: "slideInRight 280ms cubic-bezier(0.32,0.72,0,1) forwards",
        slideInLeft: "slideInLeft 280ms cubic-bezier(0.32,0.72,0,1) forwards",
        fadeIn: "fadeIn 200ms ease-out forwards",
        pulseDot: "pulseDot 1.5s ease-in-out infinite",
        riseIn: "riseIn 220ms cubic-bezier(0.32,0.72,0,1) both",
        popIn: "popIn 200ms cubic-bezier(0.32,0.72,0,1) both",
        softIn: "softIn 200ms cubic-bezier(0.32,0.72,0,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
