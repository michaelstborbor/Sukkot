/** How people reach the Sukkot Salone team. Shared by the website and the phone app. */
export const SUPPORT_CONTACT = {
  /** As shown to people. */
  phone: "+232 78 604374",
  /** For tel: links. */
  phoneE164: "+23278604374",
  /** The same number takes WhatsApp chats. */
  whatsapp: "+23278604374",
} as const;

/** A wa.me link that opens a WhatsApp chat with `number`, optionally with a message typed in. */
export function whatsappLink(number: string, text?: string) {
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** A tel: link for a phone number written with spaces. */
export function telLink(number: string) {
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}

/** The message typed into a WhatsApp chat that is not about a particular listing. */
export const GENERAL_ENQUIRY = "Hello Sukkot Salone, I have a question.";

/** Where a listing is, as shown on its card: "Aberdeen, Freetown · Western Area Urban". */
export function listingPlace(p: { locationLabel: string; district: string | null }) {
  return p.district && !p.locationLabel.includes(p.district) ? `${p.locationLabel} · ${p.district}` : p.locationLabel;
}

/** The message typed into a WhatsApp chat started from a listing, naming the property so the team knows which one. */
export function listingEnquiry(
  p: { title: string; typeName: string; locationLabel: string; district: string | null; price: { formatted: string } },
  link?: string,
) {
  return [
    `Hello Sukkot Salone, I saw this ${p.typeName.toLowerCase()} and I'd like to know more about it.`,
    "",
    p.title,
    `Type: ${p.typeName}`,
    `Location: ${listingPlace(p)}`,
    `Price: ${p.price.formatted}`,
    ...(link ? [link] : []),
    "",
    "Is it still available?",
  ].join("\n");
}

export const HIDDEN_NUMBER = "[number hidden: use the Call or WhatsApp buttons]";

// Sierra Leone numbers as listers type them: +232 76 123 456, 00232-76-123456, 076 123 456, 76123456.
const PHONE_PATTERNS = [
  /(?:\+|\b00)\s?232[\s.-]?(?:\(0\)|0)?[\s.-]?\d(?:[\s.-]?\d){7}\b/g,
  /\b232[\s.-]?\d(?:[\s.-]?\d){7}\b/g,
  /\b0[2-9]\d[\s.-]?\d{3}[\s.-]?\d{3}\b/g,
  // A bare 8-digit mobile number, but not an amount such as "Le 30 000 000".
  /(?<!(?:Le|SLE|NLe|USD|US\$|\$)\s?)\b(?:3[0-4]|7[2-9]|8[0-8]|99)[\s.-]?\d{3}[\s.-]?\d{3}\b/g,
];

/**
 * Takes listers' own phone numbers out of public listing text: enquiries for every listing go through
 * the Sukkot Salone team's Call and WhatsApp buttons.
 */
export function hidePhoneNumbers(text: string) {
  return PHONE_PATTERNS.reduce((t, re) => t.replace(re, HIDDEN_NUMBER), text);
}
