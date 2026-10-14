"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RENTAL_PERIODS, RENTAL_PERIOD_LABELS, type Currency } from "@sukkot/shared";
import { api } from "@/lib/api";
import { freetownLocalToIso } from "@/hooks/use-api-form";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";

type FieldKind = "note" | "noteRequired" | "datetime" | "amount" | "conditions" | "rentTerms";

interface ActionSpec {
  label: string;
  variant?: ButtonVariant;
  fields?: FieldKind[];
  confirm?: string;
}

const SPECS: Record<"inspection" | "application" | "offer", Record<string, ActionSpec>> = {
  inspection: {
    confirm: { label: "Confirm viewing", variant: "secondary" },
    propose_reschedule: { label: "Propose another time", fields: ["datetime", "note"] },
    accept_reschedule: { label: "Accept new time", variant: "secondary" },
    decline: { label: "Decline", variant: "danger", fields: ["note"] },
    cancel: { label: "Cancel viewing", variant: "ghost", fields: ["note"], confirm: "The other person will be notified." },
    complete: { label: "Mark as completed", fields: ["note"] },
    mark_no_show: { label: "Visitor did not attend", variant: "ghost", confirm: "Record that the visitor did not attend?" },
  },
  application: {
    submit: { label: "Submit application", variant: "secondary" },
    start_review: { label: "Start review" },
    require_inspection: { label: "Ask for a viewing first", fields: ["note"] },
    make_offer: { label: "Propose terms", variant: "secondary", fields: ["rentTerms", "note"] },
    accept_offer: { label: "Accept proposed terms", variant: "secondary", confirm: "Accepting the landlord's proposed terms approves your application. It is not a signed lease." },
    approve: { label: "Approve applicant", variant: "secondary", fields: ["note"] },
    reject: { label: "Decline", variant: "danger", fields: ["noteRequired"] },
    withdraw: { label: "Withdraw", variant: "ghost", fields: ["note"], confirm: "The landlord will be told you withdrew." },
    complete: {
      label: "Record tenancy start",
      variant: "primary",
      confirm: "This creates the tenancy record and rent schedule, and marks the property as rented. Only do this once a lease has been signed.",
    },
  },
  offer: {
    mark_under_review: { label: "Mark under review" },
    counter: { label: "Make a counteroffer", variant: "secondary", fields: ["amount", "conditions", "note"] },
    buyer_counter: { label: "Counter again", variant: "secondary", fields: ["amount", "conditions", "note"] },
    request_info: { label: "Ask for more information", fields: ["noteRequired"] },
    revise_conditions: { label: "Revise conditions", fields: ["conditions", "note"] },
    accept: {
      label: "Accept in principle",
      variant: "secondary",
      fields: ["note"],
      confirm: "Accepting in principle is not a sale and does not transfer ownership. Legal transfer requires a lawyer, due diligence and registration.",
    },
    accept_counter: { label: "Accept counteroffer", variant: "secondary", confirm: "This records agreement in principle only. It does not transfer ownership." },
    reject: { label: "Reject", variant: "danger", fields: ["note"] },
    withdraw: { label: "Withdraw offer", variant: "ghost", fields: ["note"], confirm: "The seller will be told you withdrew." },
    start_due_diligence: { label: "Start due diligence", fields: ["note"] },
    start_transaction: { label: "Move to transaction", fields: ["note"], confirm: "Only continue once both sides have instructed lawyers and due diligence is satisfactory." },
    complete: { label: "Mark transaction completed", fields: ["note"], confirm: "Confirm that the legal transfer has been completed outside the platform." },
  },
};

export function WorkflowActions({
  kind,
  endpoint,
  actions,
  currency = "SLE",
  defaults,
}: {
  kind: keyof typeof SPECS;
  endpoint: string;
  actions: string[];
  currency?: Currency;
  defaults?: { rent?: string; rentalPeriod?: string; leaseMonths?: number; startDate?: string };
}) {
  const visible = actions.filter((a) => SPECS[kind][a]);
  const [open, setOpen] = useState<string | null>(null);
  if (!visible.length) return null;
  const simple = (a: string) => !SPECS[kind][a]!.fields?.length && !SPECS[kind][a]!.confirm;
  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((a) =>
        simple(a) ? (
          <RunButton key={a} endpoint={endpoint} action={a} spec={SPECS[kind][a]!} />
        ) : (
          <Button key={a} size="sm" variant={SPECS[kind][a]!.variant ?? "outline"} onClick={() => setOpen(a)}>
            {SPECS[kind][a]!.label}
          </Button>
        ),
      )}
      {open && <ActionDialog endpoint={endpoint} action={open} spec={SPECS[kind][open]!} currency={currency} defaults={defaults} onClose={() => setOpen(null)} />}
    </div>
  );
}

