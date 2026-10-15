"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AREA_UNITS,
  AREA_UNIT_LABELS,
  CURRENCIES,
  ELECTRICITY,
  ELECTRICITY_LABELS,
  FURNISHING,
  FURNISHING_LABELS,
  LAND_WITH_BUILDING_TYPE_SLUGS,
  LISTING_PURPOSES,
  OTHER_PROPERTY_TYPE_SLUG,
  LISTING_PURPOSE_LABELS,
  NOTICES,
  RENTAL_PERIODS,
  RENTAL_PERIOD_LABELS,
  WATER_SUPPLY,
  WATER_SUPPLY_LABELS,
  type PropertyCategory,
} from "@sukkot/shared";
import { useApiForm } from "@/hooks/use-api-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { LocationCascade } from "@/components/forms/location-cascade";

export interface ListingFormCatalog {
  types: { id: string; name: string; slug: string; category: PropertyCategory }[];
  amenities: { id: string; name: string; group: string }[];
  locations: { id: string; name: string; level: string; parentId: string | null; isCity: boolean }[];
}

/** Flat string-keyed form state; converted to the API shape on submit. */
export type ListingFormValues = Record<string, string | boolean | string[]>;

const EMPTY: ListingFormValues = {
  title: "",
  description: "",
  propertyTypeId: "",
  propertyTypeOther: "",
  purpose: "RENT",
  price: "",
  currency: "SLE",
  rentalPeriod: "YEAR",
  negotiable: false,
  bedrooms: "",
  bathrooms: "",
  floorArea: "",
  floorAreaUnit: "SQM",
  plotSize: "",
  plotUnit: "",
  furnishing: "",
  waterSupply: "",
  electricity: "",
  parkingSpaces: "",
  securityFeatures: "",
  locationId: "",
  addressLine: "",
  latitude: "",
  longitude: "",
  showExactLocation: false,
  availableFrom: "",
  amenityIds: [],
  videoUrl: "",
  virtualTourUrl: "",
  listerCapacity: "OWNER",
  "rentalTerms.advanceRentPeriods": "",
  "rentalTerms.securityDeposit": "",
  "rentalTerms.minLeaseMonths": "",
  "rentalTerms.utilitiesPaidBy": "",
  "rentalTerms.maintenanceBy": "",
  "rentalTerms.petsAllowed": "",
  "rentalTerms.maxOccupants": "",
  "rentalTerms.otherConditions": "",
  "land.landUse": "",
  "land.accessRoad": "",
  "land.fenced": false,
  "land.surveyPlanRef": "",
  "land.parcelRef": "",
  "land.titleDocumentType": "",
  "commercial.permittedUse": "",
  "commercial.floors": "",
  "commercial.loadingAccess": false,
  "commercial.wheelchairAccessible": false,
};

const RESPONSIBILITY = [
  ["TENANT", "Tenant"],
  ["LANDLORD", "Landlord"],
  ["SHARED", "Shared"],
  ["NEGOTIABLE", "Negotiable"],
] as const;

/** Land listings have no building details, except land sold or leased with a building on it. */
const hasNoBuilding = (type: { slug: string; category: PropertyCategory } | undefined) =>
  type?.category === "LAND" && !LAND_WITH_BUILDING_TYPE_SLUGS.includes(type.slug);

