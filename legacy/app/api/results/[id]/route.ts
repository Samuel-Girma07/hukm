/**
 * GET /api/results/[id]
 *
 * Returns a persisted analysis result for the calling session.
 * RLS is locked down server-side; ownership is enforced in code.
 */

import { NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { getServerClient } from "@/lib/supabase";
import {
  assertOwnsAnalysisResult,
  OwnershipError,
} from "@/lib/ownership";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const sessionId = await getSessionId();
    const supabase = getServerClient();

    await assertOwnsAnalysisResult(supabase, params.id, sessionId);

    const { data, error } = await supabase
      .from("analysis_results")
      .select("id, scenario_input, result, model_id, created_at")
      .eq("id", params.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: "Result not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status },
      );
    }
    logger.error("GET /api/results/[id] failed:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
