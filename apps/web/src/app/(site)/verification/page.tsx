import type { Metadata } from "next";
import { NOTICES, VERIFICATION_BADGES, VERIFICATION_KINDS } from "@sukkot/shared";
import { ProsePage } from "@/components/layout/prose-page";
import { VerificationBadge } from "@/components/property/badges";

export const metadata: Metadata = { title: "How verification works", description: "What each Sukkot Salone verification badge means, and what it does not mean." };

export default function VerificationInfoPage() {
  return (
    <ProsePage eyebrow="Trust" title="How verification works" intro={NOTICES.verificationLimits}>
      <h2>Our badges</h2>
      <div className="mt-4 space-y-4">
        {VERIFICATION_KINDS.map((k) => (
          <div key={k} className="rounded-xl border border-line bg-surface p-5">
            <VerificationBadge kind={k} />
            <p className="mt-3"><strong>What it means:</strong> {VERIFICATION_BADGES[k].means}</p>
            <p className="mt-1"><strong>What it does not mean:</strong> {VERIFICATION_BADGES[k].doesNotMean}</p>
          </div>
        ))}
      </div>
      <h2>How we check</h2>
      <ol>
        <li>The lister uploads documents privately. Only our verification team can open them, and every access is logged.</li>
        <li>A trained reviewer compares the documents with the account and listing details.</li>
        <li>The reviewer records what was checked. Badges expire and must be renewed.</li>
        <li>If we later find a problem, we remove the badge and may suspend the account.</li>
      </ol>
      <h2>Your own checks still matter</h2>
      <p>A badge reduces risk; it does not remove it. Inspect the property, confirm the people you meet, and use a lawyer for any purchase or long lease.</p>
    </ProsePage>
  );
}
