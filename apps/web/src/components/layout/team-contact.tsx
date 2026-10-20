import { Phone } from "lucide-react";
import { telLink, whatsappLink } from "@sukkot/shared";
import { brand } from "@/config/brand";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** "Chat with us on WhatsApp" and "Call us" buttons for the Sukkot Salone team's number. */
export function TeamContactButtons({ message, label = "Questions? Talk to the Sukkot Salone team", className }: { message: string; label?: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface p-4", className)}>
      <p className="mb-2 text-sm text-muted">{label}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <a href={whatsappLink(brand.supportWhatsapp, message)} target="_blank" rel="noopener noreferrer" className={buttonClasses("primary", "md", "bg-[#118645] hover:bg-[#0f7a3d]")}>
          <WhatsAppIcon className="h-4 w-4" /> Chat with us on WhatsApp
        </a>
        <a href={telLink(brand.supportPhone)} className={buttonClasses("outline", "md")}>
          <Phone className="h-4 w-4" /> Call us · {brand.supportPhone}
        </a>
      </div>
    </div>
  );
}
