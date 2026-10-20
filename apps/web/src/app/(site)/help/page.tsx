import type { Metadata } from "next";
import Link from "next/link";
import { GENERAL_ENQUIRY, telLink, whatsappLink } from "@sukkot/shared";
import { brand } from "@/config/brand";
import { getCurrentActor } from "@/server/auth/actor";
import { ProsePage } from "@/components/layout/prose-page";
import { SupportForm } from "@/components/forms/support-form";

export const metadata: Metadata = { title: "Help centre", description: `Answers to common questions about renting, buying and listing on ${brand.name}.` };

const TOPICS: { q: string; a: React.ReactNode }[] = [
  { q: "How do I contact an owner or agent?", a: <>Open the listing and choose <strong>Send enquiry</strong>. Your message goes to the lister and the conversation is kept in <Link href="/dashboard/messages">Messages</Link>. To talk to someone, call or WhatsApp our team on {brand.supportPhone} and quote the listing&apos;s reference.</> },
  { q: "How do I book a viewing?", a: <>Choose <strong>Book an inspection</strong> on the listing and pick a time. Times are in Freetown time (GMT). A small booking fee (Le 250 to start) is paid to {brand.name} by Orange Money, Afrimoney or transfer; once it is confirmed, the owner or agent gets your request and confirms or proposes another time. You can also call or WhatsApp our team to book.</> },
  { q: "Can I pay rent through the website?", a: <>No. Rent, deposits and sale money are paid directly to the landlord or seller. You can record the payment in your dashboard so both sides have a record. We only take payments for our own fees, by Orange Money, Afrimoney, transfer or directly to our team.</> },
  { q: "What fees do tenants and buyers pay?", a: <>A booking fee when you book an inspection, and, once you have paid the rent, lease or purchase money to the landlord or seller, a {brand.name} service fee of 5% of that amount. It is not charged on security deposits. When the landlord or seller confirms your payment, the fee appears on your <Link href="/dashboard/payments">Payments</Link> page and you can pay it by mobile money, by transfer or directly to our team. See the <Link href="/refunds">refund policy</Link>.</> },
  { q: "Does an accepted offer mean I own the property?", a: <>No. An accepted offer is an agreement in principle. Ownership changes only through the legal process and land registration. Use a lawyer and complete due diligence first.</> },
  { q: "What do the verification badges mean?", a: <>See <Link href="/verification">how verification works</Link>. Badges show checks our team completed; they are not a guarantee of title.</> },
  { q: "How do I list a property?", a: <>Create an account, enable landlord or agent tools, then <Link href="/dashboard/properties/new">add a property</Link>. Every listing is reviewed before it goes live.</> },
  { q: "I think a listing is a scam.", a: <>Do not send money. Use <strong>Report listing</strong> on the listing page, or the form below. Our team reviews every report.</> },
];

export default async function HelpPage() {
  const actor = await getCurrentActor();
  return (
    <ProsePage eyebrow="Support" title="Help centre" intro="Quick answers, and a way to reach our team.">
      <h2>Common questions</h2>
      <div className="space-y-3">
        {TOPICS.map((t) => (
          <details key={t.q} className="rounded-xl border border-line bg-surface p-4">
            <summary className="cursor-pointer font-semibold text-navy-900">{t.q}</summary>
            <p className="mt-2">{t.a}</p>
          </details>
        ))}
      </div>
      <h2 id="report">Contact us or report a problem</h2>
      <p>For urgent safety issues, contact the police. For everything else, chat with us on WhatsApp at <a href={whatsappLink(brand.supportWhatsapp, GENERAL_ENQUIRY)} target="_blank" rel="noopener noreferrer">{brand.supportPhone}</a>, call <a href={telLink(brand.supportPhone)}>{brand.supportPhone}</a>, write to {brand.supportEmail}, or send us a message below and we will reply by email.</p>
      <div className="mt-4 rounded-2xl border border-line bg-canvas p-5">
        <SupportForm signedIn={!!actor} />
      </div>
    </ProsePage>
  );
}
