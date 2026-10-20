"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ActionButton } from "@/components/dashboard/action-button";
import { Notice } from "@/components/ui/misc";

const MAX = 10 * 1024 * 1024;

export function VerificationForm({ kinds, properties }: { kinds: { value: string; label: string; help: string }[]; properties: { id: string; label: string }[] }) {
  const router = useRouter();
  const [kind, setKind] = useState(kinds[0]?.value ?? "IDENTITY");
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const files = useRef<HTMLInputElement>(null);
  const needsProperty = kind === "LISTING_AUTHORITY" || kind === "PROPERTY_DOCUMENTS";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const chosen = [...(files.current?.files ?? [])];
    if (!chosen.length) return setError("Attach at least one document");
    if (chosen.length > 5) return setError("Attach up to 5 documents");
    if (chosen.some((f) => f.size > MAX)) return setError("Each file must be 10 MB or smaller");
    const form = new FormData();
    form.append("kind", kind);
    if (needsProperty) form.append("propertyId", propertyId);
    if (notes) form.append("notes", notes);
    chosen.forEach((f) => {
      form.append("files", f);
      form.append("labels", f.name);
    });
    setBusy(true);
    try {
      await api("/verification", { form });
      toast.success("Submitted for review");
      setNotes("");
      if (files.current) files.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Notice tone="danger">{error}</Notice>}
      <Field id="vf-kind" label="What do you want verified?" hint={kinds.find((k) => k.value === kind)?.help}>
        <Select id="vf-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          {kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </Select>
      </Field>
      {needsProperty &&
        (properties.length ? (
          <Field id="vf-prop" label="Listing">
            <Select id="vf-prop" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </Field>
        ) : (
          <Notice tone="warning">Create a listing first.</Notice>
        ))}
      <Field id="vf-files" label="Documents" hint="PDF, JPEG or PNG. Up to 5 files, 10 MB each. Files are stored privately.">
        <input id="vf-files" ref={files} type="file" multiple accept="application/pdf,image/jpeg,image/png" className="block w-full text-sm" />
      </Field>
      <Field id="vf-notes" label="Notes for the reviewer" optional>
        <Textarea id="vf-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
      </Field>
      <Button type="submit" loading={busy}><Upload className="h-4 w-4" /> Submit for review</Button>
    </form>
  );
}

export function AvatarUpload({ current }: { current: string | null }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Photos must be 5 MB or smaller");
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    try {
      await api("/me/avatar", { form });
      toast.success("Photo updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-4">
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current} alt="Your profile photo" className="h-16 w-16 rounded-full object-cover" />
      ) : (
        <div className="h-16 w-16 rounded-full bg-navy-100" aria-hidden />
      )}
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="avatar" aria-label="Choose a profile photo" tabIndex={-1} onChange={(e) => upload(e.target.files?.[0])} />
      <Button variant="outline" size="sm" loading={busy} onClick={() => ref.current?.click()}>Change photo</Button>
    </div>
  );
}

/** Upload or replace the homepage background photo (Admin → Site settings). */
export function HeroImageUpload({ current, currentAlt }: { current: string | null; currentAlt: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [alt, setAlt] = useState(currentAlt);
  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Photos must be 10 MB or smaller");
    const form = new FormData();
    form.append("file", file);
    form.append("alt", alt);
    setBusy(true);
    try {
      await api("/admin/settings/hero", { form });
      toast.success("Background photo updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <div className="space-y-3">
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current} alt="Current homepage background" className="aspect-[21/9] w-full rounded-xl object-cover" />
      ) : (
        <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl bg-navy-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/salone-hillside-768.webp" alt="" className="h-full w-full object-cover" />
          <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">Default photo</span>
        </div>
      )}
      <Field id="hero-alt" label="Describe the photo" optional hint="Read aloud by screen readers, for example “Freetown from Leicester Peak at sunset”.">
        <Input id="hero-alt" value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} />
      </Field>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="hero-photo" onChange={(e) => upload(e.target.files?.[0])} />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" loading={busy} onClick={() => ref.current?.click()}>{current ? "Replace photo" : "Upload photo"}</Button>
        {current && <ActionButton path="/admin/settings/hero" method="DELETE" label="Use the default photo" variant="ghost" success="Background photo removed" />}
      </div>
    </div>
  );
}
