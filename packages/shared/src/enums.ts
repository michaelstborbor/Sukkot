/**
 * Enumerations shared by the database layer, the API and both clients.
 * The string values match the Prisma enums in apps/web/prisma/schema.prisma.
 */

export const CURRENCIES = ["SLE", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "SLE";

export const LISTING_PURPOSES = ["SALE", "RENT", "LEASE", "SHORT_STAY"] as const;
export type ListingPurpose = (typeof LISTING_PURPOSES)[number];
export const LISTING_PURPOSE_LABELS: Record<ListingPurpose, string> = {
  SALE: "For sale",
  RENT: "For rent",
  LEASE: "For lease",
  SHORT_STAY: "Short stay",
};

/** Property category keys. Categories themselves live in the `property_types` table. */
export const PROPERTY_CATEGORIES = [
  "HOUSE",
  "APARTMENT",
  "LAND",
  "COMMERCIAL",
  "SHORT_STAY",
  "OTHER",
] as const;
export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number];
/** The "Other (specify)" property type: the lister must say what the property is. */
export const OTHER_PROPERTY_TYPE_SLUG = "other";
/** Land types that may also describe a building on the land (bedrooms, bathrooms, floor area). */
export const LAND_WITH_BUILDING_TYPE_SLUGS: readonly string[] = ["land-with-property"];
export const PROPERTY_CATEGORY_LABELS: Record<PropertyCategory, string> = {
  HOUSE: "Houses",
  APARTMENT: "Apartments",
  LAND: "Land",
  COMMERCIAL: "Commercial",
  SHORT_STAY: "Short stays",
  OTHER: "Other",
};

export const RENTAL_PERIODS = ["DAY", "WEEK", "MONTH", "QUARTER", "HALF_YEAR", "YEAR"] as const;
export type RentalPeriod = (typeof RENTAL_PERIODS)[number];
export const RENTAL_PERIOD_LABELS: Record<RentalPeriod, string> = {
  DAY: "night",
  WEEK: "week",
  MONTH: "month",
  QUARTER: "quarter",
  HALF_YEAR: "6 months",
  YEAR: "year",
};

export const AREA_UNITS = ["SQM", "SQFT", "ACRE", "HECTARE", "TOWN_LOT"] as const;
export type AreaUnit = (typeof AREA_UNITS)[number];
export const AREA_UNIT_LABELS: Record<AreaUnit, string> = {
  SQM: "m²",
  SQFT: "ft²",
  ACRE: "acres",
  HECTARE: "ha",
  TOWN_LOT: "town lot",
};

export const FURNISHING = ["UNFURNISHED", "SEMI_FURNISHED", "FURNISHED"] as const;
export type Furnishing = (typeof FURNISHING)[number];
export const FURNISHING_LABELS: Record<Furnishing, string> = {
  UNFURNISHED: "Unfurnished",
  SEMI_FURNISHED: "Semi-furnished",
  FURNISHED: "Furnished",
};

export const WATER_SUPPLY = ["NONE", "GUMA_MAINS", "BOREHOLE", "WELL", "TANKER", "MIXED"] as const;
export type WaterSupply = (typeof WATER_SUPPLY)[number];
export const WATER_SUPPLY_LABELS: Record<WaterSupply, string> = {
  NONE: "No water supply",
  GUMA_MAINS: "Guma / mains water",
  BOREHOLE: "Borehole",
  WELL: "Well",
  TANKER: "Water tanker",
  MIXED: "Mixed sources",
};

export const ELECTRICITY = ["NONE", "EDSA_GRID", "GRID_WITH_BACKUP", "SOLAR", "GENERATOR"] as const;
export type Electricity = (typeof ELECTRICITY)[number];
export const ELECTRICITY_LABELS: Record<Electricity, string> = {
  NONE: "No electricity",
  EDSA_GRID: "EDSA grid",
  GRID_WITH_BACKUP: "Grid with backup",
  SOLAR: "Solar",
  GENERATOR: "Generator",
};

export const LISTING_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "CHANGES_REQUESTED",
  "PUBLISHED",
  "PAUSED",
  "REJECTED",
  "SUSPENDED",
  "REMOVED",
  "EXPIRED",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const AVAILABILITY = ["AVAILABLE", "UNDER_OFFER", "RENTED", "SOLD", "UNAVAILABLE"] as const;
