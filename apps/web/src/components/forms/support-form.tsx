"use client";

import { useState } from "react";
import { useApiForm } from "@/hooks/use-api-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";

export function SupportForm({ signedIn }: { signedIn: boolean }) {
  const [type, setType] = useState("SUPPORT");
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const f = useApiForm("/reports", { onSuccess: () => setDone(true) });
  if (done) return <Notice tone="success" title="Message received">Our team will reply by email. If this is about fraud, do not send any more money to the person involved.</Notice>;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        // General reports are filed as SUPPORT; fraud ones are tagged so staff can triage them first.
        f.submit({ type: "SUPPORT", reason: type === "FRAUD" ? `[Fraud] ${reason}` : reason, contactEmail: signedIn ? undefined : email });
      }}
    >
      <Field id="sup-type" label="Topic">
        <Select id="sup-type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="SUPPORT">Help with my account or a listing</option>
          <option value="FRAUD">Report a scam or fraud attempt</option>
        </Select>
      </Field>
      <Field id="sup-reason" label="Message" error={f.errors.reason} hint={type === "FRAUD" ? "Include the listing reference or link, names and phone numbers used, and any amounts requested." : undefined}>
        <Textarea id="sup-reason" rows={5} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={10} />
      </Field>
      {!signedIn && (
        <Field id="sup-email" label="Your email" error={f.errors.contactEmail}>
          <Input id="sup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
      )}
      {f.formError && <Notice tone="danger">{f.formError}</Notice>}
      <Button type="submit" loading={f.pending}>Send</Button>
    </form>
  );
}