function RunButton({ endpoint, action, spec }: { endpoint: string; action: string; spec: ActionSpec }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="sm"
      variant={spec.variant ?? "outline"}
      loading={pending}
      onClick={async () => {
        setPending(true);
        try {
          await api(endpoint, { body: { action } });
          toast.success("Updated");
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Something went wrong");
        } finally {
          setPending(false);
        }
      }}
    >
      {spec.label}
    </Button>
  );
}

function ActionDialog({
  endpoint,
  action,
  spec,
  currency,
  defaults,
  onClose,
}: {
  endpoint: string;
  action: string;
  spec: ActionSpec;
  currency: Currency;
  defaults?: { rent?: string; rentalPeriod?: string; leaseMonths?: number; startDate?: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState<Record<string, string>>({
    rent: defaults?.rent ?? "",
    rentalPeriod: defaults?.rentalPeriod ?? "YEAR",
    leaseMonths: String(defaults?.leaseMonths ?? 12),
    startDate: defaults?.startDate ?? "",
    advanceRentPeriods: "1",
  });
  const f = spec.fields ?? [];
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { action };
    // Inspections and applications read `note`; offers read `message`.
    if (v.note) body.note = body.message = v.note;
    if (f.includes("datetime")) body.proposedAt = freetownLocalToIso(v.datetime ?? "");
    if (f.includes("amount")) body.amount = v.amount;
    if (f.includes("conditions") && v.conditions) body.conditions = v.conditions.split("\n").map((x) => x.trim()).filter((x) => x.length >= 3);
    if (f.includes("rentTerms"))
      body.terms = {
        rent: v.rent,
        currency,
        rentalPeriod: v.rentalPeriod,
        advanceRentPeriods: Number(v.advanceRentPeriods || 0),
        securityDeposit: v.securityDeposit || undefined,
        startDate: v.startDate,
        leaseMonths: Number(v.leaseMonths),
        conditions: v.termsConditions || undefined,
      };
    setPending(true);
    setError(null);
    try {
      await api(endpoint, { body });
      toast.success("Updated");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={spec.label} description={spec.confirm}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Notice tone="danger">{error}</Notice>}
        {f.includes("datetime") && (
          <Field id="wf-dt" label="New date and time (Freetown time)">
            <Input id="wf-dt" type="datetime-local" required value={v.datetime ?? ""} onChange={set("datetime")} />
          </Field>
        )}
        {f.includes("amount") && (
          <Field id="wf-amount" label={`Amount (${currency})`}>
            <Input id="wf-amount" inputMode="decimal" required value={v.amount ?? ""} onChange={set("amount")} />
          </Field>
        )}
        {f.includes("conditions") && (
          <Field id="wf-cond" label="Conditions" optional hint="One per line">
            <Textarea id="wf-cond" rows={3} value={v.conditions ?? ""} onChange={set("conditions")} />
          </Field>
        )}
        {f.includes("rentTerms") && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="wf-rent" label={`Rent (${currency})`}>
              <Input id="wf-rent" inputMode="decimal" required value={v.rent} onChange={set("rent")} />
            </Field>
            <Field id="wf-period" label="Paid per">
              <Select id="wf-period" value={v.rentalPeriod} onChange={set("rentalPeriod")}>
                {RENTAL_PERIODS.map((p) => (
                  <option key={p} value={p}>{RENTAL_PERIOD_LABELS[p]}</option>
                ))}
              </Select>
            </Field>
            <Field id="wf-adv" label="Periods paid in advance">
              <Input id="wf-adv" inputMode="numeric" value={v.advanceRentPeriods} onChange={set("advanceRentPeriods")} />
            </Field>
            <Field id="wf-dep" label="Security deposit" optional>
              <Input id="wf-dep" inputMode="decimal" value={v.securityDeposit ?? ""} onChange={set("securityDeposit")} />
            </Field>
            <Field id="wf-start" label="Start date">
              <Input id="wf-start" type="date" required value={v.startDate} onChange={set("startDate")} />
            </Field>
            <Field id="wf-months" label="Lease length (months)">
              <Input id="wf-months" inputMode="numeric" required value={v.leaseMonths} onChange={set("leaseMonths")} />
            </Field>
            <Field id="wf-tc" label="Other conditions" optional className="sm:col-span-2">
              <Textarea id="wf-tc" rows={2} value={v.termsConditions ?? ""} onChange={set("termsConditions")} />
            </Field>
          </div>
        )}
        {(f.includes("note") || f.includes("noteRequired")) && (
          <Field id="wf-note" label={f.includes("noteRequired") ? "Message" : "Note"} optional={!f.includes("noteRequired")}>
            <Textarea id="wf-note" rows={3} required={f.includes("noteRequired")} minLength={f.includes("noteRequired") ? 3 : undefined} value={v.note ?? ""} onChange={set("note")} />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={spec.variant === "danger" ? "danger" : "primary"} loading={pending}>
            Confirm
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
