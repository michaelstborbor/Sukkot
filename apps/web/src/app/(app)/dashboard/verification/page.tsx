import type { Metadata } from "next";
import { formatDate, VERIFICATION_BADGES, NOTICES } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { myVerifications } from "@/server/services/verification";
import { myProperties } from "@/server/services/properties";
import { PageHeader } from "@/components/dashboard/shell";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { VerificationForm } from "@/components/dashboard/upload-forms";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Verification" };

export default async function VerificationPage() {
  const actor = await requirePageActor("/dashboard/verification");
  const isLister = actor.roles.includes("OWNER") || actor.roles.includes("AGENT");
  const [requests, properties] = await Promise.all([myVerifications(actor), isLister ? myProperties(actor) : Promise.resolve([])]);
  const kinds = [
    { value: "IDENTITY", label: VERIFICATION_BADGES.IDENTITY.label, help: "A national ID card, passport or voter ID that matches your account name." },
    ...(actor.roles.includes("AGENT") ? [{ value: "AGENT_CREDENTIALS", label: VERIFICATION_BADGES.AGENT_CREDENTIALS.label, help: "Business registration and any professional membership documents." }] : []),
    ...(isLister
      ? [
          { value: "LISTING_AUTHORITY", label: VERIFICATION_BADGES.LISTING_AUTHORITY.label, help: "Proof you may market this property, such as a letter of authority from the owner." },
          { value: "PROPERTY_DOCUMENTS", label: VERIFICATION_BADGES.PROPERTY_DOCUMENTS.label, help: "Title deed or conveyance, survey plan and related documents for review." },
        ]
      : []),
  ];
  return (
    <div className="max-w-4xl">
      <PageHeader title="Verification" description="Verification builds trust with tenants and buyers. A reviewer checks every submission by hand." />
      <Notice className="mb-6" title="What our badges mean">{NOTICES.verificationLimits}</Notice>
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        {kinds.map((k) => {
          const b = VERIFICATION_BADGES[k.value as keyof typeof VERIFICATION_BADGES];
          return (
            <div key={k.value} className="card p-4 text-sm">
              <p className="font-semibold text-navy-900">{b.label}</p>
              <p className="mt-1 text-muted"><strong className="text-ink">Means:</strong> {b.means}</p>
              <p className="mt-1 text-muted"><strong className="text-ink">Does not mean:</strong> {b.doesNotMean}</p>
            </div>
          );
        })}
      </div>
      <section className="card mb-8 p-5">
        <h2 className="mb-4 font-bold text-navy-900">Submit documents</h2>
        <VerificationForm kinds={kinds} properties={properties.map((p) => ({ id: p.id, label: `${p.reference} · ${p.title}` }))} />
      </section>
      <section>
        <h2 className="mb-3 font-bold text-navy-900">Your requests</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-muted">No verification requests yet.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {requests.map((r) => (
              <li key={r.id} className="p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {VERIFICATION_BADGES[r.kind].label}
                    {r.property ? <span className="font-normal text-muted"> · {r.property.reference}</span> : null}
                  </p>
                  <StatusBadge status={r.status} kind="verification" />
                </div>
                <p className="mt-1 text-xs text-muted">
                  Submitted {formatDate(r.createdAt)} · {r.documents.length} document(s)
                  {r.expiresAt ? ` · valid until ${formatDate(r.expiresAt)}` : ""}
                </p>
                {r.decisionNote && <p className="mt-2 rounded-lg bg-canvas p-2">Reviewer: {r.decisionNote}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
