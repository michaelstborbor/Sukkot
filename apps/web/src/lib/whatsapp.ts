import { GENERAL_ENQUIRY } from "@sukkot/shared";

/** A listing page puts its WhatsApp message on the element with this id, so the corner button can send it. */
export const LISTING_MESSAGE_ID = "whatsapp-listing-message";

const HELLO = "Hello Sukkot Salone,";

// First match wins, so more specific paths come before the paths they start with.
const PAGE_MESSAGES: { match: (path: string) => boolean; message: string }[] = [
  { match: (p) => p === "/dashboard/properties/new", message: `${HELLO} I need help adding my property listing.` },
  { match: (p) => p.startsWith("/dashboard/properties/"), message: `${HELLO} I need help updating my property listing.` },
  { match: (p) => p === "/dashboard/properties", message: `${HELLO} I have a question about my listings.` },
  { match: (p) => p === "/list-your-property", message: `${HELLO} I would like to list my property. Can you help me get started?` },
  { match: (p) => p.startsWith("/properties/"), message: `${HELLO} I have a question about a property on your website.` },
  { match: (p) => p === "/properties" || p === "/compare", message: `${HELLO} I am looking for a property. Can you help me find one?` },
  { match: (p) => /^\/dashboard\/(payments|billing)(\/|$)/.test(p) || p.startsWith("/payments/"), message: `${HELLO} I have a question about a payment or my plan.` },
  { match: (p) => p.startsWith("/dashboard/inspections"), message: `${HELLO} I have a question about a property viewing.` },
  { match: (p) => p.startsWith("/dashboard/offers"), message: `${HELLO} I have a question about an offer.` },
  { match: (p) => p.startsWith("/dashboard/applications"), message: `${HELLO} I have a question about a rental application.` },
  { match: (p) => p === "/auth/sign-up", message: `${HELLO} I need help creating an account.` },
  { match: (p) => p.startsWith("/auth/"), message: `${HELLO} I need help signing in to my account.` },
  { match: (p) => p === "/help", message: `${HELLO} I could not find what I need on the help page. Can you help me?` },
  { match: (p) => p.startsWith("/agents"), message: `${HELLO} I would like help finding an agent.` },
  { match: (p) => p === "/verification" || p.startsWith("/dashboard/verification"), message: `${HELLO} I have a question about getting verified.` },
];

/**
 * The message typed into a WhatsApp chat started from the corner button, chosen by the page the visitor
 * is on. A listing page passes its own message naming the property, which is used instead.
 */
export function whatsappMessageFor(pathname: string, listingMessage?: string | null): string {
  if (listingMessage?.trim()) return listingMessage;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PAGE_MESSAGES.find((m) => m.match(path))?.message ?? GENERAL_ENQUIRY;
}
