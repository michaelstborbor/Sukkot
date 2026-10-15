import "server-only";
import type { Property } from "@prisma/client";
import { minorToMajorString } from "@sukkot/shared";
import type { ListingFormValues } from "@/components/dashboard/listing-form";

/** Map a stored property back into the flat values the listing form edits. */
export function listingFormValues(p: Property & { amenities: { amenityId: string }[] }): ListingFormValues {
  const s = (x: unknown) => (x === null || x === undefined ? "" : String(x));
  const terms = (p.rentalTerms ?? {}) as Record<string, unknown>;
  const attrs = (p.attributes ?? {}) as Record<string, unknown>;
  const values: ListingFormValues = {
    title: p.title,
    description: p.description,
    propertyTypeId: p.propertyTypeId,
    propertyTypeOther: p.propertyTypeOther ?? "",
    purpose: p.purpose,
    price: minorToMajorString(p.priceMinor, p.currency),
    currency: p.currency,
    rentalPeriod: s(p.rentalPeriod) || "YEAR",
    negotiable: p.negotiable,
    bedrooms: s(p.bedrooms),
    bathrooms: s(p.bathrooms),
    floorArea: s(p.floorArea),
    floorAreaUnit: p.floorAreaUnit,
    plotSize: s(p.plotSize),
    plotUnit: s(p.plotUnit),
    furnishing: s(p.furnishing),
    waterSupply: s(p.waterSupply),
    electricity: s(p.electricity),
    parkingSpaces: s(p.parkingSpaces),
    securityFeatures: p.securityFeatures.join(", "),
    locationId: p.locationId,
    addressLine: s(p.addressLine),
    latitude: s(p.latitude),
    longitude: s(p.longitude),
    showExactLocation: p.showExactLocation,
    availableFrom: p.availableFrom ? p.availableFrom.toISOString().slice(0, 10) : "",
    amenityIds: p.amenities.map((a) => a.amenityId),
    videoUrl: s(p.videoUrl),
    virtualTourUrl: s(p.virtualTourUrl),
    listerCapacity: p.listerCapacity,
  };
  for (const [k, val] of Object.entries(terms)) {
    values[`rentalTerms.${k}`] =
      k === "securityDeposit" && val ? minorToMajorString(BigInt(String(val)), p.currency) : typeof val === "boolean" ? val : s(val);
  }
  const prefix = p.category === "LAND" ? "land" : p.category === "COMMERCIAL" ? "commercial" : null;
  if (prefix) for (const [k, val] of Object.entries(attrs)) values[`${prefix}.${k}`] = typeof val === "boolean" ? val : s(val);
  return values;
}
