"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { useApiForm } from "@/hooks/use-api-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";

type Choice = "" | "OWN" | "PRO";

/**
 * Before the photos: the lister either uploads their own (the photo manager passed in as children)
 * or asks Sukkot Salone to take professional photos and video for a non-refundable fee.
 */
export function PhotoChoice({
  propertyId,
  fee,
  defaultPhone,
  hasPhotos,
  children,
}: {
  propertyId: string;
  /** Formatted fee, or null when the service is not on sale. */
  fee: string | null;
  defaultPhone: string;
  hasPhotos: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>(hasPhotos || !fee ? "OWN" : "");
  const [phone, setPhone] = useState(defaultPhone);
  const [note, setNote] = useState("");
  const [agreed, setAgreed] = useState(false);
  const { submit, pending, errors, formError } = useApiForm(`/properties/${propertyId}/photo-shoot`, { success: "Request sent. Our team has been told.", onSuccess: () => router.refresh() });

  return (
    <div className="space-y-6">
      {fee && (
        <section className="card space-y-3 p-5 sm:p-6">
          <Field id="photo-choice" label="Who will take the photos?" hint="Good photos get far more enquiries.">
            <Select id="photo-choice" value={choice} onChange={(e) => setChoice(e.target.value as Choice)}>
              <option value="" disabled>Choose an option</option>
              <option value="OWN">I will take and upload the photos myself</option>
              <option value="PRO">Sukkot Salone takes professional photos and video ({fee}, non-refundable)</option>
            </Select>
          </Field>
        </section>
      )}

      {choice === "OWN" && children}

      {choice === "PRO" && fee && (
        <section className="card space-y-4 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-clay-50 text-clay-700"><Camera className="h-5 w-5" aria-hidden /></span>
            <div>
              <h2 className="text-lg font-bold text-navy-900">Professional photos and video</h2>
              <p className="mt-1 text-sm text-muted">Our team visits the property, takes the photos and a short video, and adds them to your listing. You then check them and submit the listing for review.</p>
            </div>
          </div>
          {formError && <Notice tone="danger">{formError}</Notice>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ps-phone" label="Phone number for the visit" error={errors.contactPhone}>
              <Input id="ps-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="076 123 456" aria-invalid={!!errors.contactPhone} />
            </Field>
          </div>
          <Field id="ps-note" label="Directions and good times to visit" optional error={errors.note}>
            <Textarea id="ps-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Behind the Total filling station. Weekday mornings are best." />
          </Field>
          <Notice tone="warning">The fee is <strong>{fee} for this property</strong> and is <strong>non-refundable</strong>. You pay it after sending the request, from this page.</Notice>
          <Checkbox id="ps-agree" label={`I agree to pay the non-refundable ${fee} fee`} checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <div className="flex justify-end">
            <Button type="button" loading={pending} disabled={!agreed} onClick={() => submit({ contactPhone: phone, note })}>Submit request</Button>
          </div>
        </section>
      )}
    </div>
  );
}
