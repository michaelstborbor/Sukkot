"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Send } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime, type MessageDTO } from "@sukkot/shared";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { cn } from "@/lib/utils";

const POLL_MS = 8000;

/** Conversation view. Polls for new messages while the tab is visible. */
export function MessageThread({ conversationId, initial, canSend }: { conversationId: string; initial: MessageDTO[]; canSend: boolean }) {
  const [messages, setMessages] = useState(initial);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ messages: MessageDTO[] }>(`/conversations/${conversationId}`);
      setMessages(data.messages);
    } catch {
      /* transient; next poll retries */
    }
  }, [conversationId]);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      await api(`/conversations/${conversationId}/messages`, { body: { body: text } });
      setBody("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Message not sent");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card flex h-[calc(100dvh-16rem)] min-h-[420px] flex-col overflow-hidden">
      <ol className="flex-1 space-y-3 overflow-y-auto bg-canvas p-4" aria-live="polite">
        {messages.map((m) => {
          const system = m.senderName === "Sukkot Salone" && !m.fromMe;
          if (system)
            return (
              <li key={m.id} className="mx-auto max-w-md rounded-lg border border-navy-100 bg-navy-50 px-3 py-2 text-center text-xs text-navy-800">
                {m.body}
                <span className="mt-0.5 block text-[11px] text-muted">{formatDateTime(m.createdAt)}</span>
              </li>
            );
          return (
            <li key={m.id} className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%]", m.fromMe ? "rounded-br-sm bg-navy-900 text-white" : "rounded-bl-sm bg-surface text-ink")}>
                {!m.fromMe && <p className="mb-0.5 text-xs font-semibold text-emerald-700">{m.senderName}</p>}
                <p className="break-words whitespace-pre-wrap">{m.body}</p>
                <p className={cn("mt-1 flex items-center justify-end gap-1 text-[11px]", m.fromMe ? "text-white/70" : "text-muted")}>
                  {formatDateTime(m.createdAt)}
                  {m.fromMe && (m.readByOthers ? <CheckCheck className="h-3.5 w-3.5" aria-label="Read" /> : <Check className="h-3.5 w-3.5" aria-label="Sent" />)}
                </p>
              </div>
            </li>
          );
        })}
        <div ref={endRef} />
      </ol>
      {canSend ? (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-line bg-surface p-3">
          <label htmlFor="msg" className="sr-only">Message</label>
          <Textarea
            id="msg"
            rows={2}
            value={body}
            maxLength={4000}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement).requestSubmit();
              }
            }}
            placeholder="Write a message…"
            className="min-h-0 flex-1 resize-none"
          />
          <Button type="submit" loading={sending} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      ) : (
        <p className="border-t border-line bg-surface p-3 text-center text-sm text-muted">You are viewing this conversation as staff. Access is recorded.</p>
      )}
    </div>
  );
}
