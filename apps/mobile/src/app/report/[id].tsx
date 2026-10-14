import { useState } from "react";
import { Alert, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSubmit } from "@/lib/use-submit";
import { Button, ChipGroup, Field, FormScreen, Input, Notice, styles as ui } from "@/components/ui";

const TYPES = [
  { value: "LISTING", label: "Inaccurate listing" },
  { value: "SUSPECTED_FRAUD", label: "Suspected fraud" },
  { value: "DUPLICATE_LISTING", label: "Duplicate" },
  { value: "OWNERSHIP_DISPUTE", label: "Ownership dispute" },
  { value: "SAFETY_CONCERN", label: "Safety concern" },
] as const;

export default function ReportScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("LISTING");
  const [reason, setReason] = useState("");
  const { submit, pending, errors, formError } = useSubmit();

  const send = async () => {
    const res = await submit("/reports", { type, propertyId: id, reason });
    if (res) {
      Alert.alert("Report sent", "Thank you. Our moderation team will review it.");
      router.back();
    }
  };

  return (
    <FormScreen>
      {title ? <Text style={ui.h2}>{title}</Text> : null}
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <Field label="What is wrong?" error={errors.type}>
        <ChipGroup options={TYPES} value={type} onChange={(v) => setType(v ?? "LISTING")} />
      </Field>
      <Field label="Details" error={errors.reason} hint="At least 10 characters. Include anything that helps us investigate.">
        <Input multiline value={reason} onChangeText={setReason} maxLength={3000} />
      </Field>
      <Button title="Send report" variant="danger" loading={pending} onPress={send} />
    </FormScreen>
  );
}