export type Availability = (typeof AVAILABILITY)[number];
export const AVAILABILITY_LABELS: Record<Availability, string> = {
  AVAILABLE: "Available",
  UNDER_OFFER: "Under offer",
  RENTED: "Rented",
  SOLD: "Sold",
  UNAVAILABLE: "Unavailable",
};

export const VERIFICATION_STATUSES = [
  "NOT_SUBMITTED",
  "PENDING_REVIEW",
  "INFO_REQUIRED",
  "VERIFIED",
  "REJECTED",
  "EXPIRED",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  NOT_SUBMITTED: "Not submitted",
  PENDING_REVIEW: "Pending review",
  INFO_REQUIRED: "Additional information required",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

/** The five independent verification tracks required by the trust framework. */
export const VERIFICATION_KINDS = [
  "IDENTITY",
  "AGENT_CREDENTIALS",
  "LISTING_AUTHORITY",
  "PROPERTY_DOCUMENTS",
] as const;
export type VerificationKind = (typeof VERIFICATION_KINDS)[number];
export const VERIFICATION_BADGES: Record<VerificationKind, { label: string; means: string; doesNotMean: string }> = {
  IDENTITY: {
    label: "Identity Verified",
    means: "Our verification team checked a government-issued ID against this person's account.",
    doesNotMean: "It does not confirm that the person owns any property.",
  },
  AGENT_CREDENTIALS: {
    label: "Agent Verified",
    means: "Our team reviewed this agent's or agency's business registration and contact details.",
    doesNotMean: "It does not guarantee the agent's conduct or that every listing is accurate.",
  },
  LISTING_AUTHORITY: {
    label: "Authorised to List",
    means: "The lister provided evidence that the owner authorised them to advertise this property.",
    doesNotMean: "It is not a confirmation of legal title.",
  },
  PROPERTY_DOCUMENTS: {
    label: "Documents Reviewed",
    means: "Our team reviewed the ownership documents supplied (for example a conveyance or survey plan) for consistency.",
    doesNotMean:
      "It is not a legal title search and does not replace checks at the Ministry of Lands or advice from a lawyer.",
  },
};

/**
 * The badge a listing earns when Sukkot Salone staff visit it in person (a paid inspection visit).
 * It always shows the visit date and drops off once the visit is older than INSPECTION_BADGE_DAYS.
 */
export const INSPECTED_BADGE = {
  label: "Inspected by Sukkot",
  means: "Sukkot Salone staff visited this property in person, checked it matches the listing and took the photos.",
  doesNotMean: "It is not a legal title search and the property may have changed since the visit date.",
};
export const INSPECTION_BADGE_DAYS = 365;

/** Whether a visit date still earns the badge. */
export function inspectionStillValid(inspectedAt: Date | string | null | undefined, now = new Date()) {
  if (!inspectedAt) return false;
  return now.getTime() - new Date(inspectedAt).getTime() < INSPECTION_BADGE_DAYS * 86400_000;
}

export const SITE_VISIT_STATUSES = ["REQUESTED", "SCHEDULED", "COMPLETED", "CANCELLED"] as const;
export type SiteVisitStatus = (typeof SITE_VISIT_STATUSES)[number];
export const SITE_VISIT_STATUS_LABELS: Record<SiteVisitStatus, string> = {
  REQUESTED: "Paid, waiting for a date",
  SCHEDULED: "Visit booked",
  COMPLETED: "Inspected",
  CANCELLED: "Cancelled",
};

export const ROLES = [
  "USER",
  "OWNER",
  "AGENT",
  "SUPER_ADMIN",
  "MODERATOR",
  "VERIFICATION_OFFICER",
  "SUPPORT",
  "FINANCE",
] as const;
export type Role = (typeof ROLES)[number];
export const ADMIN_ROLES: readonly Role[] = ["SUPER_ADMIN", "MODERATOR", "VERIFICATION_OFFICER", "SUPPORT", "FINANCE"];

export const APPLICATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "INSPECTION_REQUIRED",
  "OFFER_MADE",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
  "COMPLETED",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const OFFER_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "COUNTEROFFER_RECEIVED",
  "ACCEPTED_IN_PRINCIPLE",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
  "PENDING_DUE_DILIGENCE",
  "TRANSACTION_IN_PROGRESS",
  "COMPLETED",
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OFFER_EVENT_TYPES = [
  "SUBMITTED",
  "VIEWED",
  "COUNTERED",
  "BUYER_COUNTERED",
  "INFO_REQUESTED",
  "CONDITIONS_REVISED",
  "ACCEPTED_IN_PRINCIPLE",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
  "DUE_DILIGENCE_STARTED",
  "TRANSACTION_STARTED",
  "COMPLETED",
  "NOTE",
] as const;
export type OfferEventType = (typeof OFFER_EVENT_TYPES)[number];

export const INSPECTION_STATUSES = [
  "REQUESTED",
  "CONFIRMED",
  "RESCHEDULE_PROPOSED",
  "DECLINED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const PAYMENT_METHODS = ["ORANGE_MONEY", "AFRIMONEY", "BANK_TRANSFER", "CARD", "CASH", "MANUAL", "SANDBOX"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  ORANGE_MONEY: "Orange Money",
  AFRIMONEY: "Afrimoney",
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
  CASH: "Cash",
  MANUAL: "Manual record",
  SANDBOX: "Sandbox (test only)",
};
/** Methods whose result is confirmed by a provider rather than recorded by a person. */
export const PROVIDER_VERIFIED_METHODS: readonly PaymentMethod[] = ["ORANGE_MONEY", "AFRIMONEY", "CARD", "SANDBOX"];

export const PAYMENT_STATUSES = [
  "CREATED",
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
  "RECORDED",
  "DISPUTED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_PURPOSES = [
  "RENT",
  "SECURITY_DEPOSIT",
  "ADVANCE_RENT",
  "SALE_DEPOSIT",
  "SALE_PROCEEDS",
  "AGENCY_COMMISSION",
  "PLATFORM_SUBSCRIPTION",
  "LISTING_PROMOTION",
  "PLATFORM_FEE",
  "INSPECTION_VISIT",
  "LISTING_SLOT",
  "REFUND",
  "OTHER",
] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];
export const PAYMENT_PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  RENT: "Rent",
  SECURITY_DEPOSIT: "Security deposit",
  ADVANCE_RENT: "Advance rent",
  SALE_DEPOSIT: "Sale deposit",
  SALE_PROCEEDS: "Sale proceeds",
  AGENCY_COMMISSION: "Agency commission",
  PLATFORM_SUBSCRIPTION: "Platform subscription",
  LISTING_PROMOTION: "Listing promotion",
  PLATFORM_FEE: "Platform fee",
  INSPECTION_VISIT: "Inspection visit",
  LISTING_SLOT: "Extra listing slot",
  REFUND: "Refund",
  OTHER: "Other",
};
/** Purposes the platform itself collects (as opposed to money that flows between users). */
export const PLATFORM_COLLECTED_PURPOSES: readonly PaymentPurpose[] = [
  "PLATFORM_SUBSCRIPTION",
  "LISTING_PROMOTION",
  "PLATFORM_FEE",
  "INSPECTION_VISIT",
  "LISTING_SLOT",
];

