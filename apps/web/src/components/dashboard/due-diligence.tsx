"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Select } from "@/components/ui/form";
import { toneFor } from "@/components/dashboard/status-badge";
import { cn } from "@/lib/utils";

const STATUSES = [
  ["NOT_STARTED", "Not started"],
  ["IN_PROGRESS", "In progress"],
  ["DONE", "Done"],
  ["ISSUE_FOUND", "Issue found"],
  ["NOT_APPLICABLE", "Not applicable"],
] as const;

export function DueDiligenceList({ items }: { items: { id: string; title: string; guidance: string; status: string; notes: string | null }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function update(id: string, status: string, notes: string | null) {
    setBusy(id);
    try {
      await api(`/due-diligence/${id}`, { method: "PATCH", body: { status, notes: notes ?? undefined } });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(null);
    }
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((it) => (
        <li key={it.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{it.title}</p>
            <p className="text-xs text-muted">{it.guidance}</p>
            {it.notes && <p className="mt-1 text-xs">{it.notes}</p>}
          </div>
          <Select
            aria-label={`Status of ${it.title}`}
            value={it.status}
            disabled={busy === it.id}
            onChange={(e) => update(it.id, e.target.value, it.notes)}
            className={cn("h-9 w-full text-xs sm:w-40", toneFor(it.status) === "verified" && "border-emerald-600", it.status === "ISSUE_FOUND" && "border-danger")}
          >
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </li>
      ))}
    </ul>
  );
}
