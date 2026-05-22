"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AdminDashboard } from "@/components/AdminDashboard";
import { Spinner } from "@/components/Spinner";

const ADMIN_KEY = "hukm-admin-auth";

export default function AdminPage(): React.ReactElement {
  const router = useRouter();
  const [authorised, setAuthorised] = useState<boolean | null>(null);

  const recheck = useCallback((): void => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(ADMIN_KEY);
    if (!stored) {
      router.replace("/admin/login");
      return;
    }
    setAuthorised(true);
  }, [router]);

  useEffect(() => {
    recheck();
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
