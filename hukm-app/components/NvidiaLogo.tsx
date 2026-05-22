interface NvidiaLogoProps {
  className?: string;
  /** Pixel height of the lockup. */
  size?: number;
  /** Render only the eye glyph (no wordmark). */
  iconOnly?: boolean;
}

/**
 * NVIDIA brand lockup.
 *
 * Renders an "eye" glyph + the NVIDIA wordmark in their signature green
 * (#76B900). The shapes are simplified vector approximations of the
 * official identity — sufficient for an attribution lockup such as
 * "Powered by NVIDIA". The colour is hard-coded; even on dark surfaces
 * the green is the green.
 *
 * Decorative by default (aria-hidden). Wrap in a container with
 * aria-label if used as a meaningful logo.
 */
export function NvidiaLogo({
  className = "",
  size = 14,
  iconOnly = false,
}: NvidiaLogoProps): React.ReactElement {
  if (iconOnly) {
    return (
      <svg
        viewBox="0 0 28 20"
        width={size * 1.4}
        height={size}
        role="img"
        aria-label="NVIDIA"
        className={`inline-block align-middle ${className}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <Eye />
      </svg>
    );
  }

  const width = size * 6.6;
  return (
    <svg
      viewBox="0 0 132 20"
      width={width}
      height={size}
      role="img"
      aria-label="NVIDIA"
      className={`inline-block align-middle ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <Eye />
      {/* Wordmark — italic geometric grotesk approximation. */}
      <text
        x="34"
        y="15"
        fontFamily="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="14"
        fontWeight="800"
        fontStyle="italic"
        letterSpacing="0.6"
        fill="#76B900"
      >
        NVIDIA
      </text>
    </svg>
  );
}

/** The NVIDIA "eye" — a simplified vector approximation. */
function Eye(): React.ReactElement {
  return (
    <g>
      {/* Outer leaf shape */}
      <path
        d="M3 10c0-3.5 4-7 11-7s11 3 11 7-4 7-11 7c-2.5 0-4.5-.4-6-1.1V12c1.5.7 3.5 1 5.5 1 4 0 7-1.5 7-3s-3-3-7-3-7 1.5-7 3v6.5C5 14.6 3 12.4 3 10Z"
        fill="#76B900"
      />
    </g>
  );
}
