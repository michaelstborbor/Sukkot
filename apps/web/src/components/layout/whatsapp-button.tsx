"use client";

import { usePathname } from "next/navigation";
import { GENERAL_ENQUIRY, whatsappLink } from "@sukkot/shared";
import { brand } from "@/config/brand";
import { LISTING_MESSAGE_ID } from "@/lib/whatsapp";
import { WhatsAppIcon } from "./whatsapp-icon";

/** A "Chat on WhatsApp" button in the corner of every page. On a listing it names the property. */
export function WhatsAppButton() {
  const pathname = usePathname();
  // The message screen has its own send button in that corner.
  if (pathname.startsWith("/dashboard/messages/")) return null;
  return (
    <a
      href={whatsappLink(brand.supportWhatsapp, GENERAL_ENQUIRY)}
      onClick={(e) => {
        const listing = document.getElementById(LISTING_MESSAGE_ID)?.dataset.message;
        e.currentTarget.href = whatsappLink(brand.supportWhatsapp, listing || GENERAL_ENQUIRY);
      }}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with ${brand.name} on WhatsApp`}
      className="fixed right-4 z-[35] inline-flex items-center gap-2 rounded-full bg-[#25D366] p-3.5 font-semibold text-white shadow-[var(--shadow-pop)] transition hover:scale-105 hover:bg-[#1ebe5b] focus-visible:ring-4 focus-visible:ring-[#25D366]/40 focus-visible:outline-none active:scale-95 sm:px-5 sm:py-3"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <WhatsAppIcon className="h-7 w-7 sm:h-6 sm:w-6" />
      <span className="hidden sm:inline">Chat on WhatsApp</span>
    </a>
  );
}
