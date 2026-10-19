"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, FileLock2, ImagePlus, Trash2, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
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
const MAX_VIDEO_MB = 100;
const MAX_VIDEO_SECONDS = 60;

export interface ListingVideo {
  status: "PROCESSING" | "READY" | "FAILED";
  url: string | null;
  posterUrl: string | null;
  durationSec: number | null;
  error: string | null;
}

/** A photo thumbnail that says so plainly when its file has gone missing, so the lister can replace it. */
function Thumb({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [lost, setLost] = useState(false);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setLost(true);
  }, []);
  if (lost) {
    return <p className="flex h-full items-center justify-center p-3 text-center text-xs text-amber-800">This photo&apos;s file is missing. Delete it and upload it again.</p>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" onError={() => setLost(true)} />;
}

export function PhotoManager({ propertyId, images, video }: { propertyId: string; images: Img[]; video: ListingVideo | null }) {
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
        <p className="text-sm text-muted">
          Photos: JPEG, PNG or WebP up to 10 MB each; the first is the cover. Short video: up to {MAX_VIDEO_SECONDS} seconds and {MAX_VIDEO_MB} MB. Files are compressed and location data is removed.
        </p>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" id="photo-upload" onChange={(e) => upload(e.target.files)} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => input.current?.click()} loading={busy} variant="secondary">
            <ImagePlus className="h-4 w-4" /> Upload photos
          </Button>
          <VideoButton propertyId={propertyId} hasVideo={!!video} />
        </div>
      </div>
      {video && <VideoPanel propertyId={propertyId} video={video} />}
      {list.length === 0 ? (
        <EmptyState icon={<ImagePlus className="h-6 w-6" />} title="No photos yet" body="Add at least one clear, honest photo before submitting for review." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {list.map((img, i) => (
            <li key={img.id} className="card overflow-hidden">
              <div className="relative aspect-[4/3] bg-navy-50">
                <Thumb src={img.thumbUrl} alt={img.alt} />
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

/** How long a video file runs, read in the browser. null when the browser cannot read it (e.g. HEVC). */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (d: number | null) => {
      URL.revokeObjectURL(url);
      resolve(d);
    };
    el.preload = "metadata";
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null);
    el.onerror = () => done(null);
    setTimeout(() => done(null), 5000);
    el.src = url;
  });
}

/** Upload with a progress bar: videos are large and connections slow. */
function uploadWithProgress(path: string, form: FormData, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/v1${path}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = "Upload failed";
      try {
        message = JSON.parse(xhr.responseText)?.error?.message ?? message;
      } catch {}
      reject(new ApiError(message, "ERROR", xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("The upload was interrupted. Check your connection and try again.", "NETWORK", 0));
    xhr.send(form);
  });
}

function VideoButton({ propertyId, hasVideo }: { propertyId: string; hasVideo: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > MAX_VIDEO_MB * 1024 * 1024) return toast.error(`Videos can be up to ${MAX_VIDEO_MB} MB`);
      const seconds = await readDuration(file);
      if (seconds !== null && seconds > MAX_VIDEO_SECONDS + 0.5) return toast.error(`Videos can be up to ${MAX_VIDEO_SECONDS} seconds long. This one is ${Math.round(seconds)} seconds.`);
      if (hasVideo && !window.confirm("Replace the current video?")) return;
      const form = new FormData();
      form.append("file", file);
      setProgress(0);
      await uploadWithProgress(`/properties/${propertyId}/video`, form, setProgress);
      toast.success("Video uploaded. It will show on your listing once it has been converted.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" id="video-upload" onChange={(e) => upload(e.target.files?.[0])} />
      <Button onClick={() => input.current?.click()} loading={progress !== null} variant="outline">
        <Video className="h-4 w-4" /> {progress !== null ? `Uploading ${progress}%` : hasVideo ? "Replace short video" : "Add short video"}
      </Button>
    </>
  );
}

function VideoPanel({ propertyId, video }: { propertyId: string; video: ListingVideo }) {
  const router = useRouter();
  const [current, setCurrent] = useState(video);
  useEffect(() => setCurrent(video), [video]);

  // While the video converts, check every few seconds and refresh once it is done.
  useEffect(() => {
    if (current.status !== "PROCESSING") return;
    const timer = setInterval(async () => {
      try {
        const { video: next } = await api<{ video: ListingVideo | null }>(`/properties/${propertyId}/video`);
        if (!next || next.status !== "PROCESSING") {
          clearInterval(timer);
          router.refresh();
        }
      } catch {
        // Try again on the next tick.
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [current.status, propertyId, router]);

  async function remove() {
    if (!window.confirm("Delete this video?")) return;
    try {
      await api(`/properties/${propertyId}/video`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }

  return (
    <div className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
      <div className="aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-navy-950 sm:w-56">
        {current.status === "READY" && current.url ? (
          <video src={current.url} poster={current.posterUrl ?? undefined} controls preload="none" playsInline className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/70">
            <Video className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="flex-1 text-sm">
        <p className="font-semibold text-navy-900">Short video</p>
        {current.status === "PROCESSING" && <p className="text-muted">Converting your video so it loads quickly. This can take a few minutes; you can leave this page.</p>}
        {current.status === "READY" && <p className="text-muted">Shown on your listing{current.durationSec ? ` · ${current.durationSec} seconds` : ""}.</p>}
        {current.status === "FAILED" && <p className="text-danger">{current.error ?? "We could not convert this video."} Upload it again or try another file.</p>}
      </div>
      <Button size="icon" variant="ghost" aria-label="Delete video" onClick={remove}>
        <Trash2 className="h-4 w-4 text-danger" />
      </Button>
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
