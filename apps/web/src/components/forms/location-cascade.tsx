"use client";

import { useMemo, useState } from "react";
import { Field, Select } from "@/components/ui/form";

export interface CascadeLocation {
  id: string;
  name: string;
  level: string;
  parentId: string | null;
  isCity?: boolean;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/**
 * District → city or town → area or section. The chosen value is the city/town itself ("the whole
 * place") or one of its areas. Used where a listing's location is picked.
 */
export function LocationCascade({
  locations,
  value,
  onChange,
  error,
  idPrefix = "loc",
}: {
  locations: CascadeLocation[];
  value: string;
  onChange: (locationId: string) => void;
  error?: string;
  idPrefix?: string;
}) {
  const byId = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);
  const initial = useMemo(() => {
    const chosen = byId.get(value);
    const place = chosen?.level === "LOCALITY" ? byId.get(chosen.parentId ?? "") : chosen;
    return { district: place?.parentId ?? "", place: place?.id ?? "" };
  }, [byId, value]);
  const [district, setDistrict] = useState(initial.district);
  const [place, setPlace] = useState(initial.place);

  const districts = useMemo(() => locations.filter((l) => l.level === "DISTRICT").sort(byName), [locations]);
  const places = useMemo(() => locations.filter((l) => l.level === "CITY" && l.parentId === district), [locations, district]);
  const cities = places.filter((p) => p.isCity).sort(byName);
  const towns = places.filter((p) => !p.isCity).sort(byName);
  const areas = useMemo(() => locations.filter((l) => l.level === "LOCALITY" && l.parentId === place).sort(byName), [locations, place]);
  const placeName = byId.get(place)?.name;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field id={`${idPrefix}-district`} label="District" error={!district ? error : undefined}>
        <Select
          id={`${idPrefix}-district`}
          value={district}
          onChange={(e) => {
            setDistrict(e.target.value);
            setPlace("");
            onChange("");
          }}
        >
          <option value="">Choose a district</option>
          {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </Field>
      <Field id={`${idPrefix}-place`} label="City or town" error={district && !place ? error : undefined}>
        <Select
          id={`${idPrefix}-place`}
          value={place}
          disabled={!district}
          onChange={(e) => {
            setPlace(e.target.value);
            onChange(e.target.value);
          }}
        >
          <option value="">{district ? "Choose a city or town" : "Choose a district first"}</option>
          {cities.length > 0 && (
            <optgroup label="Cities">
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          )}
          {towns.length > 0 && (
            <optgroup label="Towns">
              {towns.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
          )}
        </Select>
      </Field>
      <Field id={`${idPrefix}-area`} label="Area or section" optional error={place ? error : undefined}>
        <Select id={`${idPrefix}-area`} value={value !== place ? value : ""} disabled={!place || areas.length === 0} onChange={(e) => onChange(e.target.value || place)}>
          <option value="">{!place ? "Choose a city or town first" : areas.length ? `Anywhere in ${placeName}` : "No areas listed yet"}</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </Field>
    </div>
  );
}
