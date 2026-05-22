import type { ModelVendor } from "@/lib/models";

interface VendorLogoProps {
  vendor: ModelVendor;
  /** Pixel size (width & height). Default 20. */
  size?: number;
  className?: string;
}

/**
 * Per-vendor brand mark rendered as inline SVG.
 *
 * Each logo uses the vendor's official brand colour and a simplified
 * geometric mark so it reads clearly at small sizes (16–24 px).
 * Purely decorative — aria-hidden by default.
 */
export function VendorLogo({
  vendor,
  size = 20,
  className = "",
}: VendorLogoProps): React.ReactElement {
  const shared = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true as const,
    className: `inline-block shrink-0 ${className}`,
  };

  switch (vendor) {
    /* ── NVIDIA: stylised eye ── */
    case "nvidia":
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="11" fill="#76B900" />
          <path
            d="M7.5 12c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5-2 4.5-4.5 4.5S7.5 14.5 7.5 12Z"
            fill="none"
            stroke="#fff"
            strokeWidth="1.6"
          />
          <circle cx="12" cy="12" r="2" fill="#fff" />
        </svg>
      );

    /* ── OpenAI: hexagonal spiral ── */
    case "openai":
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="11" fill="#10A37F" />
          <path
            d="M12 5.5l5.5 3.2v6.4L12 18.3 6.5 15.1V8.7L12 5.5Z"
            fill="none"
            stroke="#fff"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M12 8.8l3 1.7v3.4l-3 1.7-3-1.7v-3.4l3-1.7Z"
            fill="none"
            stroke="#fff"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="1.2" fill="#fff" />
        </svg>
      );

    /* ── Meta: infinity loop ── */
    case "meta":
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="11" fill="#0081FB" />
          <path
            d="M6.5 12c0-1.8 1-3.2 2.3-3.2 1 0 1.8.6 3.2 2.4l.4.5c1.2 1.5 1.8 2.1 2.6 2.1.8 0 1.5-.8 1.5-1.8s-.7-1.8-1.5-1.8c-.5 0-1 .3-1.8 1.1"
            fill="none"
            stroke="#fff"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M17.5 12c0 1.8-1 3.2-2.3 3.2-1 0-1.8-.6-3.2-2.4l-.4-.5C10.4 10.8 9.8 10.2 9 10.2c-.8 0-1.5.8-1.5 1.8s.7 1.8 1.5 1.8c.5 0 1-.3 1.8-1.1"
            fill="none"
            stroke="#fff"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );

    /* ── Qwen: Q mark ── */
    case "qwen":
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="11" fill="#6C5CE7" />
          <circle
            cx="12"
            cy="11.5"
            r="5"
            fill="none"
            stroke="#fff"
            strokeWidth="1.8"
          />
          <path
            d="M14 14l3.5 3.5"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );

    /* ── Z.AI: Z lightning bolt ── */
    case "z-ai":
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="11" fill="#FF6B35" />
          <path
            d="M8 7h8l-5 5h5l-8 5 2.5-5H8Z"
            fill="#fff"
            stroke="#fff"
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
        </svg>
      );

    /* ── DeepSeek: whale / deep search ── */
    case "deepseek":
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="11" fill="#4D9FE6" />
          <path
            d="M7 13.5c0-3.3 2.2-6 5-6s5 2.7 5 6c0 1.5-.5 2.8-1.3 3.8"
            fill="none"
            stroke="#fff"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="10" cy="12" r="1" fill="#fff" />
          <path
            d="M13 15c-.5.5-1.3.8-2 .5"
            fill="none"
            stroke="#fff"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
      );

    default: {
      // Fallback: generic AI chip icon
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="11" fill="#888" />
          <rect
            x="8"
            y="8"
            width="8"
            height="8"
            rx="1.5"
            fill="none"
            stroke="#fff"
            strokeWidth="1.4"
          />
          <circle cx="12" cy="12" r="1.5" fill="#fff" />
        </svg>
      );
    }
  }
}
