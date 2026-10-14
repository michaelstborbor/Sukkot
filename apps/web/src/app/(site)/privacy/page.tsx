import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <ProsePage eyebrow="Legal" title="Privacy policy" updated="14 October 2026" intro="Draft for legal review. This policy explains what personal information we collect and how we use it.">
      <h2>Who we are</h2>
      <p>{brand.name} operates an online property marketplace for Sierra Leone. Contact: {brand.supportEmail}.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, email, phone number, password (stored only as a secure hash).</li>
        <li>Listing details, photos and documents you upload.</li>
        <li>Messages, enquiries, viewing requests, applications and offers you send through the platform.</li>
        <li>Verification documents, stored privately and seen only by authorised staff.</li>
        <li>Payment records: amounts, references and status. We do not store card numbers or mobile money PINs.</li>
        <li>Technical data such as a hashed IP address for security and abuse prevention.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To run the marketplace and connect tenants and buyers with listers.</li>
        <li>To review listings and verification requests and prevent fraud.</li>
        <li>To send notifications about your account and activity.</li>
        <li>To meet legal obligations and resolve disputes.</li>
      </ul>
      <h2>Who can see your information</h2>
      <p>Your name and listings are public. Your phone number is shown only if you choose. Messages are visible to the participants and, where needed to investigate a report, to authorised staff; such access is logged. We share data with service providers (hosting, email, payment providers) only as needed to run the service.</p>
      <h2>How long we keep it</h2>
      <p>We keep account data while your account is open. When you close your account, we remove public content and keep records needed for legal, payment or dispute purposes for a limited period.</p>
      <h2>Your choices</h2>
      <p>You can update your profile, hide your phone number, and close your account from your dashboard. Contact us to request a copy of your data or to correct it.</p>
    </ProsePage>
  );
}
