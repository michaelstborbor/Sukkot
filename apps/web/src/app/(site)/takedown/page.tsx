import type { Metadata } from "next";
import Link from "next/link";
import { GENERAL_ENQUIRY, whatsappLink } from "@sukkot/shared";
import { brand } from "@/config/brand";
import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Takedown requests", description: "How to ask us to take down a listing that is fake, unauthorised, out of date or uses your photos or details." };

export default function TakedownPage() {
  return (
    <ProsePage eyebrow="Trust and safety" title="Takedown requests" updated="18 October 2026" intro="Ask us to take a listing down if it is a scam, was posted without the owner's permission, is no longer available, or uses your photos or personal details.">
      <h2>1. Who can ask</h2>
      <ul>
        <li>An owner whose property is listed without their permission.</li>
        <li>Anyone who believes a listing is a scam, for example someone asking for money before a viewing.</li>
        <li>Anyone who knows a property is already rented or sold.</li>
        <li>A person whose photos, name or phone number appear in a listing without their consent.</li>
      </ul>
      <h2>2. How to ask</h2>
      <p>
        The quickest way is the <strong>Report listing</strong> link at the bottom of the contact box on the listing page. You can also send us the listing&apos;s link or its reference (it starts with SS-) by{" "}
        <a href={whatsappLink(brand.supportWhatsapp, GENERAL_ENQUIRY)} target="_blank" rel="noopener noreferrer">WhatsApp on {brand.supportPhone}</a> or email to{" "}
        <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>.
      </p>
      <p>Tell us who you are, what is wrong, and anything that shows it, such as a photo of a document. Send copies only, never original documents, and never pay anyone to have a listing removed.</p>
      <h2>3. What we do</h2>
      <ol>
        <li>A moderator looks at every request. We aim to do this within 2 working days, and sooner when it looks like fraud.</li>
        <li>If the claim is credible, we suspend the listing straight away so nobody else can be misled while we check.</li>
        <li>We ask the lister for their side, and for proof that they may list the property.</li>
        <li>We then remove the listing, ask for changes, or put it back, and tell you what we decided.</li>
      </ol>
      <p>Accounts that post fake or unauthorised listings are suspended. Where money was taken, we encourage you to report it to the Sierra Leone Police as well.</p>
      <h2>4. If your listing was taken down</h2>
      <p>
        You can see the moderator&apos;s reason on the listing in your dashboard. If you believe it is a mistake, reply with proof of your authority to list, such as the owner&apos;s written permission, through <Link href="/dashboard/verification">Verification</Link> or by contacting us.
      </p>
      <h2>5. Related</h2>
      <p>
        <Link href="/safety">Safety guidance</Link> · <Link href="/refunds">Refund policy</Link> · <Link href="/privacy">Privacy policy</Link>
      </p>
    </ProsePage>
  );
}
