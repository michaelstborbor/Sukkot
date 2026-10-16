import { SUPPORT_CONTACT } from "@sukkot/shared";

/** Brand settings. Change these (or override via env) to rebrand without touching components. */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "Sukkot Salone",
  shortName: process.env.NEXT_PUBLIC_BRAND_SHORT_NAME || "Sukkot",
  tagline: "Trusted homes, land and spaces across Sierra Leone.",
  heroTitle: "Find your place in Salone.",
  heroSubtitle: "Houses, apartments, land and shops — from Freetown to Kenema, with checked listings and direct contact with owners and agents.",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.sl",
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || SUPPORT_CONTACT.phone,
  /** The number people chat with on WhatsApp (the floating button, help pages, listings without a lister number). */
  supportWhatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || SUPPORT_CONTACT.whatsapp,
  address: "Freetown, Sierra Leone",
  social: {
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL || "",
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "",
    whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_URL || "",
  },
};
