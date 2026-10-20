"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  AREA_UNITS,
  AREA_UNIT_LABELS,
  CURRENCIES,
  ELECTRICITY,
  ELECTRICITY_LABELS,
  FURNISHING,
  FURNISHING_LABELS,
  CATEGORY_ATTRIBUTE_GROUP,
  LISTING_PURPOSES,
  OTHER_PROPERTY_TYPE_SLUG,
  LISTING_PURPOSE_LABELS,
  NOTICES,
  RENTAL_PERIODS,
  RENTAL_PERIOD_LABELS,
  WATER_SUPPLY,
  WATER_SUPPLY_LABELS,
  listingFormKind,
  propertyInputSchema,
  type ListingFormKind,
  type ListingPurpose,
  type PropertyCategory,
  type RentalPeriod,
} from "@sukkot/shared";
import { useApiForm } from "@/hooks/use-api-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { LocationCascade } from "@/components/forms/location-cascade";
import { ListingSteps } from "@/components/dashboard/listing-steps";

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
  "commercial.rooms": "",
  "commercial.loadingAccess": false,
  "commercial.wheelchairAccessible": false,
  "house.houseStyle": "",
  "house.storeys": "",
  "house.boysQuarters": false,
  "house.walledCompound": false,
  "apartment.floorLevel": "",
  "apartment.buildingFloors": "",
  "apartment.selfContained": false,
  "apartment.lift": false,
  "shortStay.maxGuests": "",
  "shortStay.minNights": "",
  "shortStay.checkIn": "",
  "shortStay.checkOut": "",
  privateContactPhone: "",
  privateContactEmail: "",
};

const RESPONSIBILITY = [
  ["TENANT", "Tenant"],
  ["LANDLORD", "Landlord"],
  ["SHARED", "Shared"],
  ["NEGOTIABLE", "Negotiable"],
] as const;

type TermsSet = "full" | "land" | "stay" | "commercial";

/**
 * What the form asks for each kind of property. Fields a kind does not show are not sent, so a value
 * typed before the type was changed cannot end up on the listing.
 */
interface Layout {
  purposes: readonly ListingPurpose[];
  /** Bedrooms and bathrooms. */
  rooms: boolean;
  parking: boolean;
  floorArea: "required" | "optional" | false;
  plot: "required" | "optional" | false;
  /** Furnishing, water supply and electricity. */
  services: boolean;
  security: boolean;
  amenities: boolean;
  terms: TermsSet;
  titleExample: string;
  descriptionExample: string;
}

