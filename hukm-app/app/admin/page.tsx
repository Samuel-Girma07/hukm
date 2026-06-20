"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AdminDashboard } from "@/components/AdminDashboard";
import { Spinner } from "@/components/Spinner";

/**
 * Admin dashboard page.
 *
 * Auth check: we hit GET /api/admin/login (which returns just
 * { configured: true }) — but that doesn't verify the cookie. The real
 * auth check happens server-side on every /api/admin/* call (each route
 * uses requireAdmin()).
 *
 * To know whether to redirect to /admin/login before mounting the
 * dashboard, we use a tiny endpoint: GET /api/admin/check. That endpoint
 * returns 200 if the cookie is valid, 401 otherwise. We rely on the
 * response status, not any client-stored value.
 *
 * Why not just check `document.cookie`? The hukm-admin-auth cookie is
 * HTTP-only, so the browser can't read it from JS. That's by design —
 * it prevents XSS from exfiltrating the admin token.
 */
export default function AdminPage(): React.ReactElement {
  const router = useRouter();
  const [authorised, setAuthorised] = useState<boolean | null>(null);

  const recheck = useCallback(async (): Promise<void> => {
    try {
      // We hit /api/admin/login with GET — it returns configured:true.
      // But that doesn't tell us if the cookie is set. So instead we
      // hit /api/admin/stats with HEAD-style semantics via GET and
      // check the status. To avoid pulling a huge payload, we use
      // /api/admin/cache-stats (smaller response).
      const res = await fetch("/api/admin/cache-stats", { method: "GET" });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      // 200 means the cookie verified server-side.
      setAuthorised(true);
    } catch {
      // Network error — let the dashboard try to load; it will show its
      // own error state if the API is unreachable.
      setAuthorised(true);
    }
  }, [router]);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  if (authorised === null) {
    return (
      <div className="mx-auto flex max-w-4xl items-center justify-center py-12">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <AdminDashboard />
    </div>
  );
}
