import type {
  ApplicationStatus,
  Availability,
  Currency,
  InspectionStatus,
  ListingPurpose,
  ListingStatus,
  OfferEventType,
  OfferStatus,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  PropertyCategory,
  RentalPeriod,
  Role,
  VerificationKind,
} from "./enums";

/** JSON shapes returned by /api/v1. Money is serialised as a string of minor units. */

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface MoneyDTO {
  amountMinor: string;
  currency: Currency;
  formatted: string;
}

export interface LocationDTO {
  id: string;
  name: string;
  slug: string;
  level: string;
  path: string;
}

export interface ImageDTO {
  id: string;
  url: string;
  thumbUrl: string;
  width: number | null;
  height: number | null;
  alt: string;
  illustrative: boolean;
  /** Tiny blurred preview (data: URL) to show while the photo loads, when one was made. */
  placeholder?: string | null;
  /** The Sukkot Salone mark is drawn into the stored photo itself. */
  watermarked?: boolean;
}

export interface ListerDTO {
  id: string;
  name: string;
  avatarUrl: string | null;
  kind: "OWNER" | "AGENT";
  agencyName: string | null;
  agencyId: string | null;
  badges: VerificationKind[];
  memberSince: string;
  /** Present only when the lister has chosen to show it. */
  phone: string | null;
  whatsapp: string | null;
  isDemo: boolean;
}

export interface PropertySummaryDTO {
  id: string;
  reference: string;
  slug: string;
  title: string;
  category: PropertyCategory;
  typeName: string;
  purpose: ListingPurpose;
  price: MoneyDTO;
  rentalPeriod: RentalPeriod | null;
  negotiable: boolean;
  bedrooms: number | null;
  bathrooms: number | null;
  floorArea: string | null;
  plotSize: string | null;
  locationLabel: string;
  district: string | null;
  coverImage: ImageDTO | null;
  availability: Availability;
  documentsReviewed: boolean;
  listerVerified: boolean;
  /** Date of the Sukkot Salone staff visit, only while the "Inspected by Sukkot" badge is still valid. */
  inspectedAt: string | null;
  featured: boolean;
  isDemo: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export interface PropertyDetailDTO extends PropertySummaryDTO {
  description: string;
  images: ImageDTO[];
  amenities: { id: string; name: string; slug: string; group: string }[];
  furnishing: string | null;
  waterSupply: string | null;
  electricity: string | null;
  parkingSpaces: number | null;
  securityFeatures: string[];
  addressLine: string | null;
  coordinates: { lat: number; lng: number; approximate: boolean } | null;
  availableFrom: string | null;
  /** Link to a video hosted elsewhere (YouTube, Vimeo). */
  videoUrl: string | null;
  /** Short video uploaded by the lister, once it has been converted. */
  video: { url: string; posterUrl: string; durationSec: number | null; width: number | null; height: number | null } | null;
  virtualTourUrl: string | null;
  attributes: Record<string, unknown>;
  rentalTerms: Record<string, unknown> | null;
  listerCapacity: string;
  lister: ListerDTO;
  viewCount: number;
  saved: boolean;
  listingStatus: ListingStatus;
}

export interface MeDTO {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  roles: Role[];
  avatarUrl: string | null;
  badges: VerificationKind[];
  unreadMessages: number;
  unreadNotifications: number;
}

export interface ConversationSummaryDTO {
  id: string;
  subject: string;
  property: { id: string; title: string; slug: string; coverUrl: string | null } | null;
  otherParticipants: { id: string; name: string }[];
  lastMessage: { body: string; at: string; fromMe: boolean } | null;
  unread: number;
  updatedAt: string;
}

export interface MessageDTO {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  fromMe: boolean;
  readByOthers: boolean;
}

export interface InspectionDTO {
  id: string;
  status: InspectionStatus;
  scheduledAt: string;
  proposedAt: string | null;
  proposedById: string | null;
  durationMinutes: number;
  notes: string | null;
  property: { id: string; title: string; slug: string };
  requester: { id: string; name: string };
  /** Booking fee the requester pays Sukkot Salone; the landlord or agent only sees paid requests. */
  fee: { amountMinor: string; currency: Currency; paid: boolean } | null;
  myRole: "REQUESTER" | "REPRESENTATIVE";
  actions: string[];
}

export interface OfferEventDTO {
  id: string;
  type: OfferEventType;
  actorName: string;
  actorSide: "BUYER" | "SELLER" | "SYSTEM";
  amount: MoneyDTO | null;
  conditions: string[];
  message: string | null;
  statusAfter: OfferStatus;
  createdAt: string;
}

export interface OfferDTO {
  id: string;
  status: OfferStatus;
  property: { id: string; title: string; slug: string };
  buyer: { id: string; name: string };
  currentAmount: MoneyDTO;
  askingPrice: MoneyDTO;
  paymentArrangement: string;
  expiresAt: string | null;
  myRole: "BUYER" | "SELLER";
  actions: string[];
  events: OfferEventDTO[];
  createdAt: string;
}

export interface ApplicationDTO {
  id: string;
  status: ApplicationStatus;
  property: { id: string; title: string; slug: string };
  applicant: { id: string; name: string };
  moveInDate: string;
  leaseMonths: number;
  occupants: number;
  myRole: "APPLICANT" | "LANDLORD";
  actions: string[];
  createdAt: string;
}

export interface PaymentDTO {
  id: string;
  reference: string;
  method: PaymentMethod;
  purpose: PaymentPurpose;
  status: PaymentStatus;
  amount: MoneyDTO;
  providerVerified: boolean;
  createdAt: string;
  /** Where a mobile money payer should go next, if the provider uses a redirect. */
  nextAction: { type: "REDIRECT"; url: string } | { type: "USSD_PROMPT"; message: string } | null;
}

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AuthResponseDTO {
  user: MeDTO;
  /** Only returned to clients that ask for a bearer token (the mobile app). */
  token?: string;
  expiresAt: string;
}