const ALL_PURPOSES = LISTING_PURPOSES;
const LAYOUTS: Record<ListingFormKind, Layout> = {
  EMPTY_LAND: {
    purposes: ["SALE", "LEASE", "RENT"],
    rooms: false,
    parking: false,
    floorArea: false,
    plot: "required",
    services: false,
    security: false,
    amenities: false,
    terms: "land",
    titleExample: "e.g. Half town lot of dry land with a conveyance in Waterloo",
    descriptionExample:
      "e.g. Half town lot of dry, level land in a quiet residential area of Waterloo, five minutes from the main road. Conveyance and survey plan available. Neighbours have EDSA power and water is close by. Good for a family house.",
  },
  LAND_WITH_BUILDING: {
    purposes: ["SALE", "LEASE", "RENT"],
    rooms: true,
    parking: true,
    floorArea: "optional",
    plot: "required",
    services: true,
    security: true,
    amenities: true,
    terms: "full",
    titleExample: "e.g. One town lot with an unfinished four-bedroom house in Kossoh Town",
    descriptionExample:
      "e.g. One town lot in Kossoh Town with a four-bedroom house built to roof level. Walled and gated, with a borehole. Conveyance and survey plan available. The road is laterite and passable all year.",
  },
  HOUSE: {
    purposes: ["RENT", "SALE", "LEASE", "SHORT_STAY"],
    rooms: true,
    parking: true,
    floorArea: "optional",
    plot: "optional",
    services: true,
    security: true,
    amenities: true,
    terms: "full",
    titleExample: "e.g. Three-bedroom family house with garden in Hill Station",
    descriptionExample:
      "e.g. Spacious three-bedroom house in a quiet, walled compound in Hill Station. Two bathrooms (one en suite), fitted kitchen, tiled floors and a large veranda. EDSA power with a backup generator, borehole water and an overhead tank. Parking for two cars. Ten minutes' drive to Wilkinson Road, close to schools and shops.",
  },
  APARTMENT: {
    purposes: ["RENT", "SALE", "LEASE", "SHORT_STAY"],
    rooms: true,
    parking: true,
    floorArea: "optional",
    plot: false,
    services: true,
    security: true,
    amenities: true,
    terms: "full",
    titleExample: "e.g. Self-contained two-bedroom flat in Aberdeen",
    descriptionExample:
      "e.g. Bright two-bedroom, self-contained flat on the first floor of a gated building in Aberdeen. Two bathrooms, open-plan kitchen and living room, and a balcony. Constant water from a tank and pump, EDSA power with a shared generator. One parking space, security guard at night.",
  },
  SHORT_STAY: {
    purposes: ["SHORT_STAY"],
    rooms: true,
    parking: true,
    floorArea: "optional",
    plot: false,
    services: true,
    security: true,
    amenities: true,
    terms: "stay",
    titleExample: "e.g. Furnished one-bedroom apartment near Lumley Beach",
    descriptionExample:
      "e.g. Fully furnished one-bedroom apartment a short walk from Lumley Beach. Air conditioning, Wi-Fi, a fully equipped kitchen and 24-hour power from solar and a generator. Fresh towels and bed linen, cleaning twice a week. Secure parking and a guard at night.",
  },
  COMMERCIAL: {
    purposes: ["RENT", "SALE", "LEASE"],
    rooms: false,
    parking: true,
    floorArea: "required",
    plot: "optional",
    services: true,
    security: true,
    amenities: true,
    terms: "commercial",
    titleExample: "e.g. Ground-floor shop on Kissy Road",
    descriptionExample:
      "e.g. Ground-floor shop of about 40 m² on busy Kissy Road, with a roller shutter, a store room and a toilet. Prepaid EDSA meter. Suitable for retail, a pharmacy or a mobile money shop.",
  },
  HOSPITALITY: {
    purposes: ["SALE", "LEASE", "RENT"],
    rooms: false,
    parking: true,
    floorArea: "optional",
    plot: "optional",
    services: true,
    security: true,
    amenities: true,
    terms: "commercial",
    titleExample: "e.g. Twelve-room guesthouse with restaurant in Bo",
    descriptionExample:
      "e.g. Running guesthouse in central Bo with twelve en-suite rooms, a restaurant and bar, staff quarters and parking for ten cars. Generator and solar back-up, borehole water. Sold with furniture and equipment.",
  },
  OTHER: {
    purposes: ALL_PURPOSES,
    rooms: true,
    parking: true,
    floorArea: "optional",
    plot: "optional",
    services: true,
    security: true,
    amenities: true,
    terms: "full",
    titleExample: "e.g. Former school building on two town lots in Makeni",
    descriptionExample: "e.g. Describe what the property is, its size and condition, and what it could be used for.",
  },
};

/** The rental-term fields each set shows, with labels where a set words a field differently. */
const TERMS_FIELDS: Record<TermsSet, { key: string; label?: string }[]> = {
  full: [
    { key: "advanceRentPeriods" },
    { key: "securityDeposit" },
    { key: "minLeaseMonths" },
    { key: "utilitiesPaidBy" },
    { key: "maintenanceBy" },
    { key: "petsAllowed" },
    { key: "maxOccupants" },
    { key: "otherConditions" },
  ],
  land: [{ key: "advanceRentPeriods" }, { key: "minLeaseMonths" }, { key: "otherConditions", label: "Conditions of use" }],
  stay: [{ key: "securityDeposit", label: "Refundable damage deposit" }, { key: "petsAllowed" }, { key: "otherConditions", label: "House rules" }],
  commercial: [
    { key: "advanceRentPeriods" },
    { key: "securityDeposit" },
    { key: "minLeaseMonths" },
    { key: "utilitiesPaidBy" },
    { key: "maintenanceBy" },
    { key: "otherConditions" },
  ],
};
const NUMERIC_TERMS = ["advanceRentPeriods", "minLeaseMonths", "maxOccupants"];

