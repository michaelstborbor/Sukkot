import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { brand } from "@/config/brand";
import { WhatsAppButton } from "@/components/layout/whatsapp-button";
import { HelpChat } from "@/components/layout/help-chat";
import "./globals.css";

// Fonts are bundled from src/fonts (SIL Open Font License) so builds never depend on Google Fonts being reachable.
const figtree = localFont({ src: "../fonts/figtree-latin-wght-normal.woff2", variable: "--font-figtree", display: "swap", weight: "300 900" });
const dmSerif = localFont({ src: "../fonts/dm-serif-display-latin-400-normal.woff2", variable: "--font-dm-serif", display: "swap", weight: "400" });

const appUrl = process.env.APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: `${brand.name} — Homes, land and property in Sierra Leone`, template: `%s · ${brand.name}` },
  description: "Find houses, apartments, land and commercial property for rent or sale across Sierra Leone. Contact owners and agents directly, book inspections and negotiate with confidence.",
  applicationName: brand.name,
  openGraph: { type: "website", siteName: brand.name, locale: "en_SL" },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#2B1B12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-SL" className={`${figtree.variable} ${dmSerif.variable}`}>
      <body>
        {children}
        <HelpChat />
        <WhatsAppButton />
        <Toaster position="top-center" richColors closeButton toastOptions={{ duration: 4500 }} />
      </body>
    </html>
  );
}
