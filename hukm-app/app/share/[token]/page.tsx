import { notFound } from "next/navigation";

import { SharedAnalysisView } from "@/components/SharedAnalysisView";
import { isMigrationPending } from "@/lib/dbErrors";
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

  // Increment views (best-effort).
  const newCount = (shareLookup.data.view_count ?? 0) + 1;
  await supabase
    .from("shared_analyses")
    .update({ view_count: newCount })
    .eq("id", shareLookup.data.id);

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
        viewCount={newCount}
        createdAt={shareLookup.data.created_at}
      />
    </div>
  );
}