const STAY_PERIODS: readonly RentalPeriod[] = ["DAY", "WEEK", "MONTH"];
const LONG_PERIODS: readonly RentalPeriod[] = ["MONTH", "QUARTER", "HALF_YEAR", "YEAR"];
const periodsFor = (purpose: string) => (purpose === "SHORT_STAY" ? STAY_PERIODS : LONG_PERIODS);

/** Keep the purpose and rent period valid for the chosen type, so switching type never leaves a choice the form no longer offers. */
function fitToType(v: ListingFormValues, kind: ListingFormKind | null): ListingFormValues {
  if (!kind) return v;
  const next = { ...v };
  const purposes = LAYOUTS[kind].purposes;
  if (!purposes.includes(String(next.purpose) as ListingPurpose)) next.purpose = purposes[0]!;
  const periods = periodsFor(String(next.purpose));
  if (!periods.includes(String(next.rentalPeriod) as RentalPeriod)) next.rentalPeriod = next.purpose === "SHORT_STAY" ? "DAY" : "YEAR";
  return next;
}

/** Fields on the first page of a new listing; everything else is on the second. */
const BASICS_FIELDS = new Set(["propertyTypeId", "propertyTypeOther", "purpose", "title", "description", "locationId", "addressLine", "latitude", "longitude"]);
const stepOf = (field: string) => (BASICS_FIELDS.has(field.split(".")[0]!) ? 0 : 1);

/** Plain words for the checks a lister is most likely to trip, in place of the validator's generic wording. */
const PLAIN_ERRORS: Record<string, string> = {
  propertyTypeId: "Choose a property type",
  title: "Give the listing a title of at least 8 characters",
  locationId: "Choose the district and the city or town",
  price: "Enter the price, numbers only",
  bedrooms: "Enter the number of bedrooms",
  bathrooms: "Enter the number of bathrooms",
  privateContactPhone: "Enter a Sierra Leone phone number, e.g. 076 123 456",
};
const plain = (field: string, message: string) => (/^(String must|Required|Expected|Invalid)/.test(message) ? (PLAIN_ERRORS[field] ?? message) : message);

