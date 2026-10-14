import { useState } from "react";
import { Alert, Modal, Text, View } from "react-native";
import { api, errorMessage } from "@/lib/api";
import { freetownToIso } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Button, Field, FormScreen, Input, Notice, styles as ui } from "./ui";

type FieldKind = "note" | "noteRequired" | "datetime" | "amount" | "conditions";
interface Spec {
  label: string;
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  fields?: FieldKind[];
  confirm?: string;
}

/** Mirrors the web dashboard's action specs. Actions not listed here (e.g. proposing lease terms) are web-only. */
const SPECS: Record<"inspection" | "application" | "offer", Record<string, Spec>> = {
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
    accept_offer: { label: "Accept proposed terms", variant: "secondary", confirm: "Accepting the landlord's proposed terms approves your application. It is not a signed lease." },
    approve: { label: "Approve applicant", variant: "secondary", fields: ["note"] },
    reject: { label: "Decline", variant: "danger", fields: ["noteRequired"] },
    withdraw: { label: "Withdraw", variant: "ghost", fields: ["note"], confirm: "The landlord will be told you withdrew." },
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
  },
};

export function WorkflowActions({ kind, endpoint, actions, currency = "SLE", onDone }: { kind: keyof typeof SPECS; endpoint: string; actions: string[]; currency?: string; onDone: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const visible = actions.filter((a) => SPECS[kind][a]);
  const webOnly = actions.length > visible.length;
  if (!actions.length) return null;

  const run = async (action: string) => {
    setBusy(action);
    try {
      await api(endpoint, { body: { action } });
      onDone();
    } catch (e) {
      Alert.alert("Could not update", errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={ui.chipRow}>
        {visible.map((a) => {
          const spec = SPECS[kind][a]!;
          return (
            <Button
              key={a}
              small
              title={spec.label}
              variant={spec.variant ?? "outline"}
              loading={busy === a}
              onPress={() => (spec.fields?.length || spec.confirm ? setOpen(a) : run(a))}
            />
          );
        })}
      </View>
      {webOnly ? <Text style={[ui.muted, { fontSize: 12 }]}>More actions are available in your dashboard on the website.</Text> : null}
      {open ? (
        <ActionModal
          spec={SPECS[kind][open]!}
          action={open}
          endpoint={endpoint}
          currency={currency}
          onClose={() => setOpen(null)}
          onDone={() => {
            setOpen(null);
            onDone();
          }}
        />
      ) : null}
    </View>
  );
}

function ActionModal({ spec, action, endpoint, currency, onClose, onDone }: { spec: Spec; action: string; endpoint: string; currency: string; onClose: () => void; onDone: () => void }) {
  const f = spec.fields ?? [];
  const [v, setV] = useState({ note: "", date: "", time: "", amount: "", conditions: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof v) => (t: string) => setV((p) => ({ ...p, [k]: t }));

  const submit = async () => {
    const body: Record<string, unknown> = { action };
    if (v.note) body.note = body.message = v.note;
    if (f.includes("noteRequired") && v.note.trim().length < 3) return setError("Please add a short message.");
    if (f.includes("datetime")) {
      const iso = freetownToIso(v.date, v.time);
      if (!iso) return setError("Enter the date as YYYY-MM-DD and the time as HH:MM.");
      body.proposedAt = iso;
    }
    if (f.includes("amount")) body.amount = v.amount;
    if (f.includes("conditions") && v.conditions) body.conditions = v.conditions.split("\n").map((x) => x.trim()).filter((x) => x.length >= 3);
    setPending(true);
    setError(null);
    try {
      await api(endpoint, { body });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} visible>
      <FormScreen>
        <Text style={[ui.h1, { marginTop: 8 }]}>{spec.label}</Text>
        {spec.confirm ? <Notice tone="warning">{spec.confirm}</Notice> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {f.includes("datetime") ? (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 3 }}>
              <Field label="Date (Freetown)">
                <Input value={v.date} onChangeText={set("date")} placeholder="YYYY-MM-DD" />
              </Field>
            </View>
            <View style={{ flex: 2 }}>
              <Field label="Time">
                <Input value={v.time} onChangeText={set("time")} placeholder="HH:MM" />
              </Field>
            </View>
          </View>
        ) : null}
        {f.includes("amount") ? (
          <Field label={`Amount (${currency})`}>
            <Input keyboardType="decimal-pad" value={v.amount} onChangeText={set("amount")} />
          </Field>
        ) : null}
        {f.includes("conditions") ? (
          <Field label="Conditions" optional hint="One per line">
            <Input multiline value={v.conditions} onChangeText={set("conditions")} />
          </Field>
        ) : null}
        {f.includes("note") || f.includes("noteRequired") ? (
          <Field label={f.includes("noteRequired") ? "Message" : "Note"} optional={!f.includes("noteRequired")}>
            <Input multiline value={v.note} onChangeText={set("note")} maxLength={2000} />
          </Field>
        ) : null}
        <Button title="Confirm" variant={spec.variant === "danger" ? "danger" : "primary"} loading={pending} onPress={submit} />
        <Button title="Cancel" variant="ghost" onPress={onClose} />
        <View style={{ height: 1, backgroundColor: colors.line }} />
      </FormScreen>
    </Modal>
  );
}
