import type { ReactNode } from "react";

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

/**
 * Editorial eyebrow tag. A microscopic uppercase-tracked pill that
 * precedes major H1/H2 headings. The leading dot is provided by the
 * `.eyebrow::before` rule in globals.css — do not add a manual one.
 */
export function Eyebrow({
  children,
  className = "",
}: EyebrowProps): React.ReactElement {
  return <span className={`eyebrow ${className}`}>{children}</span>;
}
