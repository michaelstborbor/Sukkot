"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Smartphone } from "lucide-react";
import { NOTICES, PAYMENT_METHOD_LABELS, type ManualPlatformChannel, type PaymentDTO, type PaymentMethod } from "@sukkot/shared";
import { useApiForm } from "@/hooks/use-api-form";
import { newIdempotencyKey } from "@/lib/api";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

/** Where to send a transfer to Sukkot Salone. Only the channels with details filled in are listed. */
export interface TransferDetails {
  accountName: string;
  channels: { channel: ManualPlatformChannel; destination: string }[];
}

type Mode = "online" | "transfer";

/**
 * Checkout for platform-collected items only (plans, promotions). The amount shown is
 * informational: the server computes the charge from the plan or price setting.
 * Two ways to pay: online through a mobile money provider (activates when the provider confirms),
 * or by transfer to Sukkot Salone's own wallet or bank account (activates when finance confirms).
 */
export function CheckoutButton({
  label,
  title,
  amountLabel,
  methods,
  transfer,
  purpose,
  subscriptionPlanId,
  propertyId,
  variant = "primary",
}: {
  label: string;
  title: string;
  amountLabel: string;
  methods: PaymentMethod[];
  transfer?: TransferDetails | null;
  purpose: "PLATFORM_SUBSCRIPTION" | "LISTING_PROMOTION";
  subscriptionPlanId?: string;
  propertyId?: string;
  variant?: ButtonVariant;
}) {
  const router = useRouter();
  const canTransfer = !!transfer && transfer.channels.length > 0;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(methods.length ? "online" : "transfer");
  const [method, setMethod] = useState<PaymentMethod | null>(methods[0] ?? null);
  const [channel, setChannel] = useState<ManualPlatformChannel | null>(transfer?.channels[0]?.channel ?? null);
  const [phone, setPhone] = useState("");
  const [txId, setTxId] = useState("");
  const [key, setKey] = useState(() => newIdempotencyKey());
  const [result, setResult] = useState<{ payment: PaymentDTO; mode: Mode } | null>(null);
  const online = useApiForm<PaymentDTO>("/payments", {
    onSuccess: (p) => {
      if (p.nextAction?.type === "REDIRECT") {
        window.location.href = p.nextAction.url;
        return;
      }
      setResult({ payment: p, mode: "online" });
    },
  });
  const manual = useApiForm<PaymentDTO>("/payments/manual", { onSuccess: (p) => setResult({ payment: p, mode: "transfer" }) });
  const form = mode === "online" ? online : manual;
  const needsPhone = mode === "online" && (method === "ORANGE_MONEY" || method === "AFRIMONEY");
  const available = methods.length > 0 || canTransfer;

  return (
    <>
      <Button variant={variant} disabled={!available} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          if (result) router.refresh();
          setResult(null);
          setTxId("");
          setKey(newIdempotencyKey());
        }}
        title={title}
        description={`Amount: ${amountLabel}`}
      >
        {result?.mode === "online" ? (
          <div className="space-y-3 text-sm">
            <Notice tone="info" title="Approve the payment on your phone">
              {result.payment.nextAction?.type === "USSD_PROMPT" ? result.payment.nextAction.message : "Follow the prompt from your mobile money provider."} Your plan or promotion starts only after the provider confirms the payment.
            </Notice>
            <p>Reference: <span className="font-mono">{result.payment.reference}</span></p>
            <Button onClick={() => router.push(`/dashboard/payments?ref=${result.payment.reference}`)}>Check payment status</Button>
          </div>
        ) : result?.mode === "transfer" ? (
          <div className="space-y-3 text-sm">
            <Notice tone="success" title="Thank you, we have your transaction ID">
              Our finance team will match it against our statement. Your plan or promotion starts as soon as they confirm it, and we will notify you.
            </Notice>
            <p>Reference: <span className="font-mono">{result.payment.reference}</span></p>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "online") {
                if (!method) return;
                online.submit({ method, purpose, subscriptionPlanId, propertyId, payerPhone: needsPhone ? phone : undefined, idempotencyKey: key });
              } else {
                if (!channel) return;
                manual.submit({ channel, purpose, subscriptionPlanId, propertyId, externalReference: txId, payerPhone: phone || undefined, idempotencyKey: key });
              }
            }}
          >
            {form.formError && <Notice tone="danger">{form.formError}</Notice>}
            {methods.length > 0 && canTransfer && (
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-navy-50 p-1 text-sm font-semibold" role="tablist">
                {(["online", "transfer"] as const).map((m) => (
                  <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("rounded-lg px-3 py-2", mode === m ? "bg-white shadow-sm" : "text-muted")}>
                    {m === "online" ? "Pay now" : "Pay by transfer"}
                  </button>
                ))}
              </div>
            )}

            {mode === "online" ? (
              <>
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
                  <Field id="co-phone" label={`${PAYMENT_METHOD_LABELS[method!]} number`} error={form.errors.payerPhone} hint="The number that will receive the payment prompt">
                    <Input id="co-phone" type="tel" inputMode="tel" placeholder="076 123 456" required value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </Field>
                )}
              </>
            ) : (
              transfer && (
                <>
                  <div className="space-y-2 text-sm">
                    <p>
                      Send exactly <strong>{amountLabel}</strong> to <strong>{transfer.accountName}</strong> using one of these, then enter the transaction ID from your confirmation message.
                    </p>
                    <fieldset className="grid gap-2">
                      <legend className="sr-only">How you paid</legend>
                      {transfer.channels.map((c) => (
                        <label key={c.channel} className={cn("flex cursor-pointer items-start gap-2 rounded-xl border p-3", channel === c.channel ? "border-navy-900 bg-navy-50" : "border-line")}>
                          <input type="radio" name="channel" value={c.channel} checked={channel === c.channel} onChange={() => setChannel(c.channel)} className="mt-1 accent-navy-900" />
                          {c.channel === "BANK_TRANSFER" ? <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-muted" /> : <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-muted" />}
                          <span>
                            <span className="block font-medium">{PAYMENT_METHOD_LABELS[c.channel]}</span>
                            <span className="block whitespace-pre-line font-mono text-xs">{c.destination}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  </div>
                  <Field id="co-txid" label="Transaction ID" error={form.errors.externalReference} hint="From the SMS or bank receipt, for example CI231014.1234.A56789">
                    <Input id="co-txid" required minLength={4} maxLength={60} value={txId} onChange={(e) => setTxId(e.target.value)} />
                  </Field>
                  {channel !== "BANK_TRANSFER" && (
                    <Field id="co-from" label="Number you sent from" optional error={form.errors.payerPhone} hint="Helps our finance team find your payment">
                      <Input id="co-from" type="tel" inputMode="tel" placeholder="076 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </Field>
                  )}
                </>
              )
            )}
            <p className="text-xs text-muted">{NOTICES.paymentHonesty}</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={form.pending} disabled={mode === "online" ? !method : !channel}>
                {mode === "online" ? `Pay ${amountLabel}` : "I have paid"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
      {!available && <p className="mt-1 text-xs text-muted">Payment is not available yet.</p>}
    </>
  );
}
