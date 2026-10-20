"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BREAKFAST_LABELS,
  BREAKFAST_OPTIONS,
  CANCELLATION_POLICIES,
  CANCELLATION_POLICY_LABELS,
  STAY_FACILITIES,
  STAY_KINDS,
  STAY_KIND_BLURBS,
  STAY_KIND_LABELS,
  type StayDetails,
  type StayKind,
} from "@sukkot/shared";
import { useApiForm } from "@/hooks/use-api-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

/** What kind of stay a listing is and how it works: the form changes with the kind. */
export function StayDetailsForm({ propertyId, initial, currencyLabel }: { propertyId: string; initial: (Partial<StayDetails> & { kind?: StayKind }) | null; currencyLabel: string }) {
  const router = useRouter();
  const [v, setV] = useState({
    kind: initial?.kind ?? ("HOTEL" as StayKind),
    checkInFrom: initial?.checkInFrom ?? "14:00",
    checkOutBy: initial?.checkOutBy ?? "12:00",
    cancellationPolicy: initial?.cancellationPolicy ?? "MODERATE",
    minNights: String(initial?.minNights ?? 1),
    maxNights: String(initial?.maxNights ?? 90),
    breakfast: initial?.breakfast ?? "NONE",
    starRating: initial?.starRating ? String(initial.starRating) : "",
    gateClosesAt: initial?.gateClosesAt ?? "",
    cleaningFee: initial?.cleaningFee ?? "",
    receptionPhone: initial?.receptionPhone ?? "",
    houseRules: initial?.houseRules ?? "",
    childrenWelcome: initial?.childrenWelcome ?? true,
    petsAllowed: initial?.petsAllowed ?? false,
    smokingAllowed: initial?.smokingAllowed ?? false,
    partiesAllowed: initial?.partiesAllowed ?? false,
    idRequired: initial?.idRequired ?? true,
  });
  const [facilities, setFacilities] = useState<string[]>(initial?.facilities ?? []);
  const set = (k: keyof typeof v, value: string | boolean) => setV((c) => ({ ...c, [k]: value }));
  const { submit, pending, errors, formError } = useApiForm(`/properties/${propertyId}/stay`, { method: "PUT", success: "Saved", onSuccess: () => router.refresh() });
  const kind = v.kind;

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit({ ...v, starRating: kind === "HOTEL" ? v.starRating : "", gateClosesAt: kind === "GUEST_HOUSE" ? v.gateClosesAt : "", cleaningFee: kind === "SHORT_STAY_HOME" ? v.cleaningFee : "", facilities });
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">What kind of place is it?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {STAY_KINDS.map((k) => (
            <label key={k} className={cn("cursor-pointer rounded-xl border p-3", kind === k ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20" : "border-line hover:border-navy-600")}>
              <input type="radio" name="kind" value={k} className="sr-only" checked={kind === k} onChange={() => set("kind", k)} />
              <span className="block font-semibold">{STAY_KIND_LABELS[k]}</span>
              <span className="block text-xs text-muted">{STAY_KIND_BLURBS[k]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="sd-in" label="Check-in from" error={errors.checkInFrom}><Input id="sd-in" type="time" value={v.checkInFrom} onChange={(e) => set("checkInFrom", e.target.value)} /></Field>
        <Field id="sd-out" label="Check-out by" error={errors.checkOutBy}><Input id="sd-out" type="time" value={v.checkOutBy} onChange={(e) => set("checkOutBy", e.target.value)} /></Field>
        <Field id="sd-min" label="Shortest stay (nights)" error={errors.minNights}><Input id="sd-min" type="number" min={1} max={90} value={v.minNights} onChange={(e) => set("minNights", e.target.value)} /></Field>
        <Field id="sd-max" label="Longest stay (nights)" error={errors.maxNights}><Input id="sd-max" type="number" min={1} max={365} value={v.maxNights} onChange={(e) => set("maxNights", e.target.value)} /></Field>
        <Field id="sd-policy" label="Cancellation policy" hint={CANCELLATION_POLICY_LABELS[v.cancellationPolicy].summary} error={errors.cancellationPolicy}>
          <Select id="sd-policy" value={v.cancellationPolicy} onChange={(e) => set("cancellationPolicy", e.target.value)}>
            {CANCELLATION_POLICIES.map((p) => <option key={p} value={p}>{CANCELLATION_POLICY_LABELS[p].name}</option>)}
          </Select>
        </Field>
        {kind !== "SHORT_STAY_HOME" && (
          <Field id="sd-breakfast" label="Breakfast" error={errors.breakfast}>
            <Select id="sd-breakfast" value={v.breakfast} onChange={(e) => set("breakfast", e.target.value)}>
              {BREAKFAST_OPTIONS.map((b) => <option key={b} value={b}>{BREAKFAST_LABELS[b]}</option>)}
            </Select>
          </Field>
        )}
        {kind === "HOTEL" && (
          <Field id="sd-stars" label="Star rating" optional hint="Only if the hotel has an official rating" error={errors.starRating}>
            <Select id="sd-stars" value={v.starRating} onChange={(e) => set("starRating", e.target.value)}>
              <option value="">No rating</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} star{n === 1 ? "" : "s"}</option>)}
            </Select>
          </Field>
        )}
        {kind === "GUEST_HOUSE" && (
          <Field id="sd-gate" label="Gate locked at night from" optional hint="Leave empty if guests can come in at any time" error={errors.gateClosesAt}>
            <Input id="sd-gate" type="time" value={v.gateClosesAt} onChange={(e) => set("gateClosesAt", e.target.value)} />
          </Field>
        )}
        {kind === "SHORT_STAY_HOME" && (
          <Field id="sd-cleaning" label={`Cleaning fee per booking (${currencyLabel})`} optional hint="Added once to each booking" error={errors.cleaningFee}>
            <Input id="sd-cleaning" inputMode="decimal" value={v.cleaningFee} onChange={(e) => set("cleaningFee", e.target.value)} />
          </Field>
        )}
        <Field id="sd-phone" label="Phone guests can call on arrival" optional hint="Shown only on paid guests' receipts" error={errors.receptionPhone}>
          <Input id="sd-phone" type="tel" value={v.receptionPhone} onChange={(e) => set("receptionPhone", e.target.value)} />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Facilities</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {STAY_FACILITIES[kind].map((f) => (
            <Checkbox key={f.key} id={`sd-f-${f.key}`} label={f.label} checked={facilities.includes(f.key)} onChange={(e) => setFacilities((c) => (e.target.checked ? [...c, f.key] : c.filter((x) => x !== f.key)))} />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Rules</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <Checkbox id="sd-children" label="Children welcome" checked={v.childrenWelcome} onChange={(e) => set("childrenWelcome", e.target.checked)} />
          <Checkbox id="sd-pets" label="Pets allowed" checked={v.petsAllowed} onChange={(e) => set("petsAllowed", e.target.checked)} />
          <Checkbox id="sd-smoking" label="Smoking allowed in rooms" checked={v.smokingAllowed} onChange={(e) => set("smokingAllowed", e.target.checked)} />
          {kind === "SHORT_STAY_HOME" && <Checkbox id="sd-parties" label="Small gatherings allowed" checked={v.partiesAllowed} onChange={(e) => set("partiesAllowed", e.target.checked)} />}
          <Checkbox id="sd-id" label="Guests show a passport or national ID at check-in" checked={v.idRequired} onChange={(e) => set("idRequired", e.target.checked)} />
        </div>
      </fieldset>
      <Field id="sd-rules" label={kind === "SHORT_STAY_HOME" ? "House rules" : "Anything else guests must know"} optional error={errors.houseRules}>
        <Textarea id="sd-rules" maxLength={1500} value={v.houseRules} onChange={(e) => set("houseRules", e.target.value)} placeholder={kind === "SHORT_STAY_HOME" ? "Quiet after 22:00. Generator runs 18:00 to 07:00. Keep the gate locked." : "Visitors must leave the rooms by 22:00."} />
      </Field>
      {formError && <Notice tone="danger">{formError}</Notice>}
      <Button type="submit" loading={pending}>Save</Button>
    </form>
  );
}
