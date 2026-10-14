import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { NOTICES, type Currency } from "@sukkot/shared";
import { useSubmit } from "@/lib/use-submit";
import { colors } from "@/lib/theme";
import { Button, ChipGroup, Field, FormScreen, Input, Notice, styles as ui } from "@/components/ui";

const ARRANGEMENTS = [
  { value: "FULL_PAYMENT", label: "Full payment" },
  { value: "INSTALMENTS", label: "Instalments" },
  { value: "MORTGAGE_OR_LOAN", label: "Mortgage or loan" },
  { value: "OTHER", label: "Other" },
] as const;

export default function OfferScreen() {
  const { id, title, currency = "SLE" } = useLocalSearchParams<{ id: string; title?: string; currency?: Currency }>();
  const [amount, setAmount] = useState("");
  const [arrangement, setArrangement] = useState<(typeof ARRANGEMENTS)[number]["value"]>("FULL_PAYMENT");
  const [conditions, setConditions] = useState("");
  const [inspectionDone, setInspectionDone] = useState(false);
  const [dueDiligence, setDueDiligence] = useState(true);
  const [message, setMessage] = useState("");
  const { submit, pending, errors, formError } = useSubmit();

  const send = async () => {
    const res = await submit<{ id: string }>("/offers", {
      propertyId: id,
      amount,
      currency,
      paymentArrangement: arrangement,
      conditions: conditions.split("\n").map((c) => c.trim()).filter((c) => c.length >= 3),
      inspectionDone,
      dueDiligenceRequested: dueDiligence,
      message,
    });
    if (res) router.replace("/activity/offers");
  };

  return (
    <FormScreen>
      {title ? <Text style={ui.h2}>{title}</Text> : null}
      <Notice title="Not a legal transfer">{NOTICES.offerNotLegal}</Notice>
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <Field label={`Offer amount (${currency})`} error={errors.amount}>
        <Input keyboardType="decimal-pad" value={amount} onChangeText={setAmount} invalid={!!errors.amount} />
      </Field>
      <Field label="How will you pay?" error={errors.paymentArrangement}>
        <ChipGroup options={ARRANGEMENTS} value={arrangement} onChange={(v) => setArrangement(v ?? "FULL_PAYMENT")} />
      </Field>
      <Field label="Conditions" optional hint="One per line, for example: subject to a clean title search" error={errors.conditions}>
        <Input multiline value={conditions} onChangeText={setConditions} />
      </Field>
      <Toggle label="I have already viewed the property" value={inspectionDone} onChange={setInspectionDone} />
      <Toggle label="I want due diligence before completing" value={dueDiligence} onChange={setDueDiligence} />
      <Field label="Message to the seller" optional error={errors.message}>
        <Input multiline value={message} onChangeText={setMessage} maxLength={2000} />
      </Field>
      <Notice tone="warning">{NOTICES.noEscrow}</Notice>
      <Button title="Submit offer" variant="secondary" loading={pending} onPress={send} />
    </FormScreen>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 48 }}>
      <Text style={[ui.label, { flex: 1 }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.emerald600 }} accessibilityLabel={label} />
    </View>
  );
}
