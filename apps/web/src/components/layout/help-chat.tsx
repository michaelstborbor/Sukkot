"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircleQuestion, Send, X } from "lucide-react";
import { GENERAL_ENQUIRY, whatsappLink } from "@sukkot/shared";
import { brand } from "@/config/brand";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * The chat assistant beside the WhatsApp button. When the AI assistant is switched on (an API key is
 * set on the server) it holds a real conversation and searches listings. Otherwise it falls back to
 * fixed answers for common questions. Either way it says it is automatic and offers a person on
 * WhatsApp.
 */

interface Reply {
  text: string;
  links?: { label: string; href: string }[];
}
interface Message extends Reply {
  from: "user" | "bot";
}

const TOPICS: { label: string; words: RegExp; reply: Reply }[] = [
  {
    label: "How do I list a property?",
    words: /\b(list|advertise|post|sell my|rent out|landlord|agent account|add (a )?property)\b/i,
    reply: { text: "Create an account, switch on landlord or agent tools, then add your property with photos. Our team reviews every listing before it goes live.", links: [{ label: "List a property", href: "/list-your-property" }] },
  },
  {
    label: "Can I pay rent here?",
    words: /\b(pay|payment|rent money|deposit|mobile money|orange money|afrimoney|escrow)\b/i,
    reply: { text: "No. Rent, deposits and sale money go directly to the landlord or seller, never to us. Never pay before you have inspected the property and checked the documents. We only take payments for our own plans, promotions and inspection visits." },
  },
  {
    label: "How do I book a viewing?",
    words: /\b(view|viewing|visit|inspect|inspection|see the (house|property))\b/i,
    reply: { text: "Open the listing and choose Book an inspection, then pick a time (Freetown time). The lister confirms it or suggests another time." },
  },
  {
    label: "What do the badges mean?",
    words: /\b(verif|badge|trusted|inspected by|genuine|real listing)\w*/i,
    reply: { text: "Badges show checks our team has completed, such as identity or documents, and “Inspected by Sukkot” means our staff visited on the date shown. They are not a guarantee of title.", links: [{ label: "How verification works", href: "/verification" }] },
  },
  {
    label: "I think a listing is a scam",
    words: /\b(scam|fraud|fake|report|stolen|takedown|cheat)\b/i,
    reply: { text: "Do not send any money. Use Report listing on the listing page, or tell us below, and our team will review it.", links: [{ label: "Report a listing", href: "/takedown" }, { label: "Safety tips", href: "/safety" }] },
  },
  {
    label: "Refunds",
    words: /\b(refund|money back|cancel(led)? (my )?(plan|visit))\b/i,
    reply: { text: "Our refund policy explains when plan, promotion and inspection visit payments are refunded.", links: [{ label: "Refund policy", href: "/refunds" }] },
  },
  {
    label: "Is there an app?",
    words: /\b(app|android|iphone|ios|download|install)\b/i,
    reply: { text: "Yes. You can also add the website to your phone's home screen.", links: [{ label: "Get the app", href: "/get-the-app" }] },
  },
];

const PURPOSES: [RegExp, string][] = [
  [/\b(short[- ]?stay|per night|nightly|holiday|weekend)\b/i, "SHORT_STAY"],
  [/\b(buy|sale|for sale|purchase)\b/i, "SALE"],
  [/\b(lease)\b/i, "LEASE"],
  [/\b(rent|to let|renting)\b/i, "RENT"],
];
const CATEGORIES: [RegExp, string][] = [
  [/\b(land|plot|acre|town lot|farm)\b/i, "LAND"],
  [/\b(shop|office|warehouse|store|commercial|hotel|guesthouse|motel)\b/i, "COMMERCIAL"],
  [/\b(apartment|flat|studio|room)\b/i, "APARTMENT"],
  [/\b(house|home|bungalow|duplex|villa)\b/i, "HOUSE"],
];
const LOOKS_LIKE_SEARCH = /\b(rent|buy|sale|lease|house|home|flat|apartment|studio|room|land|plot|shop|office|warehouse|hotel|guesthouse|bed(room)?s?|short[- ]?stay)\b/i;

