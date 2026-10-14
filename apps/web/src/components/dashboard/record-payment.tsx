"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PAYMENT_METHOD_LABELS, type Currency } from "@sukkot/shared";
import { useApiForm } from "@/hooks/use-api-form";
import { newIdempotencyKey } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";

const METHODS = ["ORANGE_MONEY", "AFRIMONEY", "BANK_TRANSFER", "CASH", "MANUAL"] as const;

/** Record a payment made directly between the parties (never collected by the platform). */
export function RecordPaymentButton({
  tenancyId,
  offerId,
  currency,
  defaultAmount,
  purposes,
  isPayee,
}: {
  tenancyId?: string;
  offerId?: string;
  currency: Currency;
  defaultAmount?: string;
  purposes: { value: string; label: string }[];
  isPayee: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [key] = useState(() => newIdempotencyKey());
  const [v, setV] = useState({ method: "ORANGE_MONEY", purpose: purposes[0]?.value ?? "RENT", amount: defaultAmount ?? "", paidAt: new Date().toISOString().slice(0, 10), externalReference: "", notes: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  const { submit, pending, errors, formError } = useApiForm("/payments/record", {
    success: isPayee ? "Payment recorded" : "Payment recorded. The recipient will be asked to confirm it.",
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Record a payment</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Record a payment" description="Use this for money paid directly between you and the other party. Sukkot Salone does not hold or transfer the money.">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit({ ...v, currency, tenancyId, offerId, idempotencyKey: key, externalReference: v.externalReference || undefined, notes: v.notes || undefined });
          }}
        >
          {formError && <Notice tone="danger">{formError}</Notice>}
          {!isPayee && <Notice>The recipient must confirm this payment before it counts as received.</Notice>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="rp-purpose" label="What for" error={errors.purpose}>
              <Select id="rp-purpose" value={v.purpose} onChange={set("purpose")}>
                {purposes.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </Select>
            </Field>
            <Field id="rp-amount" label={`Amount (${currency})`} error={errors.amount}>
              <Input id="rp-amount" inputMode="decimal" required value={v.amount} onChange={set("amount")} />
            </Field>
            <Field id="rp-method" label="Paid by" error={errors.method}>
              <Select id="rp-method" value={v.method} onChange={set("method")}>
                {METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
              </Select>
            </Field>
            <Field id="rp-date" label="Date paid" error={errors.paidAt}>
              <Input id="rp-date" type="date" required value={v.paidAt} onChange={set("paidAt")} />
            </Field>
          </div>
          <Field id="rp-ref" label="Transaction ID or receipt number" optional hint="For mobile money, the transaction ID from the SMS.">
            <Input id="rp-ref" value={v.externalReference} onChange={set("externalReference")} maxLength={120} />
          </Field>
          <Field id="rp-notes" label="Notes" optional>
            <Textarea id="rp-notes" rows={2} value={v.notes} onChange={set("notes")} maxLength={1000} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Save record</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
