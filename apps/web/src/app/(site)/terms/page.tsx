import type { Metadata } from "next";
import Link from "next/link";
import { NOTICES } from "@sukkot/shared";
import { brand } from "@/config/brand";
import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <ProsePage eyebrow="Legal" title="Terms of use" updated="14 October 2026" intro="Draft for legal review. By using the platform you agree to these terms.">
      <h2>1. The service</h2>
      <p>{brand.name} is a marketplace where owners and agents advertise property and tenants and buyers contact them. We are not a party to any tenancy or sale, and we are not an estate agent, lawyer or escrow agent.</p>
      <h2>2. Accounts</h2>
      <p>You must give accurate information and keep your password secure. You are responsible for activity on your account.</p>
      <h2>3. Listings</h2>
      <ul>
        <li>You may list only property you own or are authorised to market.</li>
        <li>Listings must be accurate, with real photos of the property.</li>
        <li>We may edit, refuse, suspend or remove any listing, and suspend accounts that break these terms.</li>
      </ul>
      <h2>4. Offers, applications and payments</h2>
      <p>{NOTICES.offerNotLegal}</p>
      <p>{NOTICES.noEscrow}</p>
      <p>{NOTICES.paymentHonesty}</p>
      <h2>5. Verification</h2>
      <p>{NOTICES.verificationLimits}</p>
      <h2>6. Prohibited conduct</h2>
      <ul>
        <li>Fraud, impersonation or requesting payment before inspection under false pretences.</li>
        <li>Harassment, discrimination or abusive messages.</li>
        <li>Scraping, spamming or interfering with the platform.</li>
      </ul>
      <h2>7. Plans, promotions, visits and listing slots</h2>
      <p>Paid plans, featured listings, inspection visits and extra listing slots start when the payment provider, or our finance team for a transfer, confirms payment. Prices are shown before you pay. Our <Link href="/refunds">refund policy</Link> says when you get your money back.</p>
      <h2>8. Liability</h2>
      <p>To the extent permitted by law, we are not liable for losses arising from dealings between users. Nothing in these terms limits rights you have under the laws of Sierra Leone.</p>
      <h2>9. Contact</h2>
      <p>{brand.supportEmail} · Phone and WhatsApp: {brand.supportPhone}</p>
    </ProsePage>
  );
}
