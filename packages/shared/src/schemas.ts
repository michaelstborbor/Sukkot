import { z } from "zod";
import {
  AREA_UNITS,
  CONTACT_METHODS,
  CURRENCIES,
  ELECTRICITY,
  FURNISHING,
  HOSPITALITY_TYPE_SLUGS,
  LAND_WITH_BUILDING_TYPE_SLUGS,
  LISTING_PURPOSES,
  OTHER_PROPERTY_TYPE_SLUG,
  PAYMENT_METHODS,
  PAYMENT_PURPOSES,
  REPORT_TYPES,
  RENTAL_PERIODS,
  WATER_SUPPLY,
  type PropertyCategory,
} from "./enums";
import { parseMajorToMinor } from "./money";
import { normalizeSlPhone } from "./phone";

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const idSchema = z.string().min(1).max(64);

/** A positive amount typed in major units ("85,000" or 85000). Validated, not converted, here. */
export const amountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => {
    const minor = parseMajorToMinor(v);
    return minor !== null && minor > 0n;
  }, "Enter a valid amount greater than zero");

export const phoneSchema = z
  .string()
  .trim()
  .refine((v) => normalizeSlPhone(v) !== null, "Enter a valid Sierra Leone phone number, e.g. 076 123 456")
  .transform((v) => normalizeSlPhone(v)!);

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200)
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Use both letters and numbers");

/* -------------------------------------------------------------- Auth */

export const registerSchema = z.object({
  fullName: trimmed(2, 120),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal("").transform(() => undefined)),
  password: passwordSchema,
  accountType: z.enum(["USER", "OWNER", "AGENT"]).default("USER"),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "You must accept the terms to continue" }) }),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });

export const profileUpdateSchema = z.object({
  fullName: trimmed(2, 120).optional(),
  phone: phoneSchema.optional().or(z.literal("").transform(() => null)),
  whatsapp: phoneSchema.optional().or(z.literal("").transform(() => null)),
  bio: optionalText(1000),
  preferredContact: z.enum(CONTACT_METHODS).optional(),
  showPhone: z.boolean().optional(),
  locale: z.enum(["en", "kri"]).optional(),
});

/* ---------------------------------------------------------- Property */

const intRange = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const optionalInt = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), intRange(min, max).optional());
const optionalNum = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().min(min).max(max).optional(),
  );

export const rentalTermsSchema = z.object({
  advanceRentPeriods: optionalInt(0, 36),
  securityDeposit: amountSchema.optional(),
  minLeaseMonths: optionalInt(0, 240),
  utilitiesPaidBy: z.enum(["TENANT", "LANDLORD", "SHARED", "NEGOTIABLE"]).optional(),
  maintenanceBy: z.enum(["TENANT", "LANDLORD", "SHARED", "NEGOTIABLE"]).optional(),
  petsAllowed: z.enum(["YES", "NO", "ON_REQUEST"]).optional(),
  maxOccupants: optionalInt(1, 100),
  otherConditions: optionalText(2000),
});
export type RentalTerms = z.infer<typeof rentalTermsSchema>;

export const landAttributesSchema = z.object({
  landUse: z.enum(["RESIDENTIAL", "COMMERCIAL", "AGRICULTURAL", "MIXED", "INDUSTRIAL"]).optional(),
  accessRoad: z.enum(["TARRED", "LATERITE", "FOOTPATH", "NONE"]).optional(),
  fenced: z.boolean().optional(),
  surveyPlanRef: optionalText(120),
  parcelRef: optionalText(120),
  titleDocumentType: z.enum(["CONVEYANCE", "LEASE", "STATE_GRANT", "CUSTOMARY", "OTHER", "NONE"]).optional(),
});

export const commercialAttributesSchema = z.object({
  permittedUse: optionalText(200),
  /** Hotels, guesthouses and motels: guest rooms. */
  rooms: optionalInt(1, 2000),
  floors: optionalInt(0, 100),
  loadingAccess: z.boolean().optional(),
  wheelchairAccessible: z.boolean().optional(),
});

