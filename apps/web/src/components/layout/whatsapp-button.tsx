"use client";

import { usePathname } from "next/navigation";
import { whatsappLink } from "@sukkot/shared";
import { brand } from "@/config/brand";
import { LISTING_MESSAGE_ID, whatsappMessageFor } from "@/lib/whatsapp";
import { WhatsAppIcon } from "./whatsapp-icon";

/** A "Chat on WhatsApp" button in the corner of every page. Its message fits the page; on a listing it names the property. */
export function WhatsAppButton() {
  const pathname = usePathname();
  // These screens keep their own buttons (send, next, submit) in that corner.
  if (["/dashboard/messages/", "/dashboard/properties/", "/admin"].some((p) => pathname.startsWith(p))) return null;
  return (
    <a
      href={whatsappLink(brand.supportWhatsapp, whatsappMessageFor(pathname))}
      onClick={(e) => {
        // Read at click time, so it is the listing on screen now.
        const listing = document.getElementById(LISTING_MESSAGE_ID)?.dataset.message;
        e.currentTarget.href = whatsappLink(brand.supportWhatsapp, whatsappMessageFor(pathname, listing));
      }}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with ${brand.name} on WhatsApp`}
      className="fixed right-4 z-[35] inline-flex items-center gap-2 rounded-full bg-[#118645] p-3.5 font-semibold text-white shadow-[var(--shadow-pop)] transition hover:scale-105 hover:bg-[#0f7a3d] focus-visible:ring-4 focus-visible:ring-[#118645]/40 focus-visible:outline-none active:scale-95 sm:px-5 sm:py-3"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <WhatsAppIcon className="h-7 w-7 sm:h-6 sm:w-6" />
      <span className="hidden sm:inline">Chat on WhatsApp</span>
    </a>
  );
}
