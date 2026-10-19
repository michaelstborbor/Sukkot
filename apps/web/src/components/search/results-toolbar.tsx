"use client";

import { useRouter } from "next/navigation";
import { LayoutGrid, List, Search } from "lucide-react";
import { useState } from "react";
import { SORT_LABELS, SORT_OPTIONS, serializeSearchParams, type SearchFilters } from "@sukkot/shared";
import { Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export function ResultsToolbar({ filters }: { filters: SearchFilters }) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q ?? "");
  const go = (f: SearchFilters) => {
    const qs = serializeSearchParams(f);
    router.push(`/properties${qs ? `?${qs}` : ""}`, { scroll: false });
  };
  return (
    <div className="flex flex-1 flex-wrap items-center gap-2">
      <form
        className="relative min-w-0 flex-1 basis-56"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go({ ...filters, q: q.trim() || undefined, page: undefined });
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input aria-label="Keyword or reference" placeholder="Keyword, area or reference (SS-…)" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </form>
      <label htmlFor="sort" className="sr-only">Sort by</label>
      <Select id="sort" className="w-auto min-w-44" value={filters.sort ?? "relevant"} onChange={(e) => go({ ...filters, sort: e.target.value as SearchFilters["sort"], page: undefined })}>
        {SORT_OPTIONS.map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
      </Select>
      <div className="flex rounded-[10px] border border-line bg-surface p-0.5" role="group" aria-label="Layout">
        {(["grid", "list"] as const).map((v) => (
          <button key={v} type="button" aria-pressed={(filters.view ?? "grid") === v} onClick={() => go({ ...filters, view: v })} className={cn("rounded-lg p-2 transition", (filters.view ?? "grid") === v ? "bg-navy-900 text-white" : "text-muted hover:text-navy-900")} aria-label={v === "grid" ? "Grid view" : "List view"} title={v === "grid" ? "Grid view" : "List view"}>
            {v === "grid" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
          </button>
        ))}
      </div>
    </div>
  );
}
