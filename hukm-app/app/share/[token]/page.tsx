import { notFound } from "next/navigation";

import { SharedAnalysisView } from "@/components/SharedAnalysisView";
import { isMigrationPending } from "@/lib/dbErrors";
import { logger } from "@/lib/logger";
import { getServerClient } from "@/lib/supabase";
import type { AnalysisResult, LawChunk } from "@/lib/types";

export const dynamic = "force-dynamic";

interface SharePageProps {
  params: { token: string };
}

interface SharedAnalysisRow {
  id: string;
  share_token: string;
  analysis_id: string;
  view_count: number;
  created_at: string;
}

interface AnalysisRow {
  id: string;
  scenario_input: { scenario?: string } | null;
  result: (AnalysisResult & { retrievedChunks?: LawChunk[] }) | null;
  model_id: string;
}

export default async function SharePage({
  params,
}: SharePageProps): Promise<React.ReactElement> {
  const token = params.token?.trim();
  if (!token) notFound();

  const supabase = getServerClient();

  const shareLookup = await supabase
    .from("shared_analyses")
    .select("id, share_token, analysis_id, view_count, created_at")
    .eq("share_token", token)
    .maybeSingle<SharedAnalysisRow>();

  if (isMigrationPending(shareLookup.error)) {
    return (
      <div className="mx-auto w-full max-w-[820px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
          Database setup
        </p>
        <h1 className="mt-3 text-[clamp(28px,3vw,40px)] font-semibold tracking-tight text-on-surface">
          Setup required
        </h1>
        <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-on-surface-variant">
          Public sharing requires the v2 database migration. Run{" "}
          <code className="rounded border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-elevated))] px-1.5 py-0.5 font-mono text-[13px] text-on-surface">
            migrations/002_advanced_features.sql
          </code>{" "}
          in your Supabase SQL editor.
        </p>
      </div>
    );
  }

  if (shareLookup.error || !shareLookup.data) notFound();

  const analysisLookup = await supabase
    .from("analysis_results")
    .select("id, scenario_input, result, model_id")
    .eq("id", shareLookup.data.analysis_id)
    .maybeSingle<AnalysisRow>();

  if (analysisLookup.error || !analysisLookup.data?.result) notFound();

  // Increment views atomically via the same Postgres RPC the API route
  // uses. The previous read-then-write update here was a race: concurrent
  // viewers all read the same count, computed +1, and overwrote —
  // undercounting badly on popular shares.
  let viewCount = (shareLookup.data.view_count ?? 0) + 1;
  try {
    const { data: incremented, error: incError } = await supabase.rpc(
      "increment_share_view_count",
      { p_token: token },
    );
    if (!incError && typeof incremented === "number") {
      viewCount = incremented;
    } else if (incError) {
      // RPC not defined yet (migration not applied) — fall back to the
      // non-atomic update. Best-effort; logs a warning.
      logger.warn("[share/page] increment RPC failed, falling back to naive update", {
        message: incError.message,
        code: incError.code,
      });
      void supabase
        .from("shared_analyses")
        .update({ view_count: viewCount })
        .eq("id", shareLookup.data.id);
    }
  } catch (err) {
    logger.warn("[share/page] increment RPC threw", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const scenario =
    (typeof analysisLookup.data.scenario_input?.scenario === "string"
      ? analysisLookup.data.scenario_input.scenario
      : "(scenario not recorded)") ?? "(scenario not recorded)";
  const retrievedChunks = analysisLookup.data.result.retrievedChunks ?? [];
  const { retrievedChunks: _omit, ...result } = analysisLookup.data.result;
  void _omit;

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <SharedAnalysisView
        token={token}
        scenario={scenario}
        modelId={analysisLookup.data.model_id}
        result={result as AnalysisResult}
        retrievedChunks={retrievedChunks}
        viewCount={viewCount}
        createdAt={shareLookup.data.created_at}
      />
    </div>
  );
}
