import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "About us" };

export default function AboutPage() {
  return (
    <ProsePage eyebrow="About" title={`About ${brand.name}`} intro={brand.tagline}>
      <p>Finding a home or a plot of land in Sierra Leone often means word of mouth, middlemen and money paid before anything is checked. {brand.name} is built to make that safer and simpler.</p>
      <p>Every listing is reviewed before it goes live. Listers can verify their identity, credentials and documents. Tenants and buyers can message, book viewings, apply and make offers in one place, with a clear record of what was agreed.</p>
      <p>We never hold your money. Rent and sale payments go directly between the parties, and we show clearly what has and has not been verified.</p>
      <p><Link href="/properties">Browse properties</Link> or <Link href="/list-your-property">list your own</Link>.</p>
    </ProsePage>
  );
}