export const houseAttributesSchema = z.object({
  houseStyle: z.enum(["BUNGALOW", "STOREY", "DUPLEX", "TERRACED", "SEMI_DETACHED", "OTHER"]).optional(),
  storeys: optionalInt(1, 20),
  boysQuarters: z.boolean().optional(),
  walledCompound: z.boolean().optional(),
});

export const apartmentAttributesSchema = z.object({
  floorLevel: optionalInt(0, 100),
  buildingFloors: optionalInt(1, 100),
  selfContained: z.boolean().optional(),
  lift: z.boolean().optional(),
});

export const shortStayAttributesSchema = z.object({
  maxGuests: optionalInt(1, 50),
  minNights: optionalInt(1, 90),
  checkIn: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 14:00").optional().or(z.literal("").transform(() => undefined)),
  checkOut: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 11:00").optional().or(z.literal("").transform(() => undefined)),
});

export const propertyInputSchema = z
  .object({
    title: trimmed(8, 140),
    description: z.string().trim().min(1, "Describe the property").max(6000),
    propertyTypeId: idSchema,
    /** Required when the type is "Other": what the property actually is. */
    propertyTypeOther: optionalText(60),
    purpose: z.enum(LISTING_PURPOSES),
    price: amountSchema,
    currency: z.enum(CURRENCIES).default("SLE"),
    rentalPeriod: z.enum(RENTAL_PERIODS).optional().nullable(),
    negotiable: z.boolean().default(false),
    bedrooms: optionalInt(0, 50),
    bathrooms: optionalInt(0, 50),
    floorArea: optionalNum(1, 1_000_000),
    floorAreaUnit: z.enum(AREA_UNITS).default("SQM"),
    plotSize: optionalNum(0.01, 1_000_000),
    plotUnit: z.enum(AREA_UNITS).optional(),
    furnishing: z.enum(FURNISHING).optional().nullable(),
    waterSupply: z.enum(WATER_SUPPLY).optional().nullable(),
    electricity: z.enum(ELECTRICITY).optional().nullable(),
    parkingSpaces: optionalInt(0, 500),
    securityFeatures: z.array(trimmed(2, 60)).max(10).default([]),
    locationId: idSchema,
    addressLine: optionalText(200),
    latitude: optionalNum(6.8, 10.1),
    longitude: optionalNum(-13.4, -10.2),
    showExactLocation: z.boolean().default(false),
    availableFrom: z.coerce.date().optional(),
    amenityIds: z.array(idSchema).max(60).default([]),
    videoUrl: z.string().url().max(500).optional().or(z.literal("").transform(() => undefined)),
    virtualTourUrl: z.string().url().max(500).optional().or(z.literal("").transform(() => undefined)),
    listerCapacity: z.enum(["OWNER", "AGENT_FOR_OWNER", "AGENT_FOR_DEVELOPER", "DEVELOPER", "OTHER_AUTHORISED"]),
    rentalTerms: rentalTermsSchema.optional(),
    land: landAttributesSchema.optional(),
    commercial: commercialAttributesSchema.optional(),
    house: houseAttributesSchema.optional(),
    apartment: apartmentAttributesSchema.optional(),
    shortStay: shortStayAttributesSchema.optional(),
    /** Seen only by Sukkot Salone staff, never by people browsing listings. */
    privateContactPhone: phoneSchema.optional().or(z.literal("").transform(() => undefined)),
    privateContactEmail: emailSchema.optional().or(z.literal("").transform(() => undefined)),
  })
  .superRefine((v, ctx) => {
    if (v.purpose !== "SALE" && !v.rentalPeriod) {
      ctx.addIssue({ code: "custom", path: ["rentalPeriod"], message: "Choose how often the rent or lease is paid" });
    }
    if (v.purpose === "SALE" && v.rentalPeriod) {
      ctx.addIssue({ code: "custom", path: ["rentalPeriod"], message: "A sale price has no rental period" });
    }
    if ((v.latitude === undefined) !== (v.longitude === undefined)) {
      ctx.addIssue({ code: "custom", path: ["latitude"], message: "Provide both latitude and longitude, or neither" });
    }
  });
