"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, FileText, Flag, HandCoins, MessageSquare, Phone } from "lucide-react";
import { NOTICES, REPORT_TYPES, REPORT_TYPE_LABELS, type ListingPurpose } from "@sukkot/shared";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { freetownLocalToIso, useApiForm } from "@/hooks/use-api-form";

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger">{message}</p>;
}

function EnquiryForm({ propertyId, onDone }: { propertyId: string; onDone: (conversationId: string) => void }) {
  const [message, setMessage] = useState("Hello, I'm interested in this property. Is it still available?");
  const [phone, setPhone] = useState("");
  const [intent, setIntent] = useState("GENERAL");
  const f = useApiForm<{ conversationId: string }>("/enquiries", { success: "Enquiry sent", onSuccess: (d) => onDone(d.conversationId) });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); f.submit({ propertyId, message, contactPhone: phone, intent }); }}>
      <Field id="enq-intent" label="I'd like to">
        <Select id="enq-intent" value={intent} onChange={(e) => setIntent(e.target.value)}>
          <option value="GENERAL">Ask a question</option>
          <option value="RENT">Rent this property</option>
          <option value="BUY">Buy this property</option>
          <option value="INSPECTION">Arrange a viewing</option>
          <option value="DOCUMENTS">Ask about documents</option>
        </Select>
      </Field>
      <Field id="enq-msg" label="Message" error={f.errors.message}>
        <Textarea id="enq-msg" value={message} onChange={(e) => setMessage(e.target.value)} required minLength={10} maxLength={2000} aria-invalid={!!f.errors.message} />
      </Field>
      <Field id="enq-phone" label="Phone number" optional hint="Shared with the lister so they can call you back." error={f.errors.contactPhone}>
        <Input id="enq-phone" type="tel" inputMode="tel" placeholder="076 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!f.errors.contactPhone} />
      </Field>
      <FormError message={f.formError} />
      <Button type="submit" variant="secondary" className="w-full" loading={f.pending}>Send enquiry</Button>
    </form>
  );
}

function InspectionForm({ propertyId, onDone }: { propertyId: string; onDone: () => void }) {
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [attendees, setAttendees] = useState(1);
  const [phone, setPhone] = useState("");
  const f = useApiForm("/inspections", { success: "Inspection requested. We'll notify you when it's confirmed.", onSuccess: onDone });
  const min = new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 16);
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); f.submit({ propertyId, scheduledAt: freetownLocalToIso(when), notes, attendees, contactPhone: phone }); }}>
      <Field id="insp-when" label="Preferred date and time" hint="Freetown time (GMT)." error={f.errors.scheduledAt}>
        <Input id="insp-when" type="datetime-local" min={min} step={900} value={when} onChange={(e) => setWhen(e.target.value)} required aria-invalid={!!f.errors.scheduledAt} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="insp-att" label="People attending">
          <Input id="insp-att" type="number" min={1} max={10} value={attendees} onChange={(e) => setAttendees(Number(e.target.value))} />
        </Field>
        <Field id="insp-phone" label="Phone" optional error={f.errors.contactPhone}>
          <Input id="insp-phone" type="tel" inputMode="tel" placeholder="076 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
      <Field id="insp-notes" label="Notes" optional>
        <Textarea id="insp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className="min-h-20" />
      </Field>
      <Notice tone="warning">{NOTICES.inspectionSafety}</Notice>
      <FormError message={f.formError} />
      <Button type="submit" variant="secondary" className="w-full" loading={f.pending}>Request inspection</Button>
    </form>
  );
}

