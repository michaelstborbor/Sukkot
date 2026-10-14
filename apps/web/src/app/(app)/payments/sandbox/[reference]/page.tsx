import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatMoney } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { getPaymentByReference } from "@/server/payments";
import { sandboxProvider } from "@/server/payments/providers/sandbox";
import { ActionButton } from "@/components/dashboard/action-button";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Sandbox payment", robots: { index: false } };

/** Test gateway page. Only exists when the sandbox provider is enabled (never in production by default). */
export default async function SandboxPaymentPage({ params }: { params: Promise<{ reference: string }> }) {
  if (!sandboxProvider.isConfigured()) notFound();
  const { reference } = await params;
  const actor = await requirePageActor(`/payments/sandbox/${reference}`);
  const p = await getPaymentByReference(actor, reference).catch(() => null);
  if (!p || p.method !== "SANDBOX") notFound();
  return (
    <div className="container-page max-w-lg py-12">
      <div className="card space-y-5 p-6">
        <Notice tone="warning" title="Test payment gateway">No real money moves. This page simulates a mobile money approval so the payment flow can be tested end to end.</Notice>
        <div>
          <p className="text-sm text-muted">Amount</p>
          <p className="text-3xl font-bold text-navy-900">{formatMoney(p.amountMinor, p.currency)}</p>
          <p className="mt-1 font-mono text-xs text-muted">{p.reference}</p>
        </div>
        {p.status === "PENDING" ? (
          <div className="flex gap-2">
            <ActionButton path={`/payments/sandbox/${p.reference}`} body={{ outcome: "SUCCEEDED" }} label="Approve payment" variant="secondary" success="Approved" redirectTo={`/dashboard/payments?ref=${p.reference}`} size="md" />
            <ActionButton path={`/payments/sandbox/${p.reference}`} body={{ outcome: "FAILED" }} label="Decline" variant="outline" success="Declined" redirectTo={`/dashboard/payments?ref=${p.reference}`} size="md" />
          </div>
        ) : (
          <Notice>This payment is already {p.status.toLowerCase()}.</Notice>
        )}
      </div>
    </div>
  );
}
