"use client";

import { useEffect } from "react";

/**
 * Registers the service worker once on mount, in production only.
 * Skipping registration in development avoids the "stale page" trap
 * that haunts every PWA dev loop. Failures are silently ignored —
 * the app must work fine without offline support.
 */
export function ServiceWorkerRegistrar(): null {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async (): Promise<void> => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Ignore — offline support is best-effort.
      }
    };
    void register();
  }, []);

  return null;
}
