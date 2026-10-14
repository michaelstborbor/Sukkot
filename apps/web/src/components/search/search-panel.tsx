"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { serializeSearchParams, type ListingPurpose } from "@sukkot/shared";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export interface SearchOption {
  value: string;
  label: string;
  group?: string;
}

const TABS: { value: ListingPurpose | ""; label: string }[] = [
  { value: "RENT", label: "Rent" },
  { value: "SALE", label: "Buy" },
  { value: "LEASE", label: "Lease" },
  { value: "SHORT_STAY", label: "Short stay" },
];

const PRICE_PRESETS: Record<string, { label: string; value: string }[]> = {
  RENT: [
    { label: "Up to Le 5,000 / mo", value: "0-5000" },
    { label: "Le 5,000 – 15,000", value: "5000-15000" },
    { label: "Le 15,000 – 40,000", value: "15000-40000" },
    { label: "Le 40,000+", value: "40000-" },
  ],
  SALE: [
    { label: "Up to Le 100,000", value: "0-100000" },
    { label: "Le 100,000 – 500,000", value: "100000-500000" },
    { label: "Le 500,000 – 2M", value: "500000-2000000" },
    { label: "Le 2M+", value: "2000000-" },
  ],
};

export function SearchPanel({ types, locations, className }: { types: SearchOption[]; locations: SearchOption[]; className?: string }) {
  const router = useRouter();
  const [purpose, setPurpose] = useState<ListingPurpose>("RENT");
  const [type, setType] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [pending, setPending] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const [min, max] = price ? price.split("-") : [];
    const [level, slug] = location ? location.split(":") : [];
    const qs = serializeSearchParams({
      purpose,
      type: type ? [type] : undefined,
      ...(level && slug ? { [level as "district"]: slug } : {}),
      minPrice: min ? Number(min) : undefined,
      maxPrice: max ? Number(max) : undefined,
    });
    router.push(`/properties${qs ? `?${qs}` : ""}`);
  }

  const presets = PRICE_PRESETS[purpose] ?? PRICE_PRESETS.RENT!;
  return (
    <form onSubmit={submit} role="search" aria-label="Search properties" className={cn("rounded-2xl bg-white p-3 shadow-[var(--shadow-pop)] sm:p-4", className)}>
      <div role="tablist" aria-label="Listing purpose" className="mb-3 flex gap-1 overflow-x-auto rounded-xl bg-navy-50 p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={purpose === t.value}
            onClick={() => {
              setPurpose(t.value as ListingPurpose);
              setPrice("");
            }}
            className={cn("flex-1 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition", purpose === t.value ? "bg-white text-navy-900 shadow-sm" : "text-muted hover:text-navy-900")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1fr_auto]">
        <div>
          <label htmlFor="sp-type" className="sr-only">Property type</label>
          <Select id="sp-type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Any property type</option>
            {types.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="sp-loc" className="sr-only">Location</label>
          <Select id="sp-loc" value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">All of Sierra Leone</option>
            {Object.entries(
              locations.reduce<Record<string, SearchOption[]>>((acc, l) => {
                (acc[l.group ?? "Locations"] ??= []).push(l);
                return acc;
              }, {}),
            ).map(([group, opts]) => (
              <optgroup key={group} label={group}>
                {opts.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="sp-price" className="sr-only">Price range</label>
          <Select id="sp-price" value={price} onChange={(e) => setPrice(e.target.value)}>
            <option value="">Any price</option>
            {presets.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary" size="md" loading={pending} className="sm:col-span-2 lg:col-span-1 lg:px-6">
          <Search className="h-4 w-4" aria-hidden /> Search
        </Button>
      </div>
    </form>
  );
}
