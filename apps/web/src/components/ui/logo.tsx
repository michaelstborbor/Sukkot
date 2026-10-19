import Link from "next/link";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  // A booth / shelter roof (sukkah) over a doorway: a home and a welcome.
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden>
      <rect width="40" height="40" rx="11" fill="#2B1B12" />
      <path d="M8 19 20 9l12 10" fill="none" stroke="#CD6A39" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 18v12h16V18" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M18 30v-6a2 2 0 0 1 4 0v6" fill="#457650" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label={`${brand.name} home`}>
      <span className={cn("font-display text-[1.65rem] leading-none", light ? "text-[#f9f4ec]" : "text-navy-900")}>
        {brand.shortName}
        <span className="text-clay-500">.</span>
      </span>
    </Link>
  );
}