function toPayload(v: ListingFormValues, type: { slug: string; category: PropertyCategory } | undefined) {
  const category = type?.category;
  const kind = listingFormKind(type);
  const layout = kind ? LAYOUTS[kind] : LAYOUTS.OTHER;
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
  const terms = TERMS_FIELDS[purpose === "SHORT_STAY" ? "stay" : layout.terms].map((t) => t.key);
  const attributeGroup = category ? CATEGORY_ATTRIBUTE_GROUP[category] : undefined;
  const attributes: Record<string, () => Record<string, unknown>> = {
    land: () => group("land", ["landUse", "accessRoad", "fenced", "surveyPlanRef", "parcelRef", "titleDocumentType"], [], ["fenced"]),
    commercial: () =>
      kind === "HOSPITALITY"
        ? group("commercial", ["permittedUse", "rooms", "floors", "wheelchairAccessible"], ["rooms", "floors"], ["wheelchairAccessible"])
        : group("commercial", ["permittedUse", "floors", "loadingAccess", "wheelchairAccessible"], ["floors"], ["loadingAccess", "wheelchairAccessible"]),
    house: () => group("house", ["houseStyle", "storeys", "boysQuarters", "walledCompound"], ["storeys"], ["boysQuarters", "walledCompound"]),
    apartment: () => group("apartment", ["floorLevel", "buildingFloors", "selfContained", "lift"], ["floorLevel", "buildingFloors"], ["selfContained", "lift"]),
    shortStay: () => group("shortStay", ["maxGuests", "minNights", "checkIn", "checkOut"], ["maxGuests", "minNights"]),
  };
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
    bedrooms: layout.rooms ? n("bedrooms") : undefined,
    bathrooms: layout.rooms ? n("bathrooms") : undefined,
    floorArea: layout.floorArea ? n("floorArea") : undefined,
    floorAreaUnit: v.floorAreaUnit,
    plotSize: layout.plot ? n("plotSize") : undefined,
    plotUnit: layout.plot ? s("plotUnit") : undefined,
    furnishing: layout.services ? (s("furnishing") ?? null) : null,
    waterSupply: layout.services ? (s("waterSupply") ?? null) : null,
    electricity: layout.services ? (s("electricity") ?? null) : null,
    parkingSpaces: layout.parking ? n("parkingSpaces") : undefined,
    securityFeatures: layout.security
      ? String(v.securityFeatures ?? "")
          .split(",")
          .map((x) => x.trim())
          .filter((x) => x.length >= 2)
      : [],
    locationId: s("locationId") ?? "",
    addressLine: s("addressLine"),
    latitude: n("latitude"),
    longitude: n("longitude"),
    showExactLocation: v.showExactLocation === true,
    availableFrom: s("availableFrom"),
    amenityIds: layout.amenities ? v.amenityIds : [],
    videoUrl: s("videoUrl") ?? "",
    virtualTourUrl: s("virtualTourUrl") ?? "",
    listerCapacity: v.listerCapacity,
    privateContactPhone: s("privateContactPhone") ?? "",
    privateContactEmail: s("privateContactEmail") ?? "",
    rentalTerms: purpose === "SALE" ? undefined : group("rentalTerms", terms, NUMERIC_TERMS.filter((k) => terms.includes(k))),
    ...(attributeGroup ? { [attributeGroup]: attributes[attributeGroup]!() } : {}),
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
  const findType = (id: unknown) => catalog.types.find((t) => t.id === id);
  const set = (k: string, value: string | boolean | string[]) =>
    setV((prev) => {
      const next = { ...prev, [k]: value };
      return k === "propertyTypeId" || k === "purpose" ? fitToType(next, listingFormKind(findType(next.propertyTypeId))) : next;
    });
  const str = (k: string) => String(v[k] ?? "");
  // A new listing is filled in over two pages; editing shows everything on one.
  const wizard = !propertyId;
  const [step, setStep] = useState(0);
  const [checkErrors, setCheckErrors] = useState<Record<string, string>>({});

  const type = findType(v.propertyTypeId);
  const kind = listingFormKind(type);
  const layout = kind ? LAYOUTS[kind] : null;
  const isSale = v.purpose === "SALE";
  const isStay = v.purpose === "SHORT_STAY";
  const terms = layout ? TERMS_FIELDS[isStay ? "stay" : layout.terms] : [];

  const { submit, pending, errors, formError } = useApiForm<{ id: string }>(propertyId ? `/properties/${propertyId}` : "/properties", {
    method: propertyId ? "PATCH" : "POST",
    success: propertyId ? "Listing saved" : "Draft created. Now add photos.",
    onSuccess: (data) => {
      if (!propertyId) router.push(`/dashboard/properties/${data.id}/finish`);
      else router.refresh();
    },
  });

  /** Check this page's fields before moving on, so mistakes show where they were made. */
  function checkStep(current: number) {
    const parsed = propertyInputSchema.safeParse(toPayload(v, type));
    const found: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (stepOf(key) === current && !found[key]) found[key] = issue.message;
      }
    }
    if (current === 0 && type?.slug === OTHER_PROPERTY_TYPE_SLUG && !str("propertyTypeOther").trim()) found.propertyTypeOther = "Say what kind of property it is";
    if (current === 1 && !str("privateContactPhone").trim()) found.privateContactPhone = "Enter a phone number our team can reach you on";
    setCheckErrors(found);
    return Object.keys(found).length === 0;
  }
  function goTo(next: number) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  // If the server finds a problem on the first page, take the lister back to it.
  useEffect(() => {
    const keys = Object.keys(errors);
    if (wizard && keys.length) setStep(Math.min(...keys.map(stepOf)));
  }, [errors, wizard]);

  const amenityGroups = useMemo(() => {
    const g = new Map<string, { id: string; name: string }[]>();
    for (const a of catalog.amenities) g.set(a.group, [...(g.get(a.group) ?? []), a]);
    return [...g.entries()];
  }, [catalog.amenities]);

  const err = (k: string) => {
    const message = errors[k] ?? checkErrors[k];
    return message ? plain(k, message) : undefined;
  };
  const show = (s: number) => !wizard || step === s;
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
  const check = (k: string, label: string) => <Checkbox id={`f-${k}`} label={label} checked={v[k] === true} onChange={(e) => set(k, e.target.checked)} />;
  const entries = <T extends string>(values: readonly T[], labels: Record<T, string>) => values.map((x) => [x, labels[x]] as const);
  // Keep a period an older listing already uses selectable, even if the form no longer offers it for this type.
  const periods = [...new Set([...periodsFor(String(v.purpose)), ...(RENTAL_PERIODS.includes(v.rentalPeriod as RentalPeriod) ? [v.rentalPeriod as RentalPeriod] : [])])];
  const purposes = layout ? [...new Set([...layout.purposes, v.purpose as ListingPurpose])] : LISTING_PURPOSES;
  const termField = (t: { key: string; label?: string }) => {
    const k = `rentalTerms.${t.key}`;
    switch (t.key) {
      case "advanceRentPeriods":
        return text(k, t.label ?? `Advance ${isStay ? "payment" : "rent"} required (periods)`, { optional: true, inputMode: "numeric", hint: "e.g. 12 for one year in advance" });
      case "securityDeposit":
        return text(k, t.label ?? "Security deposit", { optional: true, inputMode: "decimal" });
      case "minLeaseMonths":
        return text(k, t.label ?? "Minimum lease (months)", { optional: true, inputMode: "numeric" });
      case "utilitiesPaidBy":
        return select(k, t.label ?? "Utilities paid by", RESPONSIBILITY, { placeholder: "Not specified", optional: true });
      case "maintenanceBy":
        return select(k, t.label ?? "Maintenance by", RESPONSIBILITY, { placeholder: "Not specified", optional: true });
      case "petsAllowed":
        return select(k, t.label ?? "Pets", [["YES", "Allowed"], ["NO", "Not allowed"], ["ON_REQUEST", "On request"]], { placeholder: "Not specified", optional: true });
      case "maxOccupants":
        return text(k, t.label ?? "Maximum occupants", { optional: true, inputMode: "numeric" });
      default:
        return null;
    }
  };
  const other = terms.find((t) => t.key === "otherConditions");

  return (
    <form
      noValidate
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (!layout) {
          setCheckErrors({ propertyTypeId: "Choose a property type" });
          return;
        }
        if (wizard && step === 0) {
          if (checkStep(0)) goTo(1);
          return;
        }
        if (wizard && !checkStep(1)) return;
        setCheckErrors({});
        submit(toPayload(v, type));
      }}
    >
      {wizard && <ListingSteps current={step} />}
      {formError && <Notice tone="danger">{formError}</Notice>}

      {show(0) && (
        <Section title="Basics" description="What are you offering and where?">
          <div className="grid gap-4 sm:grid-cols-2">
            {select("propertyTypeId", "Property type", catalog.types.map((t) => [t.id, t.name] as const), { placeholder: "Choose a type" })}
            {layout && (purposes.length > 1 ? select("purpose", "Listing for", purposes.map((x) => [x, LISTING_PURPOSE_LABELS[x]] as const)) : (
              <Field id="f-purpose" label="Listing for">
                <Input id="f-purpose" value={LISTING_PURPOSE_LABELS[purposes[0]!]} readOnly />
              </Field>
            ))}
            {type?.slug === OTHER_PROPERTY_TYPE_SLUG && text("propertyTypeOther", "What kind of property is it?", { maxLength: 60, placeholder: "e.g. School building, filling station, church hall" })}
          </div>
          {!layout ? (
            <Notice tone="info">Choose the property type first. The form then asks only what applies to that kind of property.</Notice>
          ) : (
            <>
              {text("title", "Listing title", { maxLength: 140, placeholder: layout.titleExample })}
              <Field id="f-description" label="Description" error={err("description")} hint="Describe the property honestly, including anything a visitor should know. Phone numbers are hidden from visitors, because enquiries come through the Sukkot Salone team.">
                <Textarea id="f-description" rows={7} value={str("description")} onChange={(e) => set("description", e.target.value)} maxLength={6000} placeholder={layout.descriptionExample} aria-invalid={!!err("description")} />
              </Field>
              <LocationCascade locations={catalog.locations} value={str("locationId")} onChange={(id) => set("locationId", id)} error={err("locationId")} idPrefix="f-loc" />
              <div className="grid gap-4 sm:grid-cols-2">
                {text("latitude", "Latitude", { optional: true, inputMode: "decimal", placeholder: "8.4657" })}
                {text("longitude", "Longitude", { optional: true, inputMode: "decimal", placeholder: "-13.2317" })}
              </div>
              <Checkbox id="f-showExact" label="Show the exact location publicly (otherwise visitors see the approximate area only)" checked={v.showExactLocation === true} onChange={(e) => set("showExactLocation", e.target.checked)} />
            </>
          )}
        </Section>
      )}

      {show(1) && layout && (
        <>
          <Section title="Price">
            <div className="grid gap-4 sm:grid-cols-3">
              {text("price", isSale ? "Asking price" : isStay ? "Price" : v.purpose === "LEASE" ? "Lease amount" : "Rent amount", { inputMode: "decimal", placeholder: isStay ? "750" : "85000" })}
              {select("currency", "Currency", CURRENCIES.map((c) => [c, c === "SLE" ? "Leones (SLE)" : "US dollars (USD)"] as const))}
              {!isSale && select("rentalPeriod", isStay ? "Per" : "Paid per", periods.map((x) => [x, RENTAL_PERIOD_LABELS[x]] as const))}
            </div>
            <Checkbox id="f-negotiable" label="Price is negotiable" checked={v.negotiable === true} onChange={(e) => set("negotiable", e.target.checked)} />
          </Section>

          <Section title={kind === "EMPTY_LAND" ? "Size" : "Details"}>
            <div className="grid gap-4 sm:grid-cols-3">
              {layout.rooms && text("bedrooms", "Bedrooms", { inputMode: "numeric", optional: kind === "OTHER" })}
              {layout.rooms && text("bathrooms", "Bathrooms", { inputMode: "numeric", optional: kind === "OTHER" })}
              {layout.parking && text("parkingSpaces", "Parking spaces", { inputMode: "numeric", optional: true })}
            </div>
            {(layout.floorArea || layout.plot) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {layout.floorArea && text("floorArea", kind === "COMMERCIAL" ? "Usable floor area" : "Floor area", { inputMode: "decimal", optional: layout.floorArea === "optional" })}
                {layout.floorArea && select("floorAreaUnit", "Floor area unit", entries(AREA_UNITS, AREA_UNIT_LABELS))}
                {layout.plot && text("plotSize", "Plot size", { inputMode: "decimal", optional: layout.plot === "optional" })}
                {layout.plot && select("plotUnit", "Plot unit", entries(AREA_UNITS, AREA_UNIT_LABELS), { placeholder: "Choose a unit", optional: layout.plot === "optional" })}
              </div>
            )}
            {layout.services && (
              <div className="grid gap-4 sm:grid-cols-3">
                {select("furnishing", "Furnishing", entries(FURNISHING, FURNISHING_LABELS), { placeholder: "Not specified", optional: true })}
                {select("waterSupply", "Water supply", entries(WATER_SUPPLY, WATER_SUPPLY_LABELS), { placeholder: "Not specified", optional: true })}
                {select("electricity", "Electricity", entries(ELECTRICITY, ELECTRICITY_LABELS), { placeholder: "Not specified", optional: true })}
              </div>
            )}
            {layout.security && text("securityFeatures", "Security features", { optional: true, hint: "Separate with commas, e.g. perimeter wall, security guard, CCTV" })}
            {text("availableFrom", "Available from", { type: "date", optional: true })}
          </Section>

          {kind === "HOUSE" && (
            <Section title="About the house">
              <div className="grid gap-4 sm:grid-cols-2">
                {select("house.houseStyle", "Type of house", [["BUNGALOW", "Bungalow"], ["STOREY", "Storey building"], ["DUPLEX", "Duplex"], ["TERRACED", "Terraced"], ["SEMI_DETACHED", "Semi-detached"], ["OTHER", "Other"]], { placeholder: "Not specified", optional: true })}
                {text("house.storeys", "Number of storeys", { optional: true, inputMode: "numeric" })}
              </div>
              {check("house.boysQuarters", "Has boys' quarters")}
              {check("house.walledCompound", "In a walled or fenced compound")}
            </Section>
          )}

          {kind === "APARTMENT" && (
            <Section title="About the apartment">
              <div className="grid gap-4 sm:grid-cols-2">
                {text("apartment.floorLevel", "Which floor", { optional: true, inputMode: "numeric", hint: "0 for the ground floor" })}
                {text("apartment.buildingFloors", "Floors in the building", { optional: true, inputMode: "numeric" })}
              </div>
              {check("apartment.selfContained", "Self-contained (own kitchen, bathroom and entrance)")}
              {check("apartment.lift", "The building has a lift")}
            </Section>
          )}

          {kind === "SHORT_STAY" && (
            <Section title="About the stay">
              <div className="grid gap-4 sm:grid-cols-2">
                {text("shortStay.maxGuests", "Sleeps (guests)", { inputMode: "numeric" })}
                {text("shortStay.minNights", "Minimum stay (nights)", { optional: true, inputMode: "numeric" })}
                {text("shortStay.checkIn", "Check-in from", { optional: true, type: "time" })}
                {text("shortStay.checkOut", "Check-out by", { optional: true, type: "time" })}
              </div>
            </Section>
          )}

          {(kind === "EMPTY_LAND" || kind === "LAND_WITH_BUILDING") && (
            <Section title="Land information" description="These details help buyers plan their own checks. They are not a substitute for a search at the Ministry of Lands.">
              <div className="grid gap-4 sm:grid-cols-2">
                {select("land.landUse", "Land use", [["RESIDENTIAL", "Residential"], ["COMMERCIAL", "Commercial"], ["AGRICULTURAL", "Agricultural"], ["MIXED", "Mixed use"], ["INDUSTRIAL", "Industrial"]], { placeholder: "Not specified", optional: true })}
                {select("land.accessRoad", "Access road", [["TARRED", "Tarred road"], ["LATERITE", "Laterite road"], ["FOOTPATH", "Footpath only"], ["NONE", "No access road"]], { placeholder: "Not specified", optional: true })}
                {select("land.titleDocumentType", "Title document held", [["CONVEYANCE", "Conveyance"], ["LEASE", "Lease"], ["STATE_GRANT", "State grant"], ["CUSTOMARY", "Customary tenure"], ["OTHER", "Other"], ["NONE", "None yet"]], { placeholder: "Not specified", optional: true })}
                {text("land.surveyPlanRef", "Survey plan reference", { optional: true })}
                {text("land.parcelRef", "Parcel or plot reference", { optional: true })}
              </div>
              {check("land.fenced", "The land is fenced or walled")}
            </Section>
          )}

          {kind === "COMMERCIAL" && (
            <Section title="Commercial details">
              <div className="grid gap-4 sm:grid-cols-2">
                {text("commercial.permittedUse", "Permitted use", { optional: true, placeholder: "e.g. Retail, office, warehouse" })}
                {text("commercial.floors", "Number of floors", { optional: true, inputMode: "numeric" })}
              </div>
              {check("commercial.loadingAccess", "Loading access for vehicles")}
              {check("commercial.wheelchairAccessible", "Step-free or wheelchair accessible")}
            </Section>
          )}

          {kind === "HOSPITALITY" && (
            <Section title={`About the ${type!.name.toLowerCase()}`}>
              <div className="grid gap-4 sm:grid-cols-3">
                {text("commercial.rooms", "Guest rooms", { inputMode: "numeric" })}
                {text("commercial.floors", "Number of floors", { optional: true, inputMode: "numeric" })}
                {text("commercial.permittedUse", "Also includes", { optional: true, placeholder: "e.g. Restaurant, bar, conference room" })}
              </div>
              {check("commercial.wheelchairAccessible", "Step-free or wheelchair accessible")}
            </Section>
          )}

          {!isSale && terms.length > 0 && (
            <Section title={isStay ? "Booking terms" : v.purpose === "LEASE" ? "Lease terms" : "Rental terms"} description={NOTICES.rentalTermsReview}>
              <div className="grid gap-4 sm:grid-cols-3">{terms.filter((t) => t.key !== "otherConditions").map((t) => <div key={t.key}>{termField(t)}</div>)}</div>
              {other && (
                <Field id="f-otherConditions" label={other.label ?? "Other conditions"} optional error={err("rentalTerms.otherConditions")}>
                  <Textarea id="f-otherConditions" rows={3} value={str("rentalTerms.otherConditions")} onChange={(e) => set("rentalTerms.otherConditions", e.target.value)} maxLength={2000} />
                </Field>
              )}
            </Section>
          )}

          {layout.amenities && amenityGroups.length > 0 && (
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

          <Section title="Your authority to list" description="Listing a property you are not authorised to market is not allowed and may lead to account suspension.">
            {select(
              "listerCapacity",
              "I am listing this property as",
              isAgent
                ? [
                    ["OWNER", "The owner"],
                    ["AGENT_FOR_OWNER", "The agent (acting for the owner)"],
                    ["AGENT_FOR_DEVELOPER", "An agent acting for a developer"],
                    ["DEVELOPER", "The developer"],
                    ["OTHER_AUTHORISED", "Another authorised representative"],
                  ]
                : [
                    ["OWNER", "The owner"],
                    ["AGENT_FOR_OWNER", "The agent"],
                    ["DEVELOPER", "The developer"],
                  ],
            )}
            {!isAgent && v.listerCapacity === "AGENT_FOR_OWNER" && (
              <Notice tone="info">
                Listing as an agent needs agent tools on your account. <Link href="/dashboard/settings" className="link">Turn on agent tools in Settings</Link>, then come back to finish this listing.
              </Notice>
            )}
          </Section>

          <Section title="Your contact details" description="Only the Sukkot Salone team sees these. They are never shown to renters or buyers, who contact our team instead.">
            <div className="grid gap-4 sm:grid-cols-2">
              {text("privateContactPhone", "Phone number", { type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "076 123 456", optional: !wizard })}
              {text("privateContactEmail", "Email", { type: "email", autoComplete: "email", optional: true })}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted"><Lock className="h-3.5 w-3.5" aria-hidden /> Private to Sukkot Salone staff</p>
          </Section>
        </>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-xl sm:border">
        <p className="text-xs text-muted">
          {!wizard ? "Saving does not change the listing's review status." : step === 0 ? "Next: price, details and your contact details." : "Your listing is saved as a draft. Next you choose how to add photos, then review and submit."}
        </p>
        <div className="flex gap-2">
          {wizard && step === 1 && (
            <Button type="button" variant="outline" onClick={() => goTo(0)}>
              Back
            </Button>
          )}
          <Button type="submit" loading={pending}>
            {!wizard ? "Save changes" : step === 0 ? "Next" : "Next: photos and video"}
          </Button>
        </div>
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
