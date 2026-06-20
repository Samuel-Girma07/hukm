"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useT } from "@/contexts/LanguageContext";

// Routes that should NOT show the app chrome (sidebar / footer / shortcuts).
const BARE_ROUTES = ["/login", "/signup", "/onboarding"];

export function SiteFooter(): React.ReactElement {
  const t = useT();
  const pathname = usePathname() ?? "/";

  if (BARE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    return <></>;
  }

  return (
    <footer className="mt-12 border-t border-[rgb(var(--border-subtle))] px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-2 text-[12px] text-on-surface-variant sm:flex-row sm:items-center">
        <span>
          © {new Date().getFullYear()} HUKM ·{" "}
          <span className="text-on-surface-variant/80">{t("app.tagline")}</span>
        </span>
        <nav className="flex items-center gap-4">
          <span className="text-on-surface-variant/80">
            {t("app.footerNote")}
          </span>
          <Link
            href="/resources"
            className="text-on-surface-variant transition-colors hover:text-on-surface"
          >
            {t("nav.resources")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
