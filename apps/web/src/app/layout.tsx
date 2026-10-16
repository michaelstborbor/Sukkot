import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { brand } from "@/config/brand";
import { WhatsAppButton } from "@/components/layout/whatsapp-button";
import "./globals.css";

// Fonts are bundled from src/fonts (SIL Open Font License) so builds never depend on Google Fonts being reachable.
const jakarta = localFont({ src: "../fonts/plus-jakarta-sans-latin-wght-normal.woff2", variable: "--font-jakarta", display: "swap", weight: "200 800" });
const fraunces = localFont({ src: "../fonts/fraunces-latin-wght-normal.woff2", variable: "--font-fraunces", display: "swap", weight: "100 900" });

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
  themeColor: "#0B1F3A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-SL" className={`${jakarta.variable} ${fraunces.variable}`}>
      <body>
        {children}
        <WhatsAppButton />
        <Toaster position="top-center" richColors closeButton toastOptions={{ duration: 4500 }} />
      </body>
    </html>
  );
}
