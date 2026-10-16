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
