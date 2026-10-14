/** Brand settings. Change these (or override via env) to rebrand without touching components. */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "Sukkot Salone",
  shortName: process.env.NEXT_PUBLIC_BRAND_SHORT_NAME || "Sukkot",
  tagline: "Trusted homes, land and spaces across Sierra Leone.",
  heroTitle: "Find your place in Salone.",
  heroSubtitle: "Houses, apartments, land and shops — from Freetown to Kenema, with checked listings and direct contact with owners and agents.",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.sl",
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || "+232 00 000 000",
  address: "Freetown, Sierra Leone",
  social: {
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL || "",
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "",
    whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_URL || "",
  },
};