/** Turn a sentence such as "2 bedroom flat to rent in Lumley" into a listings search, or null. */
export function searchFromText(text: string): string | null {
  if (!LOOKS_LIKE_SEARCH.test(text)) return null;
  const params = new URLSearchParams();
  const purpose = PURPOSES.find(([re]) => re.test(text))?.[1];
  if (purpose) params.set("purpose", purpose);
  const category = CATEGORIES.find(([re]) => re.test(text))?.[1];
  if (category) params.set("category", category);
  const beds = text.match(/\b(\d{1,2})\s*-?\s*(bed|bedroom|bdr|br)s?\b/i);
  if (beds) params.set("beds", beds[1]!);
  const place = text.match(/\b(?:in|at|around|near)\s+([a-z][a-z' -]{1,40})/i)?.[1]?.trim().replace(/\s+(for|to|with|under|below)\b.*$/i, "");
  if (place) params.set("q", place);
  return `/properties${params.size ? `?${params}` : ""}`;
}

function answer(text: string): Reply {
  const topic = TOPICS.find((t) => t.words.test(text));
  if (topic) return topic.reply;
  const search = searchFromText(text);
  if (search) return { text: "Here are the listings that match. You can narrow them down further on the results page.", links: [{ label: "See matching listings", href: search }] };
  if (/\b(hello|hi|hey|good (morning|afternoon|evening))\b/i.test(text)) return { text: "Hello! Ask me about renting, buying or listing, or tell me what you are looking for, for example “2 bedroom flat to rent in Lumley”." };
  return { text: "Sorry, I can't answer that one. Our team can help on WhatsApp.", links: [{ label: "Chat with a person", href: whatsappLink(brand.supportWhatsapp, `${GENERAL_ENQUIRY} ${text}`.slice(0, 500)) }] };
}

const WELCOME: Message = { from: "bot", text: `Hi, I'm the ${brand.shortName} assistant. Ask me anything about renting, buying or listing property, or tell me what kind of place you are looking for.` };

/** Only site paths and a few well-known sites may be linked from an answer. */
function safeHref(url: string): string | null {
  if (/^\/(?!\/)/.test(url)) return url;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ["wa.me", "api.whatsapp.com"].includes(u.hostname) ? url : null;
  } catch {
    return url.startsWith("mailto:") ? url : null;
  }
}

/** Render answer text: paragraphs, "- " lists, **bold** and [label](url) links. Everything else is plain text. */
function RichText({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const inline = (line: string, key: string) =>
    line.split(/(\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*)/g).map((part, i) => {
      const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (link) {
        const href = safeHref(link[2]!);
        if (!href) return <span key={`${key}-${i}`}>{link[1]}</span>;
        return href.startsWith("/") ? (
          <Link key={`${key}-${i}`} href={href} onClick={onNavigate} className="link font-semibold">{link[1]}</Link>
        ) : (
          <a key={`${key}-${i}`} href={href} target="_blank" rel="noopener noreferrer" className="link font-semibold">{link[1]}</a>
        );
      }
      const bold = part.match(/^\*\*([^*]+)\*\*$/);
      return bold ? <strong key={`${key}-${i}`}>{bold[1]}</strong> : part;
    });
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((block, b) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (lines.length && lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
          return (
            <ul key={b} className="list-disc space-y-1 pl-4">
              {lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""), `${b}-${i}`)}</li>)}
            </ul>
          );
        }
        return <p key={b}>{lines.map((l, i) => <span key={i}>{i > 0 && <br />}{inline(l, `${b}-${i}`)}</span>)}</p>;
      })}
    </div>
  );
}

