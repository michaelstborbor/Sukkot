"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone } from "lucide-react";
import { NOTICES, PAYMENT_METHOD_LABELS, type PaymentDTO, type PaymentMethod } from "@sukkot/shared";
import { useApiForm } from "@/hooks/use-api-form";
import { newIdempotencyKey } from "@/lib/api";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

/**
 * Online checkout for platform-collected items only (plans, promotions). The amount shown is
 * informational: the server computes the charge from the plan or price setting.
 */
export function CheckoutButton({
  label,
  title,
  amountLabel,
  methods,
  purpose,
  subscriptionPlanId,
  propertyId,
  variant = "primary",
}: {
  label: string;
  title: string;
  amountLabel: string;
  methods: PaymentMethod[];
  purpose: "PLATFORM_SUBSCRIPTION" | "LISTING_PROMOTION";
  subscriptionPlanId?: string;
  propertyId?: string;
  variant?: ButtonVariant;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(methods[0] ?? null);
  const [phone, setPhone] = useState("");
  const [key, setKey] = useState(() => newIdempotencyKey());
  const [result, setResult] = useState<PaymentDTO | null>(null);
  const { submit, pending, errors, formError } = useApiForm<PaymentDTO>("/payments", {
    onSuccess: (p) => {
      if (p.nextAction?.type === "REDIRECT") {
        window.location.href = p.nextAction.url;
        return;
      }
      setResult(p);
    },
  });
  const needsPhone = method === "ORANGE_MONEY" || method === "AFRIMONEY";

  return (
    <>
      <Button variant={variant} disabled={!methods.length} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          if (result) router.refresh();
          setResult(null);
          setKey(newIdempotencyKey());
        }}
        title={title}
        description={`Amount: ${amountLabel}`}
      >
        {result ? (
          <div className="space-y-3 text-sm">
            <Notice tone="info" title="Approve the payment on your phone">
              {result.nextAction?.type === "USSD_PROMPT" ? result.nextAction.message : "Follow the prompt from your mobile money provider."} Your plan or promotion starts only after the provider confirms the payment.
            </Notice>
            <p>Reference: <span className="font-mono">{result.reference}</span></p>
            <Button onClick={() => router.push(`/dashboard/payments?ref=${result.reference}`)}>Check payment status</Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!method) return;
              submit({ method, purpose, subscriptionPlanId, propertyId, payerPhone: needsPhone ? phone : undefined, idempotencyKey: key });
            }}
          >
            {formError && <Notice tone="danger">{formError}</Notice>}
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Pay with</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {methods.map((m) => (
                  <label key={m} className={cn("flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-medium", method === m ? "border-navy-900 bg-navy-50" : "border-line")}>
                    <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="accent-navy-900" />
                    <Smartphone className="h-4 w-4 text-muted" />
                    {PAYMENT_METHOD_LABELS[m]}
                  </label>
                ))}
              </div>
            </fieldset>
            {needsPhone && (
              <Field id="co-phone" label={`${PAYMENT_METHOD_LABELS[method!]} number`} error={errors.payerPhone} hint="The number that will receive the payment prompt">
                <Input id="co-phone" type="tel" inputMode="tel" placeholder="076 123 456" required value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
            )}
            <p className="text-xs text-muted">{NOTICES.paymentHonesty}</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={pending} disabled={!method}>Pay {amountLabel}</Button>
            </div>
          </form>
        )}
      </Dialog>
      {!methods.length && <p className="mt-1 text-xs text-muted">Online payment is not available yet.</p>}
    </>
  );
}