export type PropertyInput = z.input<typeof propertyInputSchema>;
export type PropertyParsed = z.output<typeof propertyInputSchema>;

/** Category-specific requirements, applied on the server once the property type is known. */
export function validatePropertyForCategory(
  input: PropertyParsed,
  category: PropertyCategory,
  typeSlug?: string,
): { path: string; message: string }[] {
  const errors: { path: string; message: string }[] = [];
  const landWithBuilding = typeSlug !== undefined && LAND_WITH_BUILDING_TYPE_SLUGS.includes(typeSlug);
  if (typeSlug === OTHER_PROPERTY_TYPE_SLUG && (!input.propertyTypeOther || input.propertyTypeOther.length < 3)) {
    errors.push({ path: "propertyTypeOther", message: "Say what kind of property this is" });
  }
  if (category === "HOUSE" || category === "APARTMENT" || category === "SHORT_STAY") {
    if (input.bedrooms === undefined) errors.push({ path: "bedrooms", message: "Enter the number of bedrooms" });
    if (input.bathrooms === undefined) errors.push({ path: "bathrooms", message: "Enter the number of bathrooms" });
  }
  if (category === "LAND") {
    if (input.plotSize === undefined) errors.push({ path: "plotSize", message: "Enter the plot size" });
    if (!input.plotUnit) errors.push({ path: "plotUnit", message: "Choose a unit for the plot size" });
    if (!landWithBuilding && input.bedrooms !== undefined && input.bedrooms > 0)
      errors.push({ path: "bedrooms", message: "Land listings should not have bedrooms" });
  }
  const hospitality = typeSlug !== undefined && HOSPITALITY_TYPE_SLUGS.includes(typeSlug);
  if (category === "COMMERCIAL" && !hospitality && input.floorArea === undefined && input.plotSize === undefined) {
    errors.push({ path: "floorArea", message: "Enter the usable floor area" });
  }
  if (hospitality && input.commercial?.rooms === undefined) {
    errors.push({ path: "commercial.rooms", message: "Enter the number of guest rooms" });
  }
  if (category === "SHORT_STAY" && input.shortStay?.maxGuests === undefined) {
    errors.push({ path: "shortStay.maxGuests", message: "Enter how many guests it sleeps" });
  }
  if (category === "SHORT_STAY" && input.purpose !== "SHORT_STAY") {
    errors.push({ path: "purpose", message: "Short-stay properties must be listed as short stay" });
  }
  return errors;
}

/* ----------------------------------------------------- Enquiries, messaging */

export const enquirySchema = z.object({
  propertyId: idSchema,
  message: trimmed(10, 2000),
  intent: z.enum(["GENERAL", "RENT", "BUY", "INSPECTION", "DOCUMENTS"]).default("GENERAL"),
  contactPhone: phoneSchema.optional().or(z.literal("").transform(() => undefined)),
  preferredContact: z.enum(CONTACT_METHODS).default("IN_APP"),
});

export const messageSchema = z.object({ body: trimmed(1, 4000) });

/* --------------------------------------------------------------- Inspections */

export const inspectionRequestSchema = z.object({
  propertyId: idSchema,
  /** ISO instant (UTC). Clients convert from Africa/Freetown local time. */
  scheduledAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(15).max(240).default(30),
  attendees: z.coerce.number().int().min(1).max(10).default(1),
  contactPhone: phoneSchema.optional().or(z.literal("").transform(() => undefined)),
  notes: optionalText(1000),
});

