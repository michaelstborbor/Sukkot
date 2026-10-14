import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NOTICES } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { AppError } from "@/server/errors";
import { getConversation } from "@/server/services/messaging";
import { MessageThread } from "@/components/dashboard/message-thread";
import { ActionButton } from "@/components/dashboard/action-button";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePageActor(`/dashboard/messages/${id}`);
  const c = await getConversation(actor, id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  });
  const others = c.participants.filter((p) => p.id !== actor.id);
  return (
    <>
      <Link href="/dashboard/messages" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All messages
      </Link>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">{others.map((o) => o.name).join(", ") || c.subject}</h1>
          {c.property ? (
            <Link href={`/properties/${c.property.slug}`} className="link text-sm">{c.property.title}</Link>
          ) : (
            <p className="text-sm text-muted">{c.subject}</p>
          )}
        </div>
        {c.isParticipant && others[0] && (
          <ActionButton path={`/users/${others[0].id}/block`} label="Block user" variant="ghost" confirm="They will no longer be able to message you. You can report them from the listing page." success="User blocked" />
        )}
      </div>
      <Notice tone="warning" className="mb-4 text-xs">{NOTICES.inspectionSafety}</Notice>
      <MessageThread conversationId={c.id} initial={c.messages} canSend={c.isParticipant} />
    </>
  );
}
