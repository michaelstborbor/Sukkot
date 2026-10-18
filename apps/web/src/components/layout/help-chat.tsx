"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircleQuestion, Send, X } from "lucide-react";
import { GENERAL_ENQUIRY, whatsappLink } from "@sukkot/shared";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/**
 * A small help assistant beside the WhatsApp button. It answers common questions from a fixed list
 * and turns "2 bedroom flat to rent in Lumley" into a search. It is automatic, says so, and hands
 * anything it cannot answer to a person on WhatsApp.
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

const WELCOME: Message = { from: "bot", text: `Hi, I'm the ${brand.shortName} helper. I give automatic answers to common questions, or tell me what kind of place you are looking for.` };

export function HelpChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages, open]);

  // Same screens as the WhatsApp button: these keep their own buttons in that corner.
  if (["/dashboard/messages/", "/dashboard/properties/", "/admin"].some((p) => pathname.startsWith(p))) return null;

  function ask(text: string) {
    const clean = text.trim().slice(0, 300);
    if (!clean) return;
    setMessages((m) => [...m, { from: "user", text: clean }, { from: "bot", ...answer(clean) }]);
    setDraft("");
  }

  const bottom = "calc(max(1rem, env(safe-area-inset-bottom)) + 4.5rem)";
  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label={`${brand.shortName} helper`}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          className="fixed right-4 z-[60] flex max-h-[min(70vh,calc(100dvh-19rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-pop)]"
          style={{ bottom: `calc(${bottom} + 4rem)` }}
        >
          <div className="flex items-center justify-between bg-navy-900 px-4 py-3 text-white">
            <div>
              <p className="font-semibold">{brand.shortName} helper</p>
              <p className="text-xs text-white/70">Automatic answers · not a person</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close helper" className="rounded-full p-1 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div ref={log} className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={cn("max-w-[85%] rounded-2xl px-3 py-2", m.from === "user" ? "ml-auto bg-emerald-600 text-white" : "bg-canvas text-ink")}>
                <p>{m.text}</p>
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
              maxLength={300}
              placeholder="Ask a question"
              aria-label="Your question"
              className="h-10 min-w-0 flex-1 rounded-full border border-line px-4 text-sm focus:border-navy-900 focus:outline-none"
            />
            <button type="submit" aria-label="Send" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-900 text-white hover:bg-navy-800">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close helper" : `Ask the ${brand.shortName} helper`}
        className="fixed right-4 z-[35] inline-flex items-center gap-2 rounded-full bg-navy-900 p-3.5 font-semibold text-white shadow-[var(--shadow-pop)] transition hover:scale-105 focus-visible:ring-4 focus-visible:ring-navy-900/30 focus-visible:outline-none active:scale-95 sm:px-5 sm:py-3"
        style={{ bottom }}
      >
        {open ? <X className="h-7 w-7 sm:h-6 sm:w-6" /> : <MessageCircleQuestion className="h-7 w-7 sm:h-6 sm:w-6" />}
        <span className="hidden sm:inline">Ask a question</span>
      </button>
    </>
  );
}
