import { notFound, redirect } from "next/navigation";

import { ChatInterface } from "@/components/ChatInterface";
import { isConversationOwner } from "@/lib/ownership";
import { getOrCreateSessionId } from "@/lib/session";
import { getServerClient } from "@/lib/supabase";
import type { ConfidenceLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ChatPageProps {
  params: { conversationId: string };
}

interface ConversationRow {
  id: string;
  scenario_description: string | null;
  model_id: string;
  confidence_level: ConfidenceLevel | null;
  is_civil_matter: boolean;
  needs_clarification: boolean;
}

interface MessageRow {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export default async function ChatPage({
  params,
}: ChatPageProps): Promise<React.ReactElement> {
  const conversationId = params.conversationId?.trim();
  if (!conversationId) notFound();

  // Read the authenticated user's id. If they're not logged in, redirect
  // to /onboarding instead of throwing a 500 — anonymous users can't own
  // a conversation anyway, so we never want them on this page.
  const sessionId = await getOrCreateSessionId();
  if (!sessionId) {
    redirect("/onboarding");
  }

  const owns = await isConversationOwner(conversationId, sessionId);
  if (!owns) notFound();

  const supabase = getServerClient();
  const conversationLookup = await supabase
    .from("conversations")
    .select(
      "id, scenario_description, model_id, confidence_level, is_civil_matter, needs_clarification",
    )
    .eq("id", conversationId)
    .maybeSingle<ConversationRow>();

  if (conversationLookup.error || !conversationLookup.data) notFound();

  const messagesLookup = await supabase
    .from("messages")
    .select("id, role, content, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .returns<MessageRow[]>();

  const messages = messagesLookup.data ?? [];

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <ChatInterface
        conversation={conversationLookup.data}
        initialMessages={messages}
        sessionId={sessionId}
      />
    </div>
  );
}
