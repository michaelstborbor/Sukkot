import { useMemo, useState } from "react";
import { Switch, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  LISTING_PURPOSE_LABELS,
  LISTING_PURPOSES,
  parseSearchParams,
  PROPERTY_CATEGORIES,
  PROPERTY_CATEGORY_LABELS,
  serializeSearchParams,
  SORT_LABELS,
  SORT_OPTIONS,
  type SearchFilters,
} from "@sukkot/shared";
import { useMeta } from "@/lib/meta";
import { colors } from "@/lib/theme";
import { Button, ChipGroup, Field, FormScreen, Input, styles as ui } from "@/components/ui";

export default function FiltersScreen() {
  const { qs } = useLocalSearchParams<{ qs?: string }>();
  const meta = useMeta();
  const [f, setF] = useState<SearchFilters>(() => parseSearchParams(new URLSearchParams(qs ?? "")));
  const set = (patch: Partial<SearchFilters>) => setF((prev) => ({ ...prev, ...patch }));
  const locations = useMemo(() => [...(meta?.locations ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [meta]);
  const districts = useMemo(() => locations.filter((l) => l.level === "DISTRICT"), [locations]);
  const district = districts.find((d) => d.slug === f.district);
  // Cities first, then towns, within the chosen district.
  const places = useMemo(
    () => (district ? locations.filter((l) => l.level === "CITY" && l.parentId === district.id).sort((a, b) => Number(!!b.isCity) - Number(!!a.isCity)) : []),
    [locations, district],
  );
  const place = places.find((p) => p.slug === f.city);
  const areas = useMemo(() => (place ? locations.filter((l) => l.level === "LOCALITY" && l.parentId === place.id) : []), [locations, place]);
  const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? undefined : Number(v));

  const apply = (filters: Partial<SearchFilters>) => {
    const params = Object.fromEntries(new URLSearchParams(serializeSearchParams({ ...filters, page: undefined })));
    router.dismissTo({ pathname: "/", params });
  };

  return (
    <FormScreen>
      <Field label="Looking to">
        <ChipGroup options={LISTING_PURPOSES.map((p) => ({ value: p, label: LISTING_PURPOSE_LABELS[p] }))} value={f.purpose} onChange={(purpose) => set({ purpose })} />
      </Field>
      <Field label="Property type">
        <ChipGroup options={PROPERTY_CATEGORIES.map((c) => ({ value: c, label: PROPERTY_CATEGORY_LABELS[c] }))} value={f.category} onChange={(category) => set({ category })} />
      </Field>
      <Field label="District">
        {meta ? (
          <ChipGroup options={districts.map((d) => ({ value: d.slug, label: d.name }))} value={f.district} onChange={(district) => set({ district, city: undefined, locality: undefined })} />
        ) : (
          <Text style={ui.muted}>Loading locations…</Text>
        )}
      </Field>
      {places.length > 0 && (
        <Field label="City or town">
          <ChipGroup options={places.map((p) => ({ value: p.slug, label: p.isCity ? `${p.name} (city)` : p.name }))} value={f.city} onChange={(city) => set({ city, locality: undefined })} />
        </Field>
      )}
      {areas.length > 0 && (
        <Field label="Area or section">
          <ChipGroup options={areas.map((a) => ({ value: a.slug, label: a.name }))} value={f.locality} onChange={(locality) => set({ locality })} />
        </Field>
      )}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label="Min price">
            <Input keyboardType="numeric" value={f.minPrice?.toString() ?? ""} onChangeText={(v) => set({ minPrice: num(v) })} placeholder="Any" />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Max price">
            <Input keyboardType="numeric" value={f.maxPrice?.toString() ?? ""} onChangeText={(v) => set({ maxPrice: num(v) })} placeholder="Any" />
          </Field>
        </View>
      </View>
      <Field label="Currency">
        <ChipGroup options={[{ value: "SLE" as const, label: "Leones (SLE)" }, { value: "USD" as const, label: "US dollars" }]} value={f.currency} onChange={(currency) => set({ currency })} />
      </Field>
      <Field label="Bedrooms (at least)">
        <ChipGroup options={["1", "2", "3", "4", "5"].map((n) => ({ value: n, label: `${n}+` }))} value={f.beds?.toString()} onChange={(v) => set({ beds: v ? Number(v) : undefined })} />
      </Field>
      <ToggleRow label="Verified listers only" value={!!f.verified} onChange={(verified) => set({ verified: verified || undefined })} />
      <ToggleRow label="Hide rented, sold and under offer" value={!!f.availableOnly} onChange={(availableOnly) => set({ availableOnly: availableOnly || undefined })} />
      <Field label="Sort by">
        <ChipGroup options={SORT_OPTIONS.map((o) => ({ value: o, label: SORT_LABELS[o] }))} value={f.sort} onChange={(sort) => set({ sort })} />
      </Field>
      <Button title="Show results" onPress={() => apply(f)} />
      <Button title="Clear all" variant="ghost" onPress={() => apply({ q: f.q })} />
    </FormScreen>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 }}>
      <Text style={ui.label}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.emerald600 }} accessibilityLabel={label} />
    </View>
  );
}