export const inspectionActionSchema = z.object({
  action: z.enum(["confirm", "propose_reschedule", "accept_reschedule", "decline", "cancel", "complete", "mark_no_show"]),
  proposedAt: z.coerce.date().optional(),
  note: optionalText(1000),
});

/* -------------------------------------------------------- Rental applications */

export const rentalApplicationSchema = z.object({
  propertyId: idSchema,
  moveInDate: z.coerce.date(),
  leaseMonths: z.coerce.number().int().min(1).max(240),
  occupants: z.coerce.number().int().min(1).max(50),
  employmentStatus: z.enum(["EMPLOYED", "SELF_EMPLOYED", "STUDENT", "RETIRED", "OTHER"]),
  employerOrBusiness: optionalText(200),
  monthlyIncomeBand: z.enum(["UNDER_5K", "5K_15K", "15K_50K", "OVER_50K", "PREFER_NOT"]).optional(),
  currentAddress: optionalText(300),
  referenceName: optionalText(120),
  referencePhone: phoneSchema.optional().or(z.literal("").transform(() => undefined)),
  message: optionalText(2000),
  submit: z.boolean().default(true),
});

export const applicationActionSchema = z.object({
  action: z.enum([
    "submit",
    "start_review",
    "require_inspection",
    "make_offer",
    "accept_offer",
    "approve",
    "reject",
    "withdraw",
    "complete",
  ]),
  note: optionalText(2000),
  /** Proposed terms when the landlord makes an offer. */
  terms: z
    .object({
      rent: amountSchema,
      currency: z.enum(CURRENCIES).default("SLE"),
      rentalPeriod: z.enum(RENTAL_PERIODS),
      advanceRentPeriods: z.coerce.number().int().min(0).max(36).default(0),
      securityDeposit: amountSchema.optional(),
      startDate: z.coerce.date(),
      leaseMonths: z.coerce.number().int().min(1).max(240),
      conditions: optionalText(3000),
    })
    .optional(),
});

/* ----------------------------------------------------------------- Offers */

export const offerSchema = z.object({
  propertyId: idSchema,
  amount: amountSchema,
  currency: z.enum(CURRENCIES).default("SLE"),
  paymentArrangement: z.enum(["FULL_PAYMENT", "INSTALMENTS", "MORTGAGE_OR_LOAN", "OTHER"]),
  conditions: z.array(trimmed(3, 300)).max(15).default([]),
  inspectionDone: z.boolean().default(false),
  dueDiligenceRequested: z.boolean().default(false),
  expiresAt: z.coerce.date().optional(),
  message: optionalText(2000),
});

export const offerActionSchema = z.object({
  action: z.enum([
    "mark_under_review",
    "counter",
    "buyer_counter",
    "request_info",
    "revise_conditions",
    "accept",
    "accept_counter",
    "reject",
    "withdraw",
    "start_due_diligence",
    "start_transaction",
    "complete",
  ]),
  amount: amountSchema.optional(),
  conditions: z.array(trimmed(3, 300)).max(15).optional(),
  expiresAt: z.coerce.date().optional(),
  message: optionalText(2000),
});

export const dueDiligenceUpdateSchema = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "DONE", "ISSUE_FOUND", "NOT_APPLICABLE"]),
  notes: optionalText(2000),
});

/* -------------------------------------------------------------- Reports */

export const reportSchema = z
  .object({
    type: z.enum(REPORT_TYPES),
    propertyId: idSchema.optional(),
    reportedUserId: idSchema.optional(),
    messageId: idSchema.optional(),
    reason: trimmed(10, 3000),
    contactEmail: emailSchema.optional(),
  })
  .refine((v) => v.type === "SUPPORT" || v.propertyId || v.reportedUserId || v.messageId, {
    message: "Say which listing, user or message this report is about",
    path: ["type"],
  });

/* ------------------------------------------------------------- Payments */

