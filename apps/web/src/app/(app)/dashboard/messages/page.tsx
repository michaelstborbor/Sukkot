import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { relativeTime } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { listConversations } from "@/server/services/messaging";
import { PageHeader } from "@/components/dashboard/shell";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const actor = await requirePageActor("/dashboard/messages");
  const conversations = await listConversations(actor);
  return (
    <>
      <PageHeader title="Messages" description="Keep conversations on Sukkot Salone. Never send money or personal documents to someone you have not verified." />
      {conversations.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title="No conversations yet"
          body="Send an enquiry from any listing to start a conversation."
          action={<ButtonLink href="/properties">Browse properties</ButtonLink>}
        />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {conversations.map((c) => {
            const name = c.otherParticipants.map((o) => o.name).join(", ") || "Conversation";
            return (
              <li key={c.id}>
                <Link href={`/dashboard/messages/${c.id}`} className={cn("flex gap-3 p-4 transition hover:bg-navy-50", c.unread > 0 && "bg-gold-50/50")}>
                  <Avatar name={name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={cn("truncate text-sm", c.unread > 0 ? "font-bold" : "font-semibold")}>{name}</p>
                      <span className="shrink-0 text-xs text-muted">{relativeTime(c.lastMessage?.at ?? c.updatedAt)}</span>
                    </div>
                    <p className="truncate text-xs text-muted">{c.property?.title ?? c.subject}</p>
                    {c.lastMessage && (
                      <p className={cn("mt-0.5 truncate text-sm", c.unread > 0 ? "text-ink" : "text-muted")}>
                        {c.lastMessage.fromMe ? "You: " : ""}
                        {c.lastMessage.body}
                      </p>
                    )}
                  </div>
                  {c.unread > 0 && <span className="self-center rounded-full bg-gold-500 px-2 text-xs font-bold text-navy-950">{c.unread}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
