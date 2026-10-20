import type { Metadata } from "next";
import Link from "next/link";
import { GENERAL_ENQUIRY, whatsappLink } from "@sukkot/shared";
import { brand } from "@/config/brand";
import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Refund policy", description: "When you get your money back for plans, featured listings, visits, photo shoots, listing slots, booking fees, service fees and hotel and short-stay bookings." };

export default function RefundsPage() {
  return (
    <ProsePage eyebrow="Legal" title="Refund policy" updated="20 October 2026" intro="Draft for legal review. This covers the things you pay Sukkot Salone for, including hotel and short-stay bookings. It does not cover rent, deposits or sale money, which you pay directly to the other party.">
      <h2>1. What we charge for</h2>
      <ul>
        <li>Monthly plans for landlords and agent packages.</li>
        <li>Featured listings for 7 days.</li>
        <li>Inspection visits, where our staff check and photograph a property.</li>
        <li>Professional photos and video for a new listing (photo shoots).</li>
        <li>Extra listing slots.</li>
        <li>The booking fee a tenant or buyer pays to book an inspection of a listing.</li>
        <li>Our service fee, a percentage of rent, lease or purchase money, due once that money has been paid to the landlord or seller.</li>
        <li>Hotel, guest house, motel and short-stay bookings, paid to us after the property confirms the room.</li>
        <li>The listing fee for a hotel, guest house, motel or short-stay home, which includes professional photos and video.</li>
      </ul>
      <p>
        Apart from hotel and short-stay bookings, {brand.name} never collects or holds rent, deposits or sale money. If anyone asks you to pay rent or a deposit to {brand.name}, do not pay and <Link href="/takedown">report it</Link>.
      </p>
      <h2>2. When you get a full refund</h2>
      <ul>
        <li>You were charged twice, or charged the wrong amount.</li>
        <li>You paid but what you bought never started, and we cannot fix it.</li>
        <li>We cancel an inspection visit, or cannot agree a date and visit within 14 days of your payment.</li>
        <li>You cancel an inspection visit before the day of the visit.</li>
        <li>The owner or agent declines or cancels your booked inspection, or the property is let or sold before it.</li>
        <li>The rent, lease or sale payment a service fee was charged on is cancelled or refunded to you.</li>
        <li>We suspended or removed your listing by mistake while a plan or featured period was running. We refund the unused part.</li>
      </ul>
      <h2>3. When there is no refund</h2>
      <ul>
        <li>A plan or featured period that has started and run as described.</li>
        <li>An inspection visit that took place, or that failed on the day because nobody let our staff in.</li>
        <li>A photo shoot. Its fee is non-refundable, unless you were charged twice or the wrong amount, or we cancel the shoot ourselves.</li>
        <li>An extra listing slot, unless you were charged in error.</li>
        <li>An inspection booking fee once the inspection has taken place, or when you cancel on the day or do not turn up.</li>
        <li>A service fee on rent, lease or sale money that was paid as agreed.</li>
        <li>A listing taken down for breaking our <Link href="/terms">terms of use</Link>.</li>
      </ul>
      <h2>4. Hotel and short-stay bookings</h2>
      <p>Each booking shows its cancellation policy before you ask for it, and again on your receipt. The refund depends on when you cancel, counted in days before check-in:</p>
      <ul>
        <li>Flexible: full refund up to the day before check-in.</li>
        <li>Moderate: full refund 7 days or more before check-in, half after that.</li>
        <li>Strict: half refunded 14 days or more before check-in, nothing after that.</li>
        <li>Non-refundable: no refund.</li>
      </ul>
      <p>The late booking charge is not refunded when you cancel. You get everything back, whatever the policy, if the property cannot honour a confirmed booking or we cancel it. If you do not arrive and do not cancel, the property may record a no-show and nothing is refunded. You cannot cancel online from the day of check-in; contact us instead.</p>
      <h2>5. How to ask</h2>
      <p>
        Send us the payment reference (it starts with PAY- and is on your Payments page) and say what went wrong, by{" "}
        <a href={whatsappLink(brand.supportWhatsapp, GENERAL_ENQUIRY)} target="_blank" rel="noopener noreferrer">WhatsApp on {brand.supportPhone}</a> or email to{" "}
        <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>.
      </p>
      <h2>6. How you are paid back</h2>
      <p>
        We send the money back to the Orange Money or Afrimoney number or bank account it came from, in the same currency. We aim to do this within 7 working days of agreeing the refund. When it is sent, you get a notification with the refund transaction ID and the payment shows as refunded.
      </p>
      <h2>7. Your rights</h2>
      <p>Nothing in this policy limits rights you have under the laws of Sierra Leone.</p>
    </ProsePage>
  );
}
