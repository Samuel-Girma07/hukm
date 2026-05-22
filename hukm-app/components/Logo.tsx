import { HukmMark } from "./HukmMark";

interface LogoProps {
  className?: string;
}

/**
 * Compatibility shim: legacy callsites import `<Logo />`. Renders the new
 * compact HUKM brand mark (H + balance-scale crossbar). The old Fraunces
 * wordmark is gone.
 */
export function Logo({ className = "" }: LogoProps): React.ReactElement {
  return <HukmMark className={className} />;
}
