import { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useSubmit } from "@/lib/use-submit";
import { Button, ChipGroup, Field, FormScreen, Input, Notice, styles as ui } from "@/components/ui";

const INTENTS = [
  { value: "GENERAL", label: "General question" },
  { value: "RENT", label: "I want to rent" },
  { value: "BUY", label: "I want to buy" },
  { value: "INSPECTION", label: "Viewing" },
  { value: "DOCUMENTS", label: "Documents" },
] as const;

export default function EnquireScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { user } = useAuth();
  const [intent, setIntent] = useState<(typeof INTENTS)[number]["value"]>("GENERAL");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const { submit, pending, errors, formError } = useSubmit();

  const send = async () => {
    const res = await submit<{ conversationId: string }>("/enquiries", { propertyId: id, intent, message, contactPhone: phone, preferredContact: "IN_APP" });
    if (res) router.replace({ pathname: "/conversation/[id]", params: { id: res.conversationId } });
  };

  return (
    <FormScreen>
      {title ? <Text style={ui.h2}>{title}</Text> : null}
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <Field label="What is this about?">
        <ChipGroup options={INTENTS} value={intent} onChange={(v) => setIntent(v ?? "GENERAL")} />
      </Field>
      <Field label="Message" error={errors.message} hint="At least 10 characters. Never send money before viewing the property.">
        <Input multiline value={message} onChangeText={setMessage} invalid={!!errors.message} maxLength={2000} />
      </Field>
      <Field label="Phone number" optional error={errors.contactPhone} hint="Shared with the lister only if you include it.">
        <Input keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="076 123 456" />
      </Field>
      <Button title="Send enquiry" loading={pending} onPress={send} />
    </FormScreen>
  );
}
