import { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { NOTICES } from "@sukkot/shared";
import { useAuth } from "@/lib/auth";
import { freetownToIso } from "@/lib/format";
import { useSubmit } from "@/lib/use-submit";
import { Button, ChipGroup, Field, FormScreen, Input, Notice, styles as ui } from "@/components/ui";

const TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"].map((t) => ({ value: t, label: t }));

/** Next 14 days as YYYY-MM-DD in Freetown time (GMT). */
function upcomingDays() {
  const out: { value: string; label: string }[] = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    out.push({ value: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) });
  }
  return out;
}

export default function InspectScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { user } = useAuth();
  const [days] = useState(upcomingDays);
  const [date, setDate] = useState<string | undefined>();
  const [time, setTime] = useState<string | undefined>();
  const [attendees, setAttendees] = useState("1");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [notes, setNotes] = useState("");
  const { submit, pending, errors, formError } = useSubmit();
  const [localError, setLocalError] = useState<string | null>(null);

  const send = async () => {
    const scheduledAt = date && time ? freetownToIso(date, time) : null;
    if (!scheduledAt) return setLocalError("Choose a day and a time.");
    setLocalError(null);
    const res = await submit<{ id: string }>("/inspections", { propertyId: id, scheduledAt, attendees: Number(attendees) || 1, contactPhone: phone, notes });
    if (res) router.replace("/activity/inspections");
  };

  return (
    <FormScreen>
      {title ? <Text style={ui.h2}>{title}</Text> : null}
      {formError || localError ? <Notice tone="danger">{localError ?? formError}</Notice> : null}
      <Field label="Day" error={errors.scheduledAt}>
        <ChipGroup options={days} value={date} onChange={setDate} />
      </Field>
      <Field label="Time (Freetown time)">
        <ChipGroup options={TIMES} value={time} onChange={setTime} />
      </Field>
      <Field label="Number of people attending" error={errors.attendees}>
        <Input keyboardType="number-pad" value={attendees} onChangeText={setAttendees} />
      </Field>
      <Field label="Phone number" optional error={errors.contactPhone}>
        <Input keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="076 123 456" />
      </Field>
      <Field label="Notes" optional error={errors.notes}>
        <Input multiline value={notes} onChangeText={setNotes} maxLength={1000} />
      </Field>
      <Notice tone="warning" title="Stay safe">
        {NOTICES.inspectionSafety}
      </Notice>
      <Button title="Request viewing" loading={pending} onPress={send} />
    </FormScreen>
  );
}