export function HelpChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [draft, setDraft] = useState("");
  const [ai, setAi] = useState<boolean | null>(null);
  const [thinking, setThinking] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
    if (open && ai === null) api<{ available: boolean }>("/assistant").then((r) => setAi(r.available), () => setAi(false));
  }, [open, ai]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages, open, thinking]);

  // Same screens as the WhatsApp button: these keep their own buttons in that corner.
  if (["/dashboard/messages/", "/dashboard/properties/", "/admin"].some((p) => pathname.startsWith(p))) return null;

  async function ask(text: string) {
    const clean = text.trim().slice(0, 1000);
    if (!clean || thinking) return;
    setDraft("");
    if (!ai) {
      setMessages((m) => [...m, { from: "user", text: clean }, { from: "bot", ...answer(clean) }]);
      return;
    }
    const next: Message[] = [...messages, { from: "user", text: clean }];
    setMessages(next);
    setThinking(true);
    try {
      // The welcome line is ours, not the model's, so the conversation sent starts with the visitor.
      const history = next.slice(1).slice(-20).map((m) => ({ role: m.from === "user" ? ("user" as const) : ("assistant" as const), content: m.text.slice(0, 2000) }));
      const { reply } = await api<{ reply: string }>("/assistant", { body: { messages: history, page: pathname } });
      setMessages((m) => [...m, { from: "bot", text: reply }]);
    } catch (err) {
      const msg = err instanceof ApiError && err.code === "RATE_LIMITED" ? "You've asked a lot of questions in a short time. Please wait a few minutes and try again." : "Sorry, something went wrong. Please try again.";
      setMessages((m) => [...m, { from: "bot", text: msg, links: [{ label: "Chat with a person", href: whatsappLink(brand.supportWhatsapp, `${GENERAL_ENQUIRY} ${clean}`.slice(0, 500)) }] }]);
    } finally {
      setThinking(false);
    }
  }

  const bottom = "calc(max(1rem, env(safe-area-inset-bottom)) + 4.5rem)";
  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label={`${brand.shortName} assistant`}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          className="fixed right-4 z-[60] flex max-h-[min(70vh,calc(100dvh-19rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)]"
          style={{ bottom: `calc(${bottom} + 4rem)` }}
        >
          <div className="flex items-center justify-between bg-navy-900 px-4 py-3 text-white">
            <div>
              <p className="font-semibold">{brand.shortName} assistant</p>
              <p className="text-xs text-white/70">{ai ? "AI assistant · not a person · can make mistakes" : "Automatic answers · not a person"}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-full p-1 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div ref={log} className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={cn("max-w-[85%] rounded-2xl px-3 py-2", m.from === "user" ? "ml-auto bg-emerald-600 text-white" : "bg-canvas text-ink")}>
                {m.from === "bot" ? <RichText text={m.text} onNavigate={() => setOpen(false)} /> : <p className="whitespace-pre-wrap">{m.text}</p>}
                {m.links && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.links.map((l) =>
                      l.href.startsWith("/") ? (
                        <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="link font-semibold">
                          {l.label}
                        </Link>
                      ) : (
                        <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="link font-semibold">
                          {l.label}
                        </a>
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}
            {thinking && (
              <div className="inline-flex items-center gap-1 rounded-2xl bg-canvas px-3 py-3" role="status" aria-label="The assistant is typing">
                {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            )}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {TOPICS.slice(0, 5).map((t) => (
                  <button key={t.label} type="button" onClick={() => ask(t.label)} className="rounded-full border border-line px-3 py-1 text-xs font-medium text-navy-900 hover:bg-canvas">
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <form
            className="flex gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
          >
            <input
              ref={input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={1000}
              placeholder={thinking ? "Waiting for the answer…" : "Ask a question"}
              aria-label="Your question"
              className="h-10 min-w-0 flex-1 rounded-full border border-line px-4 text-sm focus:border-navy-900 focus:outline-none"
            />
            <button type="submit" aria-label="Send" disabled={thinking || !draft.trim()} className="disabled:opacity-50 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-900 text-white hover:bg-navy-800">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close assistant" : `Ask the ${brand.shortName} assistant`}
        className="fixed right-4 z-[35] inline-flex items-center gap-2 rounded-full bg-navy-900 p-3.5 font-semibold text-white shadow-[var(--shadow-pop)] transition hover:scale-105 focus-visible:ring-4 focus-visible:ring-navy-900/30 focus-visible:outline-none active:scale-95 sm:px-5 sm:py-3"
        style={{ bottom }}
      >
        {open ? <X className="h-7 w-7 sm:h-6 sm:w-6" /> : <MessageCircleQuestion className="h-7 w-7 sm:h-6 sm:w-6" />}
        <span className="hidden sm:inline">Ask a question</span>
      </button>
    </>
  );
}
