"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchOption } from "./search-panel";

const PURPOSES = [
  { value: "RENT", label: "Rent" },
  { value: "SALE", label: "Buy" },
  { value: "LEASE", label: "Lease" },
  { value: "SHORT_STAY", label: "Short stay" },
] as const;

/**
 * The compact search on the homepage photo: rent, buy, lease or short stay, then a place. Everything else (type, price,
 * bedrooms) is on the results page.
 */
export function HeroSearch({ locations, className }: { locations: SearchOption[]; className?: string }) {
  const router = useRouter();
  const [purpose, setPurpose] = useState<(typeof PURPOSES)[number]["value"]>("RENT");
  const [place, setPlace] = useState("");
  const groups = [...new Set(locations.map((l) => l.group ?? ""))];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ purpose });
    const [level, slug] = place.split(":");
    if (slug && (level === "city" || level === "district")) params.set(level, slug);
    router.push(`/properties?${params}`);
  }

  return (
    <form onSubmit={submit} role="search" aria-label="Find property" className={cn("flex max-w-3xl flex-col gap-2 rounded-2xl bg-surface p-2 shadow-[var(--shadow-lift)] sm:flex-row", className)}>
      <div className="grid grid-cols-4 rounded-xl bg-sand p-1 sm:flex" role="group" aria-label="Rent, buy, lease or short stay">
        {PURPOSES.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={purpose === p.value}
            onClick={() => setPurpose(p.value)}
            className={cn("flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-base font-bold transition sm:px-4", purpose === p.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label htmlFor="hero-place" className="sr-only">Where</label>
      <select id="hero-place" value={place} onChange={(e) => setPlace(e.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border-0 bg-transparent px-3 text-base font-bold text-ink outline-none focus-visible:ring-2 focus-visible:ring-clay-600">
        <option value="">All of Sierra Leone</option>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {locations.filter((l) => (l.group ?? "") === g).map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-clay-600 px-6 text-base font-bold text-white transition hover:bg-clay-700 active:scale-[0.98]">
        <Search className="h-4 w-4" aria-hidden /> Search
      </button>
    </form>
  );
}
