import Link from "next/link";
import { Mail, MapPin, Phone, ShieldAlert } from "lucide-react";
import { GENERAL_ENQUIRY, telLink, whatsappLink } from "@sukkot/shared";
import { brand } from "@/config/brand";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { Logo } from "@/components/ui/logo";

const COLS = [
  { title: "Discover", links: [["Homes for rent", "/properties?purpose=RENT"], ["Homes for sale", "/properties?purpose=SALE"], ["Land", "/properties?category=LAND"], ["Commercial", "/properties?category=COMMERCIAL"], ["Locations", "/locations"], ["Agents", "/agents"]] },
  { title: "Owners & agents", links: [["List a property", "/list-your-property"], ["Dashboard", "/dashboard"], ["Plans and pricing", "/dashboard/billing"], ["Verification", "/verification"]] },
  { title: "Help", links: [["Help centre", "/help"], ["Safety guidance", "/safety"], ["Report a problem", "/help#report"], ["Takedown requests", "/takedown"], ["Refund policy", "/refunds"], ["Get the app", "/get-the-app"], ["Privacy policy", "/privacy"], ["Terms of use", "/terms"]] },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-navy-900 text-[#f9f4ec]/80">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">{brand.tagline}</p>
          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-clay-500" aria-hidden />{brand.address}</li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-clay-500" aria-hidden /><a href={`mailto:${brand.supportEmail}`} className="hover:text-white">{brand.supportEmail}</a></li>
            <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-clay-500" aria-hidden /><a href={telLink(brand.supportPhone)} className="hover:text-white">{brand.supportPhone}</a></li>
            <li className="flex items-center gap-2"><WhatsAppIcon className="h-4 w-4 text-clay-500" /><a href={whatsappLink(brand.supportWhatsapp, GENERAL_ENQUIRY)} target="_blank" rel="noopener noreferrer" className="hover:text-white">Chat on WhatsApp</a></li>
          </ul>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h3 className="text-sm font-bold tracking-wide text-white uppercase">{c.title}</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="transition hover:text-white">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-3 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 sm:max-w-2xl">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-clay-500" aria-hidden />
            Stay safe: always inspect a property and confirm ownership documents with a lawyer before paying any money. {brand.name} does not hold client funds.
          </p>
          <p>© {new Date().getFullYear()} {brand.name}</p>
        </div>
      </div>
    </footer>
  );
}