function toPayload(v: ListingFormValues, type: { slug: string; category: PropertyCategory } | undefined) {
  const category = type?.category;
  const noBuilding = hasNoBuilding(type);
  const s = (k: string) => {
    const x = v[k];
    return typeof x === "string" && x.trim() !== "" ? x.trim() : undefined;
  };
  const n = (k: string) => (s(k) !== undefined ? Number(s(k)) : undefined);
  const group = (prefix: string, keys: string[], numeric: string[] = [], bools: string[] = []) => {
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const full = `${prefix}.${k}`;
      if (bools.includes(k)) out[k] = v[full] === true;
      else if (numeric.includes(k)) out[k] = n(full);
      else out[k] = s(full);
    }
    return out;
  };
  const purpose = String(v.purpose);
  return {
    title: s("title") ?? "",
    description: s("description") ?? "",
    propertyTypeId: s("propertyTypeId") ?? "",
    propertyTypeOther: type?.slug === OTHER_PROPERTY_TYPE_SLUG ? s("propertyTypeOther") : undefined,
    purpose,
    price: s("price") ?? "",
    currency: v.currency,
    rentalPeriod: purpose === "SALE" ? null : (s("rentalPeriod") ?? null),
    negotiable: v.negotiable === true,
    bedrooms: noBuilding ? undefined : n("bedrooms"),
    bathrooms: noBuilding ? undefined : n("bathrooms"),
    floorArea: n("floorArea"),
    floorAreaUnit: v.floorAreaUnit,
    plotSize: n("plotSize"),
    plotUnit: s("plotUnit"),
    furnishing: s("furnishing") ?? null,
    waterSupply: s("waterSupply") ?? null,
    electricity: s("electricity") ?? null,
    parkingSpaces: n("parkingSpaces"),
    securityFeatures: String(v.securityFeatures ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.length >= 2),
    locationId: s("locationId") ?? "",
    addressLine: s("addressLine"),
    latitude: n("latitude"),
    longitude: n("longitude"),
    showExactLocation: v.showExactLocation === true,
    availableFrom: s("availableFrom"),
    amenityIds: v.amenityIds,
    videoUrl: s("videoUrl") ?? "",
    virtualTourUrl: s("virtualTourUrl") ?? "",
    listerCapacity: v.listerCapacity,
    rentalTerms:
      purpose === "SALE"
        ? undefined
        : group(
            "rentalTerms",
            ["advanceRentPeriods", "securityDeposit", "minLeaseMonths", "utilitiesPaidBy", "maintenanceBy", "petsAllowed", "maxOccupants", "otherConditions"],
            ["advanceRentPeriods", "minLeaseMonths", "maxOccupants"],
          ),
    land: category === "LAND" ? group("land", ["landUse", "accessRoad", "fenced", "surveyPlanRef", "parcelRef", "titleDocumentType"], [], ["fenced"]) : undefined,
    commercial:
      category === "COMMERCIAL"
        ? group("commercial", ["permittedUse", "floors", "loadingAccess", "wheelchairAccessible"], ["floors"], ["loadingAccess", "wheelchairAccessible"])
        : undefined,
  };
}

