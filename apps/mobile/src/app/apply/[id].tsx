import { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { NOTICES } from "@sukkot/shared";
import { useSubmit } from "@/lib/use-submit";
import { Button, ChipGroup, Field, FormScreen, Input, Notice, styles as ui } from "@/components/ui";

const EMPLOYMENT = [
  { value: "EMPLOYED", label: "Employed" },
  { value: "SELF_EMPLOYED", label: "Self-employed" },
  { value: "STUDENT", label: "Student" },
  { value: "RETIRED", label: "Retired" },
  { value: "OTHER", label: "Other" },
] as const;
const INCOME = [
  { value: "UNDER_5K", label: "Under SLE 5,000" },
  { value: "5K_15K", label: "SLE 5,000–15,000" },
  { value: "15K_50K", label: "SLE 15,000–50,000" },
  { value: "OVER_50K", label: "Over SLE 50,000" },
  { value: "PREFER_NOT", label: "Prefer not to say" },
] as const;

export default function ApplyScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const [v, setV] = useState({ moveInDate: "", leaseMonths: "12", occupants: "1", employerOrBusiness: "", currentAddress: "", referenceName: "", referencePhone: "", message: "" });
  const [employment, setEmployment] = useState<(typeof EMPLOYMENT)[number]["value"] | undefined>();
  const [income, setIncome] = useState<(typeof INCOME)[number]["value"] | undefined>();
  const { submit, pending, errors, formError } = useSubmit();
  const set = (k: keyof typeof v) => (text: string) => setV((p) => ({ ...p, [k]: text }));

  const send = async () => {
    const res = await submit<{ id: string }>("/applications", {
      propertyId: id,
      ...v,
      moveInDate: v.moveInDate,
      leaseMonths: Number(v.leaseMonths),
      occupants: Number(v.occupants),
      employmentStatus: employment,
      monthlyIncomeBand: income,
      submit: true,
    });
    if (res) router.replace("/activity/applications");
  };

  return (
    <FormScreen>
      {title ? <Text style={ui.h2}>{title}</Text> : null}
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <Field label="Preferred move-in date" hint="Format: YYYY-MM-DD, for example 2026-11-01" error={errors.moveInDate}>
        <Input value={v.moveInDate} onChangeText={set("moveInDate")} placeholder="YYYY-MM-DD" invalid={!!errors.moveInDate} />
      </Field>
      <Field label="Lease length (months)" error={errors.leaseMonths}>
        <Input keyboardType="number-pad" value={v.leaseMonths} onChangeText={set("leaseMonths")} />
      </Field>
      <Field label="Number of occupants" error={errors.occupants}>
        <Input keyboardType="number-pad" value={v.occupants} onChangeText={set("occupants")} />
      </Field>
      <Field label="Employment" error={errors.employmentStatus}>
        <ChipGroup options={EMPLOYMENT} value={employment} onChange={setEmployment} />
      </Field>
      <Field label="Employer or business" optional error={errors.employerOrBusiness}>
        <Input value={v.employerOrBusiness} onChangeText={set("employerOrBusiness")} />
      </Field>
      <Field label="Monthly income" optional>
        <ChipGroup options={INCOME} value={income} onChange={setIncome} />
      </Field>
      <Field label="Current address" optional error={errors.currentAddress}>
        <Input value={v.currentAddress} onChangeText={set("currentAddress")} />
      </Field>
      <Field label="Reference name" optional error={errors.referenceName}>
        <Input value={v.referenceName} onChangeText={set("referenceName")} />
      </Field>
      <Field label="Reference phone" optional error={errors.referencePhone}>
        <Input keyboardType="phone-pad" value={v.referencePhone} onChangeText={set("referencePhone")} />
      </Field>
      <Field label="Message to the landlord" optional error={errors.message}>
        <Input multiline value={v.message} onChangeText={set("message")} maxLength={2000} />
      </Field>
      <Notice>{NOTICES.rentalTermsReview}</Notice>
      <Button title="Submit application" variant="secondary" loading={pending} onPress={send} />
    </FormScreen>
  );
}