function OfferForm({ propertyId, currency, onDone }: { propertyId: string; currency: string; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [arrangement, setArrangement] = useState("FULL_PAYMENT");
  const [conditions, setConditions] = useState("");
  const [message, setMessage] = useState("");
  const [expires, setExpires] = useState("");
  const [dd, setDd] = useState(true);
  const f = useApiForm<{ id: string }>("/offers", { success: "Offer submitted", onSuccess: onDone });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); f.submit({ propertyId, amount, currency, paymentArrangement: arrangement, conditions: conditions.split("\n").map((s) => s.trim()).filter(Boolean), message, expiresAt: expires ? new Date(`${expires}T23:59:00Z`).toISOString() : undefined, dueDiligenceRequested: dd }); }}>
      <Field id="off-amt" label={`Your offer (${currency})`} error={f.errors.amount}>
        <Input id="off-amt" inputMode="decimal" placeholder="e.g. 150,000" value={amount} onChange={(e) => setAmount(e.target.value)} required aria-invalid={!!f.errors.amount} />
      </Field>
      <Field id="off-arr" label="Payment arrangement">
        <Select id="off-arr" value={arrangement} onChange={(e) => setArrangement(e.target.value)}>
          <option value="FULL_PAYMENT">Full payment</option>
          <option value="INSTALMENTS">Instalments</option>
          <option value="MORTGAGE_OR_LOAN">Mortgage or loan</option>
          <option value="OTHER">Other</option>
        </Select>
      </Field>
      <Field id="off-cond" label="Conditions" optional hint="One per line, e.g. Subject to survey check.">
        <Textarea id="off-cond" value={conditions} onChange={(e) => setConditions(e.target.value)} className="min-h-20" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="off-exp" label="Offer valid until" optional error={f.errors.expiresAt}>
          <Input id="off-exp" type="date" min={new Date(Date.now() + 86400_000).toISOString().slice(0, 10)} value={expires} onChange={(e) => setExpires(e.target.value)} />
        </Field>
      </div>
      <Field id="off-msg" label="Message" optional>
        <Textarea id="off-msg" value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-20" />
      </Field>
      <Checkbox id="off-dd" label="Add a due-diligence checklist to track title, survey and searches" checked={dd} onChange={(e) => setDd(e.target.checked)} />
      <Notice tone="info">{NOTICES.offerNotLegal}</Notice>
      <FormError message={f.formError} />
      <Button type="submit" variant="secondary" className="w-full" loading={f.pending}>Submit offer</Button>
    </form>
  );
}

function ApplicationForm({ propertyId, onDone }: { propertyId: string; onDone: () => void }) {
  const [v, setV] = useState({ moveInDate: "", leaseMonths: 12, occupants: 1, employmentStatus: "EMPLOYED", employerOrBusiness: "", monthlyIncomeBand: "", referenceName: "", referencePhone: "", message: "" });
  const f = useApiForm("/applications", { success: "Application submitted", onSuccess: onDone });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((c) => ({ ...c, [k]: e.target.value }));
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); f.submit({ ...v, propertyId, moveInDate: v.moveInDate ? new Date(`${v.moveInDate}T00:00:00Z`).toISOString() : "", monthlyIncomeBand: v.monthlyIncomeBand || undefined, submit: true }); }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="app-move" label="Move-in date" error={f.errors.moveInDate}><Input id="app-move" type="date" required value={v.moveInDate} onChange={set("moveInDate")} /></Field>
        <Field id="app-lease" label="Lease (months)" error={f.errors.leaseMonths}><Input id="app-lease" type="number" min={1} max={240} value={v.leaseMonths} onChange={set("leaseMonths")} /></Field>
        <Field id="app-occ" label="Occupants"><Input id="app-occ" type="number" min={1} max={50} value={v.occupants} onChange={set("occupants")} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="app-emp" label="Employment">
          <Select id="app-emp" value={v.employmentStatus} onChange={set("employmentStatus")}>
            <option value="EMPLOYED">Employed</option><option value="SELF_EMPLOYED">Self-employed</option><option value="STUDENT">Student</option><option value="RETIRED">Retired</option><option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field id="app-empl" label="Employer or business" optional><Input id="app-empl" value={v.employerOrBusiness} onChange={set("employerOrBusiness")} /></Field>
      </div>
      <Field id="app-inc" label="Monthly income" optional hint="Only shared with this landlord.">
        <Select id="app-inc" value={v.monthlyIncomeBand} onChange={set("monthlyIncomeBand")}>
          <option value="">Prefer not to say</option><option value="UNDER_5K">Under Le 5,000</option><option value="5K_15K">Le 5,000 – 15,000</option><option value="15K_50K">Le 15,000 – 50,000</option><option value="OVER_50K">Over Le 50,000</option>
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="app-ref" label="Reference name" optional><Input id="app-ref" value={v.referenceName} onChange={set("referenceName")} /></Field>
        <Field id="app-refp" label="Reference phone" optional error={f.errors.referencePhone}><Input id="app-refp" type="tel" value={v.referencePhone} onChange={set("referencePhone")} /></Field>
      </div>
      <Field id="app-msg" label="Message to the landlord" optional><Textarea id="app-msg" value={v.message} onChange={set("message")} className="min-h-20" /></Field>
      <Notice tone="info">{NOTICES.rentalTermsReview}</Notice>
      <FormError message={f.formError} />
      <Button type="submit" variant="secondary" className="w-full" loading={f.pending}>Submit application</Button>
    </form>
  );
}

