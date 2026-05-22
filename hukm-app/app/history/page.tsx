import { redirect } from "next/navigation";

import { HistoryList } from "@/components/HistoryList";
import { getOrCreateSessionId } from "@/lib/session";
import { getServerClient } from "@/lib/supabase";
import type { RecentConversationRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HistoryPage(): Promise<React.ReactElement> {
  // Ensure the session cookie exists; the rest of the page reads via the API.
  await getOrCreateSessionId();

  const sessionId = await getOrCreateSessionId();
  const supabase = getServerClient();
  const { data, error } = await supabase.rpc("get_recent_conversations", {
    p_session_id: sessionId,
    p_limit: 50,
  });

  if (error) {
    redirect("/");
  }

  const rows = ((data as RecentConversationRow[] | null) ?? []).filter(
    (row) => row && row.id,
  );

  // Filter soft-deleted rows in a second query (the RPC predates deleted_at).
  let visible = rows;
  if (rows.length > 0) {
    const ids = rows.map((row) => row.id);
    const { data: liveRows } = await supabase
      .from("conversations")
      .select("id, deleted_at")
      .in("id", ids)
      .returns<Array<{ id: string; deleted_at: string | null }>>();
    if (liveRows) {
      const liveSet = new Set(
        liveRows.filter((r) => r.deleted_at === null).map((r) => r.id),
      );
      visible = rows.filter((row) => liveSet.has(row.id));
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <HistoryList initialRows={visible} />
    </div>
  );
}
