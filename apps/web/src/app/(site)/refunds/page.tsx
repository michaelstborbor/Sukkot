import type { Metadata } from "next";
import Link from "next/link";
import { GENERAL_ENQUIRY, whatsappLink } from "@sukkot/shared";
import { brand } from "@/config/brand";
import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Refund policy", description: "When you get your money back for plans, featured listings, inspection visits, photo shoots and extra listing slots." };

export default function RefundsPage() {
  return (
    <ProsePage eyebrow="Legal" title="Refund policy" updated="20 October 2026" intro="Draft for legal review. This covers the things you pay Sukkot Salone for. It does not cover rent, deposits or sale money, which you pay directly to the other party.">
      <h2>1. What we charge for</h2>
      <ul>
        <li>Monthly plans for landlords and agents.</li>
        <li>Featured listings for 7 days.</li>
        <li>Inspection visits, where our staff check and photograph a property.</li>
        <li>Professional photos and video for a new listing (photo shoots).</li>
        <li>Extra listing slots.</li>
      </ul>
      <p>
        {brand.name} never collects or holds rent, deposits or sale money. If anyone asks you to pay rent or a deposit to {brand.name}, do not pay and <Link href="/takedown">report it</Link>.
      </p>
      <h2>2. When you get a full refund</h2>
      <ul>
        <li>You were charged twice, or charged the wrong amount.</li>
        <li>You paid but what you bought never started, and we cannot fix it.</li>
        <li>We cancel an inspection visit, or cannot agree a date and visit within 14 days of your payment.</li>
        <li>You cancel an inspection visit before the day of the visit.</li>
        <li>We suspended or removed your listing by mistake while a plan or featured period was running. We refund the unused part.</li>
      </ul>
      <h2>3. When there is no refund</h2>
      <ul>
        <li>A plan or featured period that has started and run as described.</li>
        <li>An inspection visit that took place, or that failed on the day because nobody let our staff in.</li>
        <li>A photo shoot. Its fee is non-refundable, unless you were charged twice or the wrong amount, or we cancel the shoot ourselves.</li>
        <li>An extra listing slot, unless you were charged in error.</li>
        <li>A listing taken down for breaking our <Link href="/terms">terms of use</Link>.</li>
      </ul>
      <h2>4. How to ask</h2>
      <p>
        Send us the payment reference (it starts with PAY- and is on your Payments page) and say what went wrong, by{" "}
        <a href={whatsappLink(brand.supportWhatsapp, GENERAL_ENQUIRY)} target="_blank" rel="noopener noreferrer">WhatsApp on {brand.supportPhone}</a> or email to{" "}
        <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>.
      </p>
      <h2>5. How you are paid back</h2>
      <p>
        We send the money back to the Orange Money or Afrimoney number or bank account it came from, in the same currency. We aim to do this within 7 working days of agreeing the refund. When it is sent, you get a notification with the refund transaction ID and the payment shows as refunded.
      </p>
      <h2>6. Your rights</h2>
      <p>Nothing in this policy limits rights you have under the laws of Sierra Leone.</p>
    </ProsePage>
  );
}