export function ReportForm({ propertyId, reportedUserId, onDone, signedIn }: { propertyId?: string; reportedUserId?: string; onDone: () => void; signedIn: boolean }) {
  const [type, setType] = useState(propertyId ? "LISTING" : "USER");
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const f = useApiForm("/reports", { success: "Thank you. Our team will review this report.", onSuccess: onDone });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); f.submit({ type, propertyId, reportedUserId, reason, contactEmail: signedIn ? undefined : email }); }}>
      <Field id="rep-type" label="What's wrong?">
        <Select id="rep-type" value={type} onChange={(e) => setType(e.target.value)}>
          {REPORT_TYPES.filter((t) => t !== "SUPPORT" && t !== "MESSAGE").map((t) => <option key={t} value={t}>{REPORT_TYPE_LABELS[t]}</option>)}
        </Select>
      </Field>
      <Field id="rep-reason" label="Details" error={f.errors.reason}>
        <Textarea id="rep-reason" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={10} placeholder="Tell us what happened. Include dates and any payment requests." />
      </Field>
      {!signedIn && (
        <Field id="rep-email" label="Your email" error={f.errors.contactEmail}>
          <Input id="rep-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
      )}
      <FormError message={f.formError} />
      <Button type="submit" variant="danger" className="w-full" loading={f.pending}>Send report</Button>
    </form>
  );
}

type Modal = "enquiry" | "inspection" | "offer" | "apply" | "report" | null;

export function PropertyActions({
  propertyId,
  slug,
  purpose,
  currency,
  signedIn,
  isOwnListing,
  phone,
  whatsapp,
  available,
}: {
  propertyId: string;
  slug: string;
  purpose: ListingPurpose;
  currency: string;
  signedIn: boolean;
  isOwnListing: boolean;
  phone: string | null;
  whatsapp: string | null;
  available: boolean;
}) {
  const [modal, setModal] = useState<Modal>(null);
  const router = useRouter();
  const close = () => setModal(null);
  const signInHref = `/auth/sign-in?next=${encodeURIComponent(`/properties/${slug}`)}`;

  if (isOwnListing) {
    return (
      <Notice tone="info" title="This is your listing">
        <Link href={`/dashboard/properties/${propertyId}`} className="link">Manage it in your dashboard</Link>
      </Notice>
    );
  }
  const need = (m: Modal) => () => (signedIn ? setModal(m) : router.push(signInHref));
  return (
    <div className="space-y-2.5">
      <Button variant="secondary" size="lg" className="w-full" onClick={need("enquiry")}><MessageSquare className="h-5 w-5" /> Send enquiry</Button>
      <Button variant="outline" size="lg" className="w-full" onClick={need("inspection")} disabled={!available}><CalendarClock className="h-5 w-5" /> Book an inspection</Button>
      {(purpose === "SALE" || purpose === "LEASE") && <Button variant="primary" size="lg" className="w-full" onClick={need("offer")} disabled={!available}><HandCoins className="h-5 w-5" /> Make an offer</Button>}
      {purpose !== "SALE" && <Button variant="primary" size="lg" className="w-full" onClick={need("apply")} disabled={!available}><FileText className="h-5 w-5" /> Apply to rent</Button>}
      {(phone || whatsapp) && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          {phone && <a href={`tel:${phone}`} className={buttonClasses("outline", "md")}><Phone className="h-4 w-4" /> Call</a>}
          {whatsapp && <a href={`https://wa.me/${whatsapp.replace("+", "")}`} target="_blank" rel="noopener noreferrer" className={buttonClasses("outline", "md")}>WhatsApp</a>}
        </div>
      )}
      {!signedIn && <p className="pt-1 text-center text-xs text-muted"><Link href={signInHref} className="link">Sign in</Link> to contact the lister. It&apos;s free.</p>}
      <button type="button" onClick={() => setModal("report")} className="mx-auto mt-2 flex items-center gap-1.5 text-sm text-muted hover:text-danger"><Flag className="h-4 w-4" /> Report listing</button>

      <Dialog open={modal === "enquiry"} onClose={close} title="Send an enquiry" description="Your message goes to the owner or agent through private in-app messaging.">
        <EnquiryForm propertyId={propertyId} onDone={(id) => { close(); router.push(`/dashboard/messages/${id}`); }} />
      </Dialog>
      <Dialog open={modal === "inspection"} onClose={close} title="Book an inspection">
        <InspectionForm propertyId={propertyId} onDone={() => { close(); router.push("/dashboard/inspections"); }} />
      </Dialog>
      <Dialog open={modal === "offer"} onClose={close} title="Make an offer">
        <OfferForm propertyId={propertyId} currency={currency} onDone={() => { close(); router.push("/dashboard/offers"); }} />
      </Dialog>
      <Dialog open={modal === "apply"} onClose={close} title="Rental application" description="Share a few details so the landlord can consider your application.">
        <ApplicationForm propertyId={propertyId} onDone={() => { close(); router.push("/dashboard/applications"); }} />
      </Dialog>
      <Dialog open={modal === "report"} onClose={close} title="Report this listing" description="Reports are confidential and reviewed by our moderation team.">
        <ReportForm propertyId={propertyId} signedIn={signedIn} onDone={close} />
      </Dialog>
    </div>
  );
}
