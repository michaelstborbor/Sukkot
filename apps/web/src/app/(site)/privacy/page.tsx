import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <ProsePage eyebrow="Legal" title="Privacy policy" updated="20 October 2026" intro="Draft for legal review. This policy explains what personal information we collect and how we use it.">
      <h2>Who we are</h2>
      <p>{brand.name} operates an online property marketplace for Sierra Leone. Contact: {brand.supportEmail}, or phone and WhatsApp {brand.supportPhone}.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, email, phone number, password (stored only as a secure hash).</li>
        <li>Listing details, photos and documents you upload.</li>
        <li>Messages, enquiries, viewing requests, applications and offers you send through the platform.</li>
        <li>Verification documents, stored privately and seen only by authorised staff.</li>
        <li>Payment records: amounts, references and status. We do not store card numbers or mobile money PINs.</li>
        <li>Hotel and short-stay bookings: the guest&apos;s name, phone, email, travel dates and any requests. We pass these to the property so it can hold the room and receive the guest.</li>
        <li>Questions you type into the help assistant.</li>
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
      <p>Your name and listings are public. Your phone and WhatsApp numbers are not shown on listings; phone and WhatsApp enquiries go to our team. Messages are visible to the participants and, where needed to investigate a report, to authorised staff; such access is logged. We share data with service providers (hosting, email, payment providers) only as needed to run the service.</p>
      <h2>Services that process data for us</h2>
      <ul>
        <li>Hosting and file storage for the website, database, photos and documents.</li>
        <li>Email and text message delivery, for sign-in codes and notifications.</li>
        <li>Orange Money, Afrimoney and banks, when you pay us.</li>
        <li>An AI provider (Anthropic) answers questions in the help assistant when it is switched on. It receives only what you type there, not your account details. Do not type passwords, ID numbers or card numbers into it.</li>
      </ul>
      <p>Some of these services store data outside Sierra Leone. We use them only to run {brand.name}, never to sell your data or show you advertising.</p>
      <h2>Cookies and analytics</h2>
      <p>We use one cookie to keep you signed in and no analytics, advertising or tracking tools. Our <Link href="/cookies">cookie policy</Link> has the details.</p>
      <h2>What we do not collect</h2>
      <p>We ask only for what each feature needs. Phone numbers, photos and documents are optional unless a feature needs them, such as a phone number for a booking or documents for a verified badge.</p>
      <h2>How long we keep it</h2>
      <p>We keep account data while your account is open. When you close your account, we remove public content and keep records needed for legal, payment or dispute purposes for a limited period.</p>
      <h2>Your choices</h2>
      <p>You can update your profile and close your account from your dashboard. Contact us to request a copy of your data, to correct it, or to object to how we use it. We reply within 30 days.</p>
      <h2>Children</h2>
      <p>{brand.name} is for adults. You must be 18 or over to create an account.</p>
      <h2>Changes</h2>
      <p>If we change this policy in a way that affects you, we will tell you by email or in the app before the change takes effect.</p>
    </ProsePage>
  );
}
