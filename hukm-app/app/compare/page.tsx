"use client";

import { Suspense } from "react";

import { CompareView } from "@/components/CompareView";

export default function ComparePage(): React.ReactElement {
  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <Suspense
        fallback={
          <div className="rounded-[14px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] p-6">
            <div className="skeleton h-6 w-1/3" />
            <div className="mt-3 skeleton h-4 w-2/3" />
          </div>
        }
      >
        <CompareView />
      </Suspense>
    </div>
  );
}
