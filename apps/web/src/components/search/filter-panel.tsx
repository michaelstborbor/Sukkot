"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import {
  ELECTRICITY,
  ELECTRICITY_LABELS,
  FURNISHING,
  FURNISHING_LABELS,
  LISTING_PURPOSES,
  LISTING_PURPOSE_LABELS,
  PROPERTY_CATEGORIES,
  PROPERTY_CATEGORY_LABELS,
  WATER_SUPPLY,
  WATER_SUPPLY_LABELS,
  activeFilterCount,
  serializeSearchParams,
  type SearchFilters,
} from "@sukkot/shared";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";

interface Opt {
  value: string;
  label: string;
  parent?: string;
  group?: string;
}

export interface FilterOptions {
  types: Opt[];
  districts: Opt[];
  cities: Opt[];
  localities: Opt[];
  amenities: Opt[];
  /** Some places came from OpenStreetMap, whose licence requires attribution. */
  osmAttribution?: boolean;
}

function toggle<T>(arr: T[] | undefined, v: T): T[] {
  const a = arr ?? [];
  return a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
}

function FilterForm({ initial, options, onApply }: { initial: SearchFilters; options: FilterOptions; onApply: (f: SearchFilters) => void }) {
  const [f, setF] = useState<SearchFilters>(initial);
  useEffect(() => setF(initial), [initial]);
  const set = <K extends keyof SearchFilters>(k: K, v: SearchFilters[K]) => setF((cur) => ({ ...cur, [k]: v === "" ? undefined : v }));
  const cities = useMemo(() => options.cities.filter((c) => !f.district || c.parent === f.district), [options.cities, f.district]);
  const localities = useMemo(() => options.localities.filter((l) => l.parent === f.city), [options.localities, f.city]);
  const num = (v: string) => (v === "" ? undefined : Number(v));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply({ ...f, page: undefined });
      }}
      className="space-y-6"
    >
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Looking to</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {LISTING_PURPOSES.map((p) => (
            <button key={p} type="button" onClick={() => set("purpose", f.purpose === p ? undefined : p)} aria-pressed={f.purpose === p} className={cn("rounded-lg border px-3 py-2 text-sm font-medium transition", f.purpose === p ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-surface hover:border-navy-600")}>
              {LISTING_PURPOSE_LABELS[p]}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="f-cat" className="text-base font-bold">Category</Label>
        <Select id="f-cat" className="text-base font-bold" value={f.category ?? ""} onChange={(e) => set("category", (e.target.value || undefined) as SearchFilters["category"])}>
          <option value="">All categories</option>
          {PROPERTY_CATEGORIES.map((c) => <option key={c} value={c}>{PROPERTY_CATEGORY_LABELS[c]}</option>)}
        </Select>
      </div>

      <fieldset>
        <legend className="mb-2 text-base font-bold">Property type</legend>
        <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto pr-1">
          {options.types.filter((t) => !f.category || t.group === PROPERTY_CATEGORY_LABELS[f.category]).map((t) => (
            <Checkbox key={t.value} id={`f-type-${t.value}`} className="text-base font-bold" label={t.label} checked={!!f.type?.includes(t.value)} onChange={() => set("type", toggle(f.type, t.value))} />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-base font-bold">Location</legend>
        <Select aria-label="District" className="text-base font-bold" value={f.district ?? ""} onChange={(e) => setF((c) => ({ ...c, district: e.target.value || undefined, city: undefined, locality: undefined }))}>
          <option value="">Any district</option>
          {options.districts.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </Select>
        <Select aria-label="City or town" className="text-base font-bold" value={f.city ?? ""} onChange={(e) => setF((c) => ({ ...c, city: e.target.value || undefined, locality: undefined }))}>
          <option value="">Any city or town</option>
          {["Cities", "Towns"].map((g) => {
            const inGroup = cities.filter((c) => c.group === g);
            return inGroup.length > 0 && (
              <optgroup key={g} label={g}>
                {inGroup.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </optgroup>
            );
          })}
        </Select>
        {localities.length > 0 && (
          <Select aria-label="Area or section" className="text-base font-bold" value={f.locality ?? ""} onChange={(e) => set("locality", e.target.value || undefined)}>
            <option value="">Any area or section</option>
            {localities.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </Select>
        )}
        {options.osmAttribution && (
          <p className="text-xs text-muted">
            Place names include data ©{" "}
            <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>.
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Price</legend>
        <div className="grid grid-cols-2 gap-2">
          <Input inputMode="numeric" aria-label="Minimum price" placeholder="Min" value={f.minPrice ?? ""} onChange={(e) => set("minPrice", num(e.target.value.replace(/\D/g, "")))} />
          <Input inputMode="numeric" aria-label="Maximum price" placeholder="Max" value={f.maxPrice ?? ""} onChange={(e) => set("maxPrice", num(e.target.value.replace(/\D/g, "")))} />
        </div>
        <Select aria-label="Currency" className="mt-2" value={f.currency ?? ""} onChange={(e) => set("currency", (e.target.value || undefined) as SearchFilters["currency"])}>
          <option value="">Leones (SLE)</option>
          <option value="SLE">SLE only</option>
          <option value="USD">USD only</option>
        </Select>
        <p className="mt-1 text-xs text-muted">Prices are matched in the listing&apos;s own currency. We never convert silently.</p>
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="f-beds">Bedrooms</Label>
          <Select id="f-beds" value={f.beds ?? ""} onChange={(e) => set("beds", num(e.target.value))}>
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="f-baths">Bathrooms</Label>
          <Select id="f-baths" value={f.baths ?? ""} onChange={(e) => set("baths", num(e.target.value))}>
            <option value="">Any</option>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}+</option>)}
          </Select>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Floor area (m²)</legend>
        <div className="grid grid-cols-2 gap-2">
          <Input inputMode="numeric" aria-label="Minimum floor area" placeholder="Min" value={f.minArea ?? ""} onChange={(e) => set("minArea", num(e.target.value))} />
          <Input inputMode="numeric" aria-label="Maximum floor area" placeholder="Max" value={f.maxArea ?? ""} onChange={(e) => set("maxArea", num(e.target.value))} />
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Plot size</legend>
        <div className="grid grid-cols-2 gap-2">
          <Input inputMode="decimal" aria-label="Minimum plot size" placeholder="Min" value={f.minPlot ?? ""} onChange={(e) => set("minPlot", num(e.target.value))} />
          <Input inputMode="decimal" aria-label="Maximum plot size" placeholder="Max" value={f.maxPlot ?? ""} onChange={(e) => set("maxPlot", num(e.target.value))} />
        </div>
        <p className="mt-1 text-xs text-muted">In the unit used by the listing (town lots, acres, m²).</p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Furnishing</legend>
        <div className="space-y-2">
          {FURNISHING.map((v) => <Checkbox key={v} id={`f-furn-${v}`} label={FURNISHING_LABELS[v]} checked={!!f.furnishing?.includes(v)} onChange={() => set("furnishing", toggle(f.furnishing, v))} />)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Water supply</legend>
        <div className="space-y-2">
          {WATER_SUPPLY.filter((v) => v !== "NONE").map((v) => <Checkbox key={v} id={`f-water-${v}`} label={WATER_SUPPLY_LABELS[v]} checked={!!f.water?.includes(v)} onChange={() => set("water", toggle(f.water, v))} />)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Electricity</legend>
        <div className="space-y-2">
          {ELECTRICITY.filter((v) => v !== "NONE").map((v) => <Checkbox key={v} id={`f-power-${v}`} label={ELECTRICITY_LABELS[v]} checked={!!f.power?.includes(v)} onChange={() => set("power", toggle(f.power, v))} />)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Amenities</legend>
        <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1">
          {options.amenities.map((a) => <Checkbox key={a.value} id={`f-am-${a.value}`} label={a.label} checked={!!f.amenities?.includes(a.value)} onChange={() => set("amenities", toggle(f.amenities, a.value))} />)}
        </div>
      </fieldset>

      <fieldset className="space-y-2.5">
        <legend className="mb-2 text-sm font-semibold">More</legend>
        <Checkbox id="f-verified" label="Documents reviewed only" checked={!!f.verified} onChange={(e) => set("verified", e.target.checked || undefined)} />
        <Checkbox id="f-parking" label="Has parking" checked={!!f.parking} onChange={(e) => set("parking", e.target.checked || undefined)} />
        <Checkbox id="f-avail" label="Available now" checked={!!f.availableOnly} onChange={(e) => set("availableOnly", e.target.checked || undefined)} />
      </fieldset>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="f-by">Listed by</Label>
          <Select id="f-by" value={f.listedBy ?? ""} onChange={(e) => set("listedBy", (e.target.value || undefined) as SearchFilters["listedBy"])}>
            <option value="">Anyone</option>
            <option value="OWNER">Owners</option>
            <option value="AGENT">Agents</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="f-within">Listed within</Label>
          <Select id="f-within" value={f.listedWithin ?? ""} onChange={(e) => set("listedWithin", num(e.target.value))}>
            <option value="">Any time</option>
            {[1, 3, 7, 14, 30, 90].map((d) => <option key={d} value={d}>{d === 1 ? "24 hours" : `${d} days`}</option>)}
          </Select>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-1 flex gap-2 bg-surface px-1 pt-2 pb-1">
        <Button type="button" variant="outline" className="flex-1" onClick={() => onApply({ q: initial.q, sort: initial.sort, view: initial.view })}>Clear</Button>
        <Button type="submit" variant="secondary" className="flex-1">Show results</Button>
      </div>
    </form>
  );
}

export function FilterPanel({ filters, options }: { filters: SearchFilters; options: FilterOptions }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(filters);
  function apply(f: SearchFilters) {
    setOpen(false);
    const qs = serializeSearchParams(f);
    router.push(`/properties${qs ? `?${qs}` : ""}`, { scroll: false });
  }
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <>
      <aside className="hidden lg:block" aria-label="Filters">
        <div className="card sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto p-5">
          <h2 className="mb-4 text-base font-bold text-navy-900">Filters</h2>
          <FilterForm initial={filters} options={options} onApply={apply} />
        </div>
      </aside>
      <Button variant="outline" onClick={() => setOpen(true)} className="lg:hidden" aria-haspopup="dialog">
        <SlidersHorizontal className="h-4 w-4" /> Filters{count ? ` (${count})` : ""}
      </Button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Filters" className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-[fade-in_0.2s] bg-navy-950/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[90vh] animate-[fade-up_0.25s_ease-out] overflow-y-auto rounded-t-2xl bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Filters</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close filters" className="rounded-full p-1.5 hover:bg-navy-50"><X className="h-5 w-5" /></button>
            </div>
            <FilterForm initial={filters} options={options} onApply={apply} />
          </div>
        </div>
      )}
    </>
  );
}