export const REPORT_TYPES = [
  "LISTING",
  "USER",
  "SUSPECTED_FRAUD",
  "DUPLICATE_LISTING",
  "OWNERSHIP_DISPUTE",
  "SAFETY_CONCERN",
  "MESSAGE",
  "SUPPORT",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  LISTING: "Problem with this listing",
  USER: "Report a user",
  SUSPECTED_FRAUD: "Suspected fraud or scam",
  DUPLICATE_LISTING: "Duplicate listing",
  OWNERSHIP_DISPUTE: "Ownership dispute",
  SAFETY_CONCERN: "Safety concern",
  MESSAGE: "Abusive message",
  SUPPORT: "Support request",
};

export const REPORT_STATUSES = ["OPEN", "INVESTIGATING", "ACTION_TAKEN", "DISMISSED", "CLOSED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const SORT_OPTIONS = ["relevant", "newest", "price_asc", "price_desc", "updated", "views"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];
export const SORT_LABELS: Record<SortOption, string> = {
  relevant: "Most relevant",
  newest: "Newest first",
  price_asc: "Lowest price",
  price_desc: "Highest price",
  updated: "Recently updated",
  views: "Most viewed",
};

export const CONTACT_METHODS = ["IN_APP", "PHONE", "WHATSAPP", "EMAIL"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export const TIMEZONE = "Africa/Freetown";
