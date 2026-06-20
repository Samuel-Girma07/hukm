"use client";

import { usePathname } from "next/navigation";

/**
 * Wraps the main content area and applies the sidebar gutter (md:pl-[72px])
 * ONLY on routes that actually render the sidebar.
 *
 * Auth / onboarding routes render full-screen centered layouts (login card,
 * onboarding hero) — they should NOT have the sidebar gutter, otherwise the
 * centered content is pushed off-center.
 */
const BARE_ROUTES = ["/login", "/signup", "/onboarding"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const isBare = BARE_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );

  if (isBare) {
    // No sidebar gutter, no top padding — the page owns its own layout.
    return <main className="min-h-[100dvh]">{children}</main>;
  }

  return (
    <main className="min-h-[100dvh] pt-16 md:pt-8 md:pl-[72px]">
      <div className="px-4 pb-12 sm:px-6 lg:px-10 lg:pb-16">{children}</div>
    </main>
  );
}
