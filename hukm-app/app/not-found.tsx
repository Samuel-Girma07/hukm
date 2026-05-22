"use client";

import Link from "next/link";

import { Icon } from "@/components/Icon";
import { useT } from "@/contexts/LanguageContext";

export default function NotFound(): React.ReactElement {
  const t = useT();
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-start justify-center gap-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
        404
      </p>
      <h1 className="text-[clamp(28px,3.4vw,48px)] font-semibold tracking-tight text-on-surface">
        {t("common.notFoundTitle")}
      </h1>
      <p className="max-w-prose text-[15px] leading-relaxed text-on-surface-variant">
        {t("common.notFoundBody")}
      </p>
      <Link href="/" className="btn-primary">
        <span>{t("common.backToHome")}</span>
        <Icon name="arrow_forward" size={14} />
      </Link>
    </div>
  );
}
