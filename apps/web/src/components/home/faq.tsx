import { ChevronDown } from "lucide-react";

const FAQS = [
  ["Is it free to search and contact owners?", "Yes. Browsing, saving properties, sending enquiries and booking inspections are free for tenants and buyers."],
  ["How do I list my property?", "Create an owner or agent account, add your property with photos and details, and submit it for review. A moderator checks it before it goes live, usually within one working day."],
  ["What does “Documents Reviewed” mean?", "Our verification team has looked at the ownership documents the lister supplied, such as a conveyance or survey plan, and found them consistent with the listing. It is not a legal title search and does not replace checks at the Ministry of Lands or advice from a lawyer."],
  ["How do inspections work?", "Request a time on the listing page. The owner or agent confirms, proposes another time, or declines, and you are notified. Always inspect before you pay anything, and bring someone with you."],
  ["Can I negotiate the price?", "Yes. Buyers can submit offers and counteroffers through the platform, and every step is recorded in a timeline. An offer accepted here is an agreement in principle only, not a contract or transfer of ownership."],
  ["How do payments work?", "Rent, deposits and sale payments go directly between the parties and can be recorded on the platform. Subscriptions and listing promotions can be paid with Orange Money or Afrimoney where enabled. We never mark a payment as paid until the provider confirms it."],
  ["What should I do if a listing looks suspicious?", "Use “Report listing” on the property page. Our team reviews every report, and listings can be suspended while we investigate."],
];

export function Faq() {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-white">
      {FAQS.map(([q, a]) => (
        <details key={q} className="group px-5 py-1 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-semibold text-navy-900">
            {q}
            <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden />
          </summary>
          <p className="pb-5 text-[15px] leading-relaxed text-muted">{a}</p>
        </details>
      ))}
    </div>
  );
}
