"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, FileLock2, ImagePlus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge, EmptyState } from "@/components/ui/misc";

interface Img {
  id: string;
  thumbUrl: string;
  alt: string;
  illustrative: boolean;
}

const MAX_BYTES = 10 * 1024 * 1024;

export function PhotoManager({ propertyId, images }: { propertyId: string; images: Img[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(images.map((i) => i.id));
  const byId = new Map(images.map((i) => [i.id, i]));
  const list = order.map((id) => byId.get(id)).filter((x): x is Img => !!x);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const chosen = [...files].slice(0, 10);
    const tooBig = chosen.find((f) => f.size > MAX_BYTES);
    if (tooBig) return toast.error(`${tooBig.name} is larger than 10 MB`);
    const form = new FormData();
    chosen.forEach((f) => form.append("files", f));
    setBusy(true);
    try {
      await api(`/properties/${propertyId}/images`, { form });
      toast.success(`${chosen.length} photo${chosen.length > 1 ? "s" : ""} uploaded`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function move(index: number, delta: number) {
    const next = [...order];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    setOrder(next);
    try {
      await api(`/properties/${propertyId}/images`, { method: "PUT", body: { order: next } });
    } catch (e) {
      setOrder(order);
      toast.error(e instanceof Error ? e.message : "Could not reorder");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this photo?")) return;
    try {
      await api(`/properties/${propertyId}/images?imageId=${encodeURIComponent(id)}`, { method: "DELETE" });
      setOrder((o) => o.filter((x) => x !== id));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">JPEG, PNG or WebP up to 10 MB each. The first photo is the cover. Photos are resized and location data is removed.</p>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" id="photo-upload" onChange={(e) => upload(e.target.files)} />
        <Button onClick={() => input.current?.click()} loading={busy} variant="secondary">
          <ImagePlus className="h-4 w-4" /> Upload photos
        </Button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<ImagePlus className="h-6 w-6" />} title="No photos yet" body="Add at least one clear, honest photo before submitting for review." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {list.map((img, i) => (
            <li key={img.id} className="card overflow-hidden">
              <div className="relative aspect-[4/3] bg-navy-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.thumbUrl} alt={img.alt} className="h-full w-full object-cover" loading="lazy" />
                {i === 0 && <Badge tone="dark" className="absolute top-2 left-2">Cover</Badge>}
                {img.illustrative && <Badge tone="warning" className="absolute top-2 right-2">Illustrative</Badge>}
              </div>
              <div className="flex items-center justify-between p-2">
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Move later" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
                <Button size="icon" variant="ghost" aria-label="Delete photo" onClick={() => remove(img.id)}>
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const DOC_KINDS = [
  ["TITLE_DEED", "Title deed or conveyance"],
  ["SURVEY_PLAN", "Survey plan"],
  ["LEASE", "Lease agreement"],
  ["AUTHORITY_LETTER", "Letter of authority from the owner"],
  ["TAX_RECEIPT", "Property rate or tax receipt"],
  ["BUILDING_PERMIT", "Building permit"],
  ["OTHER", "Other"],
] as const;

export function DocumentManager({ propertyId, documents, canUpload = true }: { propertyId: string; canUpload?: boolean; documents: { id: string; label: string; kind: string; createdAt: string; visibility: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<string>("TITLE_DEED");
  const [label, setLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Choose a file");
    if (file.size > MAX_BYTES) return toast.error("Files must be 10 MB or smaller");
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    form.append("label", label || DOC_KINDS.find(([k]) => k === kind)![1]);
    setBusy(true);
    try {
      await api(`/properties/${propertyId}/documents`, { form });
      toast.success("Document uploaded privately");
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Documents are stored privately. Only you and authorised Sukkot Salone staff can open them. Uploading documents lets our team review them; a
        &ldquo;Documents reviewed&rdquo; badge does not confirm legal ownership.
      </p>
      {canUpload && (
      <form onSubmit={submit} className="grid gap-3 rounded-xl border border-line bg-canvas p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field id="doc-kind" label="Document type">
          <Select id="doc-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {DOC_KINDS.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </Select>
        </Field>
        <Field id="doc-label" label="Label" optional>
          <Input id="doc-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} />
        </Field>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" aria-label="File" className="max-w-48 text-sm" />
          <Button type="submit" loading={busy}>
            <Upload className="h-4 w-4" /> Upload
          </Button>
        </div>
      </form>
      )}
      {documents.length === 0 ? (
        <p className="text-sm text-muted">No documents uploaded.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-white">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <FileLock2 className="h-4 w-4 shrink-0 text-navy-700" />
                <span className="truncate font-medium">{d.label}</span>
                <span className="hidden text-xs text-muted sm:inline">{new Date(d.createdAt).toLocaleDateString("en-GB")}</span>
              </span>
              <a className="link shrink-0" href={`/api/v1/documents/${d.id}`} target="_blank" rel="noopener noreferrer">
                Open
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
