"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { HukmMark } from "./HukmMark";
import { HukmMarkMetallic } from "./HukmMarkMetallic";
import { Icon } from "./Icon";
import { LanguageToggle } from "./LanguageToggle";
import { DockNavItem } from "./DockNavItem";

import { useT } from "@/contexts/LanguageContext";
import { logout } from "@/app/(auth)/actions";

interface NavItem {
  href: string;
  i18nKey: string;
  icon: string;
  /** Used to decide active state for the home item (exact-match only). */
  exact?: boolean;
}

const PRIMARY_NAV: ReadonlyArray<NavItem> = [
  { href: "/", i18nKey: "nav.home", icon: "home", exact: true },
  { href: "/history", i18nKey: "nav.history", icon: "schedule" },
  { href: "/compare", i18nKey: "nav.compare", icon: "compare_arrows" },
  { href: "/insights", i18nKey: "nav.insights", icon: "bar_chart" },
  { href: "/resources", i18nKey: "nav.resources", icon: "auto_stories" },
];

/**
 * Fixed icon-rail sidebar (Perplexity-style) with Dock magnification.
 *
 * Desktop (md+): 72px wide, fixed to the left edge, vertical icon stack
 * with spring-animated magnification on hover.
 * Mobile (<md): hidden by default; a small floating menu button at top-left
 * opens a slide-in drawer with the same items at full width.
 */
export function SiteSidebar(): React.ReactElement {
  const t = useT();
  const pathname = usePathname() ?? "/";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);

  // Close the drawer when the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Esc closes the drawer; lock scroll while open.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  function isActive(item: NavItem): boolean {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return (
    <>
      {/* ─────────── Desktop: fixed icon rail with Dock ─────────── */}
      <aside
        aria-label="Primary"
        className="
          fixed inset-y-0 left-0 z-40 hidden md:flex
          w-[72px] flex-col items-center
          border-r border-[rgb(var(--border-subtle))]
          bg-[rgb(var(--surface))]
        "
      >
        <Link
          href="/"
          aria-label={t("nav.home")}
          className="mt-4 flex h-10 w-10 items-center justify-center rounded-[8px] transition-colors hover:bg-[rgb(var(--surface-overlay))]"
        >
          <HukmMarkMetallic size={32} className="ring-0 bg-transparent" />
        </Link>

        {/* New analysis (primary action). */}
        <Link
          href="/"
          aria-label={t("nav.newAnalysis")}
          title={t("nav.newAnalysis")}
          className="
            mt-4 inline-flex h-10 w-10 items-center justify-center rounded-full
            bg-white text-[#0A0A0A]
            transition-[background-color,transform] duration-150 ease-out
            hover:bg-[#EBEBF5]
            motion-safe:active:scale-95
          "
        >
          <Icon name="add" size={18} />
        </Link>

        {/* ── Nav with Dock magnification ── */}
        <nav ref={navRef} className="mt-6 flex flex-1 flex-col items-center gap-1.5">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(item);
            return (
              <DockNavItem
                key={item.href}
                href={item.href}
                label={t(item.i18nKey)}
                active={active}
                containerRef={navRef}
              >
                <Icon name={item.icon} size={20} />
              </DockNavItem>
            );
          })}
        </nav>

        <div className="mb-4 flex flex-col items-center gap-1.5">
          <LanguageToggle variant="compact" />
          <DockNavItem
            href="/admin"
            label={t("nav.admin")}
            active={pathname.startsWith("/admin")}
            containerRef={navRef}
          >
            <Icon name="settings" size={18} />
          </DockNavItem>
          <form action={logout}>
            <button
              type="submit"
              className="mt-2 flex h-10 w-10 items-center justify-center rounded-[8px] text-on-surface-variant transition-colors hover:bg-[rgb(var(--surface-overlay))] hover:text-on-surface"
              title="Logout"
              aria-label="Logout"
            >
              <Icon name="logout" size={18} />
            </button>
          </form>
        </div>
      </aside>

      {/* ─────────── Mobile: top bar + drawer trigger ─────────── */}
      <header
        className="
          fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-3 px-4
          border-b border-[rgb(var(--border-subtle))]
          bg-[rgb(var(--bg))]
          md:hidden
        "
      >
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={t("nav.openMenu")}
          aria-expanded={drawerOpen}
          aria-controls="primary-drawer"
          className="btn-icon"
        >
          <Icon name="menu" size={20} />
        </button>
        <Link href="/" aria-label="HUKM" className="inline-flex items-center gap-2">
          <HukmMark size={28} />
          <span className="text-[15px] font-semibold tracking-tight text-on-surface">
            HUKM
          </span>
        </Link>
        <Link
          href="/"
          aria-label={t("nav.newAnalysis")}
          className="btn-icon bg-white !text-[#0A0A0A] hover:bg-[#EBEBF5]"
        >
          <Icon name="add" size={18} />
        </Link>
      </header>

      {/* Drawer overlay */}
      {drawerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.openMenu")}
          className="fixed inset-0 z-[60] md:hidden"
        >
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 animate-fadeIn bg-black/65 backdrop-blur-sm"
          />
          <div
            ref={drawerRef}
            id="primary-drawer"
            className="
              absolute inset-y-0 left-0 flex w-[280px] max-w-[80%] flex-col
              border-r border-[rgb(var(--border-subtle))]
              bg-[rgb(var(--surface))]
              animate-slideInLeft
            "
          >
            <div className="flex h-14 items-center justify-between border-b border-[rgb(var(--border-subtle))] px-4">
              <span className="inline-flex items-center gap-2">
                <HukmMark size={28} />
                <span className="text-[15px] font-semibold tracking-tight text-on-surface">
                  HUKM
                </span>
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={t("common.close")}
                className="btn-icon"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
              <Link
                href="/"
                onClick={() => setDrawerOpen(false)}
                className="
                  inline-flex items-center gap-3 rounded-[10px]
                  bg-white px-3 py-2.5 text-[14px] font-medium text-[#0A0A0A]
                  transition-colors hover:bg-[#EBEBF5]
                "
              >
                <Icon name="add" size={18} />
                {t("nav.newAnalysis")}
              </Link>

              <div className="my-2 h-px bg-[rgb(var(--border-subtle))]" />

              {PRIMARY_NAV.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "inline-flex items-center gap-3 rounded-[10px] bg-[rgb(var(--surface-elevated))] px-3 py-2.5 text-[14px] font-medium text-on-surface"
                        : "inline-flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] text-on-surface-variant transition-colors hover:bg-[rgb(var(--surface-overlay))] hover:text-on-surface"
                    }
                  >
                    <Icon name={item.icon} size={18} />
                    {t(item.i18nKey)}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center justify-between gap-2 border-t border-[rgb(var(--border-subtle))] px-3 py-3">
              <LanguageToggle variant="compact" />
              <Link
                href="/admin"
                onClick={() => setDrawerOpen(false)}
                className="btn-ghost"
              >
                <Icon name="settings" size={16} />
                <span>{t("nav.admin")}</span>
              </Link>
              <form action={logout} className="ml-auto">
                <button type="submit" className="btn-ghost text-error">
                  <Icon name="logout" size={16} />
                  <span>Logout</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
