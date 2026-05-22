import { notFound } from "next/navigation";

import { AnalysisView } from "@/components/AnalysisView";
import { isAnalysisOwner } from "@/lib/ownership";
import { readSessionId } from "@/lib/session";
import { getServerClient } from "@/lib/supabase";
import type {
  AnalysisResult,
  CrimeCategory,
  LawChunk,
  RetrievalResult,
} from "@/lib/types";

export const dynamic = "force-dynamic";

interface ResultsPageProps {
  params: { id: string };
}

interface AnalysisRow {
  id: string;
  scenario_input: {
    scenario?: string;
    modelId?: string;
    crimeCategory?: CrimeCategory;
  } | null;
  result:
    | (AnalysisResult & {
        retrievedChunks?: LawChunk[];
        retrieval?: RetrievalResult;
      })
    | null;
  model_id: string;
  created_at: string;
}

export default async function ResultsPage({
  params,
}: ResultsPageProps): Promise<React.ReactElement> {
  const id = params.id?.trim();
  if (!id) notFound();

  const sessionId = await readSessionId();
  if (!sessionId) notFound();

  const owns = await isAnalysisOwner(id, sessionId);
  if (!owns) notFound();

  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("analysis_results")
    .select("id, scenario_input, result, model_id, created_at")
    .eq("id", id)
    .maybeSingle<AnalysisRow>();

  if (error || !data || !data.result) notFound();

  const scenario =
    (typeof data.scenario_input?.scenario === "string"
      ? data.scenario_input.scenario
      : "(scenario not recorded)") ?? "(scenario not recorded)";
  const retrievedChunks = data.result.retrievedChunks ?? [];
  const retrieval = data.result.retrieval ?? {
    chunks: retrievedChunks,
    stage: 1 as const,
    maxSimilarity: retrievedChunks.reduce(
      (m, c) => (c.similarity > m ? c.similarity : m),
      0,
    ),
  };
  const crimeCategory = data.scenario_input?.crimeCategory ?? null;

  const { retrievedChunks: _omit, retrieval: _omitR, ...result } = data.result;
  void _omit;
  void _omitR;

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <AnalysisView
        resultId={data.id}
        modelId={data.model_id}
        scenario={scenario}
        result={result as AnalysisResult}
        retrievedChunks={retrievedChunks}
        retrieval={retrieval}
        crimeCategory={crimeCategory}
      />
    </div>
  );
}
