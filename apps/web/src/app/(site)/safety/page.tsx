import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Safety guidance", description: "How to rent and buy property safely in Sierra Leone." };

export default function SafetyPage() {
  return (
    <ProsePage eyebrow="Stay safe" title="Renting and buying safely" intro="Most property fraud follows the same pattern: pressure to pay before you have seen the property or the documents. These steps protect you.">
      <h2>Before you pay anything</h2>
      <ul>
        <li>Inspect the property in person, or send someone you trust.</li>
        <li>Ask to see the owner&apos;s identity document and the title documents, and check that the names match.</li>
        <li>For land and purchases, have a lawyer run an official search at the Ministry of Lands before any payment.</li>
        <li>Be wary of prices far below similar properties, and of anyone who says other people are about to pay.</li>
        <li>Never pay a &ldquo;viewing fee&rdquo; or &ldquo;booking fee&rdquo; to someone you have only met online.</li>
      </ul>
      <h2>At a viewing</h2>
      <ul>
        <li>Go in daylight and bring someone with you. Tell a friend where you are going.</li>
        <li>Confirm the representative&apos;s name matches the listing or the confirmation in your dashboard.</li>
        <li>Check water supply, electricity, access roads and drainage, especially before the rainy season.</li>
      </ul>
      <h2>When you agree</h2>
      <ul>
        <li>Get a written tenancy agreement or sale agreement. Read it fully before signing.</li>
        <li>Pay by a traceable method such as bank transfer or mobile money, and keep the transaction ID.</li>
        <li>Record the payment in your Sukkot Salone dashboard so both sides have the same record.</li>
      </ul>
      <h2>What Sukkot Salone does and does not do</h2>
      <p>We review listings before they go live, check identity and documents for verified badges, and remove listings and accounts that break our rules. We do not hold money, act as an escrow agent, or guarantee legal title.</p>
      <p>If something feels wrong, <Link href="/help#report">tell us</Link>.</p>
    </ProsePage>
  );
}