export function ListingForm({
  catalog,
  initial,
  propertyId,
  isAgent,
}: {
  catalog: ListingFormCatalog;
  initial?: ListingFormValues;
  propertyId?: string;
  isAgent: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<ListingFormValues>({ ...EMPTY, ...initial });
  const set = (k: string, value: string | boolean | string[]) => setV((prev) => ({ ...prev, [k]: value }));
  const str = (k: string) => String(v[k] ?? "");

  const type = catalog.types.find((t) => t.id === v.propertyTypeId);
  const category = type?.category;
  const isLand = category === "LAND";
  const noBuilding = hasNoBuilding(type);
  const isSale = v.purpose === "SALE";

  const { submit, pending, errors, formError } = useApiForm<{ id: string }>(propertyId ? `/properties/${propertyId}` : "/properties", {
    method: propertyId ? "PATCH" : "POST",
    success: propertyId ? "Listing saved" : "Draft created. Now add photos.",
    onSuccess: (data) => {
      if (!propertyId) router.push(`/dashboard/properties/${data.id}?tab=photos`);
      else router.refresh();
    },
  });

  const amenityGroups = useMemo(() => {
    const g = new Map<string, { id: string; name: string }[]>();
    for (const a of catalog.amenities) g.set(a.group, [...(g.get(a.group) ?? []), a]);
    return [...g.entries()];
  }, [catalog.amenities]);

  const err = (k: string) => errors[k];
  const text = (k: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> & { hint?: string; optional?: boolean } = {}) => {
    const { hint, optional, ...rest } = props;
    return (
      <Field id={`f-${k}`} label={label} error={err(k)} hint={hint} optional={optional}>
        <Input id={`f-${k}`} value={str(k)} onChange={(e) => set(k, e.target.value)} aria-invalid={!!err(k)} {...rest} />
      </Field>
    );
  };
  const select = (k: string, label: string, options: readonly (readonly [string, string])[], opts: { optional?: boolean; placeholder?: string } = {}) => (
    <Field id={`f-${k}`} label={label} error={err(k)} optional={opts.optional}>
      <Select id={`f-${k}`} value={str(k)} onChange={(e) => set(k, e.target.value)} aria-invalid={!!err(k)}>
        {opts.placeholder !== undefined && <option value="">{opts.placeholder}</option>}
        {options.map(([val, lab]) => (
          <option key={val} value={val}>
            {lab}
          </option>
        ))}
      </Select>
    </Field>
  );
  const entries = <T extends string>(values: readonly T[], labels: Record<T, string>) => values.map((x) => [x, labels[x]] as const);

  return (
    <form
      noValidate
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        submit(toPayload(v, type));
      }}
    >
      {formError && <Notice tone="danger">{formError}</Notice>}

      <Section title="Basics" description="What are you offering and where?">
        <div className="grid gap-4 sm:grid-cols-2">
          {select("propertyTypeId", "Property type", catalog.types.map((t) => [t.id, t.name] as const), { placeholder: "Choose a type" })}
          {select("purpose", "Listing for", entries(LISTING_PURPOSES, LISTING_PURPOSE_LABELS))}
          {type?.slug === OTHER_PROPERTY_TYPE_SLUG && text("propertyTypeOther", "What kind of property is it?", { maxLength: 60, placeholder: "e.g. School building, filling station, church hall" })}
        </div>
        {text("title", "Listing title", { maxLength: 140, placeholder: "e.g. Three-bedroom family house with garden in Hill Station" })}
        <Field id="f-description" label="Description" error={err("description")} hint="At least 40 characters. Describe the property honestly, including anything a visitor should know.">
          <Textarea id="f-description" rows={7} value={str("description")} onChange={(e) => set("description", e.target.value)} maxLength={6000} aria-invalid={!!err("description")} />
        </Field>
        <LocationCascade locations={catalog.locations} value={str("locationId")} onChange={(id) => set("locationId", id)} error={err("locationId")} idPrefix="f-loc" />
        {text("addressLine", "Street or landmark", { optional: true, hint: "Shown only if you allow the exact location below.", maxLength: 200 })}
        <div className="grid gap-4 sm:grid-cols-2">
          {text("latitude", "Latitude", { optional: true, inputMode: "decimal", placeholder: "8.4657" })}
          {text("longitude", "Longitude", { optional: true, inputMode: "decimal", placeholder: "-13.2317" })}
        </div>
        <Checkbox id="f-showExact" label="Show the exact location publicly (otherwise visitors see the approximate area only)" checked={v.showExactLocation === true} onChange={(e) => set("showExactLocation", e.target.checked)} />
      </Section>

      <Section title="Price">
        <div className="grid gap-4 sm:grid-cols-3">
          {text("price", isSale ? "Asking price" : "Rent amount", { inputMode: "decimal", placeholder: "85000" })}
          {select("currency", "Currency", CURRENCIES.map((c) => [c, c === "SLE" ? "Leones (SLE)" : "US dollars (USD)"] as const))}
          {!isSale && select("rentalPeriod", "Paid per", entries(RENTAL_PERIODS, RENTAL_PERIOD_LABELS))}
        </div>
        <Checkbox id="f-negotiable" label="Price is negotiable" checked={v.negotiable === true} onChange={(e) => set("negotiable", e.target.checked)} />
      </Section>

      <Section title="Details">
        <div className="grid gap-4 sm:grid-cols-3">
          {!noBuilding && text("bedrooms", "Bedrooms", { inputMode: "numeric" })}
          {!noBuilding && text("bathrooms", "Bathrooms", { inputMode: "numeric" })}
          {!noBuilding && text("parkingSpaces", "Parking spaces", { inputMode: "numeric", optional: true })}
          {text("floorArea", "Floor area", { inputMode: "decimal", optional: !isLand && category !== "COMMERCIAL" })}
          {select("floorAreaUnit", "Floor area unit", entries(AREA_UNITS, AREA_UNIT_LABELS))}
          <span className="hidden sm:block" />
          {text("plotSize", "Plot size", { inputMode: "decimal", optional: !isLand })}
          {select("plotUnit", "Plot unit", entries(AREA_UNITS, AREA_UNIT_LABELS), { placeholder: "Choose a unit", optional: !isLand })}
        </div>
        {!noBuilding && (
          <div className="grid gap-4 sm:grid-cols-3">
            {select("furnishing", "Furnishing", entries(FURNISHING, FURNISHING_LABELS), { placeholder: "Not specified", optional: true })}
            {select("waterSupply", "Water supply", entries(WATER_SUPPLY, WATER_SUPPLY_LABELS), { placeholder: "Not specified", optional: true })}
            {select("electricity", "Electricity", entries(ELECTRICITY, ELECTRICITY_LABELS), { placeholder: "Not specified", optional: true })}
          </div>
        )}
        {text("securityFeatures", "Security features", { optional: true, hint: "Separate with commas, e.g. perimeter wall, security guard, CCTV" })}
        {text("availableFrom", "Available from", { type: "date", optional: true })}
      </Section>

      {category === "LAND" && (
        <Section title="Land information" description="These details help buyers plan their own checks. They are not a substitute for a search at the Ministry of Lands.">
          <div className="grid gap-4 sm:grid-cols-2">
            {select("land.landUse", "Land use", [["RESIDENTIAL", "Residential"], ["COMMERCIAL", "Commercial"], ["AGRICULTURAL", "Agricultural"], ["MIXED", "Mixed use"], ["INDUSTRIAL", "Industrial"]], { placeholder: "Not specified", optional: true })}
            {select("land.accessRoad", "Access road", [["TARRED", "Tarred road"], ["LATERITE", "Laterite road"], ["FOOTPATH", "Footpath only"], ["NONE", "No access road"]], { placeholder: "Not specified", optional: true })}
            {select("land.titleDocumentType", "Title document held", [["CONVEYANCE", "Conveyance"], ["LEASE", "Lease"], ["STATE_GRANT", "State grant"], ["CUSTOMARY", "Customary tenure"], ["OTHER", "Other"], ["NONE", "None yet"]], { placeholder: "Not specified", optional: true })}
            {text("land.surveyPlanRef", "Survey plan reference", { optional: true })}
            {text("land.parcelRef", "Parcel or plot reference", { optional: true })}
          </div>
          <Checkbox id="f-fenced" label="The land is fenced or walled" checked={v["land.fenced"] === true} onChange={(e) => set("land.fenced", e.target.checked)} />
        </Section>
      )}

      {category === "COMMERCIAL" && (
        <Section title="Commercial details">
          <div className="grid gap-4 sm:grid-cols-2">
            {text("commercial.permittedUse", "Permitted use", { optional: true, placeholder: "e.g. Retail, office, warehouse" })}
            {text("commercial.floors", "Number of floors", { optional: true, inputMode: "numeric" })}
          </div>
          <Checkbox id="f-loading" label="Loading access for vehicles" checked={v["commercial.loadingAccess"] === true} onChange={(e) => set("commercial.loadingAccess", e.target.checked)} />
          <Checkbox id="f-wheelchair" label="Step-free or wheelchair accessible" checked={v["commercial.wheelchairAccessible"] === true} onChange={(e) => set("commercial.wheelchairAccessible", e.target.checked)} />
        </Section>
      )}

      {!isSale && (
        <Section title="Rental terms" description={NOTICES.rentalTermsReview}>
          <div className="grid gap-4 sm:grid-cols-3">
            {text("rentalTerms.advanceRentPeriods", "Advance rent required (periods)", { optional: true, inputMode: "numeric", hint: "e.g. 12 for one year in advance" })}
            {text("rentalTerms.securityDeposit", "Security deposit", { optional: true, inputMode: "decimal" })}
            {text("rentalTerms.minLeaseMonths", "Minimum lease (months)", { optional: true, inputMode: "numeric" })}
            {select("rentalTerms.utilitiesPaidBy", "Utilities paid by", RESPONSIBILITY, { placeholder: "Not specified", optional: true })}
            {select("rentalTerms.maintenanceBy", "Maintenance by", RESPONSIBILITY, { placeholder: "Not specified", optional: true })}
            {select("rentalTerms.petsAllowed", "Pets", [["YES", "Allowed"], ["NO", "Not allowed"], ["ON_REQUEST", "On request"]], { placeholder: "Not specified", optional: true })}
            {text("rentalTerms.maxOccupants", "Maximum occupants", { optional: true, inputMode: "numeric" })}
          </div>
          <Field id="f-otherConditions" label="Other conditions" optional error={err("rentalTerms.otherConditions")}>
            <Textarea id="f-otherConditions" rows={3} value={str("rentalTerms.otherConditions")} onChange={(e) => set("rentalTerms.otherConditions", e.target.value)} maxLength={2000} />
          </Field>
        </Section>
      )}

      {!noBuilding && amenityGroups.length > 0 && (
        <Section title="Amenities">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {amenityGroups.map(([group, items]) => (
              <fieldset key={group}>
                <legend className="mb-2 text-sm font-semibold text-navy-900">{group}</legend>
                <div className="space-y-2">
                  {items.map((a) => {
                    const ids = v.amenityIds as string[];
                    return (
                      <Checkbox
                        key={a.id}
                        id={`am-${a.id}`}
                        label={a.name}
                        checked={ids.includes(a.id)}
                        onChange={(e) => set("amenityIds", e.target.checked ? [...ids, a.id] : ids.filter((x) => x !== a.id))}
                      />
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </Section>
      )}

      <Section title="Media links" description="Optional. Photos are uploaded on the next step.">
        <div className="grid gap-4 sm:grid-cols-2">
          {text("videoUrl", "Video URL", { optional: true, type: "url", placeholder: "https://" })}
          {text("virtualTourUrl", "Virtual tour URL", { optional: true, type: "url", placeholder: "https://" })}
        </div>
      </Section>

      <Section title="Your authority to list" description="Listing a property you are not authorised to market is not allowed and may lead to account suspension.">
        {select(
          "listerCapacity",
          "I am listing this property as",
          isAgent
            ? [
                ["OWNER", "The owner"],
                ["AGENT_FOR_OWNER", "An agent acting for the owner"],
                ["AGENT_FOR_DEVELOPER", "An agent acting for a developer"],
                ["DEVELOPER", "The developer"],
                ["OTHER_AUTHORISED", "Another authorised representative"],
              ]
            : [
                ["OWNER", "The owner"],
                ["DEVELOPER", "The developer"],
              ],
        )}
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-xl sm:border">
        <p className="text-xs text-muted">{propertyId ? "Saving does not change the listing's review status." : "Your listing is saved as a draft. You can submit it for review after adding photos."}</p>
        <Button type="submit" loading={pending}>
          {propertyId ? "Save changes" : "Save draft and continue"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-bold text-navy-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}