/** What a customer can buy from Sukkot Salone at checkout. Everything else is paid between users. */
export const PLATFORM_CHECKOUT_PURPOSES = ["PLATFORM_SUBSCRIPTION", "LISTING_PROMOTION", "INSPECTION_VISIT", "PHOTO_SHOOT", "LISTING_SLOT"] as const;
export type PlatformCheckoutPurpose = (typeof PLATFORM_CHECKOUT_PURPOSES)[number];

export const paymentInitiateSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  purpose: z.enum(PAYMENT_PURPOSES),
  /** Ignored for platform purchases: the server prices plans and promotions itself. */
  amount: amountSchema.optional(),
  currency: z.enum(CURRENCIES).default("SLE"),
  /** Mobile money wallet number of the payer. */
  payerPhone: phoneSchema.optional(),
  tenancyId: idSchema.optional(),
  offerId: idSchema.optional(),
  subscriptionPlanId: idSchema.optional(),
  propertyId: idSchema.optional(),
  /** Client-generated key so a retried request never creates a second charge. */
  idempotencyKey: z.string().min(8).max(100),
});

/** Channels a customer can use to pay Sukkot Salone by transfer, before online collection is live. */
export const MANUAL_PLATFORM_CHANNELS = ["ORANGE_MONEY", "AFRIMONEY", "BANK_TRANSFER"] as const;
export type ManualPlatformChannel = (typeof MANUAL_PLATFORM_CHANNELS)[number];

/**
 * A plan or promotion paid by transfer to Sukkot Salone's own wallet or bank account. The amount is
 * priced on the server; the customer only says how they paid and gives the transaction ID, which
 * finance staff check against the statement before anything is activated.
 */
export const manualPlatformPaymentSchema = z.object({
  purpose: z.enum(PLATFORM_CHECKOUT_PURPOSES),
  subscriptionPlanId: idSchema.optional(),
  propertyId: idSchema.optional(),
  channel: z.enum(MANUAL_PLATFORM_CHANNELS),
  externalReference: trimmed(4, 60),
  payerPhone: phoneSchema.optional(),
  idempotencyKey: z.string().min(8).max(100),
});

export const manualPaymentReviewSchema = z
  .object({ approve: z.boolean(), reason: optionalText(500) })
  .refine((v) => v.approve || (v.reason && v.reason.length >= 5), { message: "Say why the payment is rejected", path: ["reason"] });

export const paymentRecordSchema = z.object({
  method: z.enum(["BANK_TRANSFER", "CASH", "MANUAL", "ORANGE_MONEY", "AFRIMONEY"]),
  purpose: z.enum(PAYMENT_PURPOSES),
  amount: amountSchema,
  currency: z.enum(CURRENCIES).default("SLE"),
  paidAt: z.coerce.date(),
  tenancyId: idSchema.optional(),
  offerId: idSchema.optional(),
  externalReference: optionalText(120),
  notes: optionalText(1000),
  idempotencyKey: z.string().min(8).max(100),
});

/* ---------------------------------------------------------- Moderation */

export const moderationSchema = z.object({
  action: z.enum(["approve", "request_changes", "reject", "suspend", "reinstate", "remove"]),
  reason: optionalText(2000),
  markDocumentsReviewed: z.boolean().optional(),
  featured: z.boolean().optional(),
});

export const verificationSubmitSchema = z.object({
  kind: z.enum(["IDENTITY", "AGENT_CREDENTIALS", "LISTING_AUTHORITY", "PROPERTY_DOCUMENTS"]),
  propertyId: idSchema.optional(),
  agencyId: idSchema.optional(),
  notes: optionalText(2000),
});

export const verificationDecisionSchema = z.object({
  decision: z.enum(["VERIFIED", "REJECTED", "INFO_REQUIRED"]),
  reason: trimmed(5, 2000),
  expiresAt: z.coerce.date().optional(),
});
