import type {
  ApplicationStatus,
  InspectionStatus,
  ListingStatus,
  OfferEventType,
  OfferStatus,
} from "./enums";

/**
 * Small, explicit state machines. Each action declares which statuses it may start from,
 * which side of the transaction may perform it, and the resulting status. The server
 * enforces these; the clients use them to decide which buttons to show.
 */
export interface Transition<S extends string, Side extends string> {
  from: readonly S[];
  by: readonly Side[];
  to: S | "SAME";
}

export class TransitionError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_ACTION" | "NOT_ALLOWED" | "INVALID_STATE",
  ) {
    super(message);
    this.name = "TransitionError";
  }
}

function makeMachine<S extends string, A extends string, Side extends string>(
  name: string,
  table: Record<A, Transition<S, Side>>,
) {
  return {
    table,
    /** Returns the next status or throws a TransitionError. */
    next(current: S, action: A, side: Side): S {
      const t = table[action];
      if (!t) throw new TransitionError(`Unknown ${name} action "${action}"`, "INVALID_ACTION");
      if (!t.by.includes(side)) {
        throw new TransitionError(`${side} cannot ${action} a ${name}`, "NOT_ALLOWED");
      }
      if (!t.from.includes(current)) {
        throw new TransitionError(`Cannot ${action} a ${name} that is ${current}`, "INVALID_STATE");
      }
      return t.to === "SAME" ? current : t.to;
    },
    can(current: S, action: A, side: Side): boolean {
      const t = table[action];
      return !!t && t.by.includes(side) && t.from.includes(current);
    },
    /** Actions available to `side` from `current`. */
    available(current: S, side: Side): A[] {
      return (Object.keys(table) as A[]).filter((a) => this.can(current, a, side));
    },
  };
}

/* ------------------------------------------------------------------ Offers */

export type OfferSide = "BUYER" | "SELLER" | "SYSTEM";
export type OfferAction =
  | "mark_under_review"
  | "counter"
  | "buyer_counter"
  | "request_info"
  | "revise_conditions"
  | "accept"
  | "accept_counter"
  | "reject"
  | "withdraw"
  | "expire"
  | "start_due_diligence"
  | "start_transaction"
  | "complete";

const OPEN_FOR_SELLER: OfferStatus[] = ["SUBMITTED", "UNDER_REVIEW"];
const LIVE_OFFER: OfferStatus[] = ["SUBMITTED", "UNDER_REVIEW", "COUNTEROFFER_RECEIVED"];
const AGREED: OfferStatus[] = ["ACCEPTED_IN_PRINCIPLE", "PENDING_DUE_DILIGENCE", "TRANSACTION_IN_PROGRESS"];

export const offerMachine = makeMachine<OfferStatus, OfferAction, OfferSide>("offer", {
  mark_under_review: { from: ["SUBMITTED"], by: ["SELLER"], to: "UNDER_REVIEW" },
  counter: { from: [...OPEN_FOR_SELLER, "COUNTEROFFER_RECEIVED"], by: ["SELLER"], to: "COUNTEROFFER_RECEIVED" },
  buyer_counter: { from: ["COUNTEROFFER_RECEIVED"], by: ["BUYER"], to: "SUBMITTED" },
  request_info: { from: OPEN_FOR_SELLER, by: ["SELLER"], to: "UNDER_REVIEW" },
  revise_conditions: { from: LIVE_OFFER, by: ["BUYER", "SELLER"], to: "SAME" },
  accept: { from: OPEN_FOR_SELLER, by: ["SELLER"], to: "ACCEPTED_IN_PRINCIPLE" },
  accept_counter: { from: ["COUNTEROFFER_RECEIVED"], by: ["BUYER"], to: "ACCEPTED_IN_PRINCIPLE" },
  reject: { from: [...LIVE_OFFER, ...AGREED], by: ["SELLER", "BUYER"], to: "REJECTED" },
  withdraw: { from: [...LIVE_OFFER, ...AGREED], by: ["BUYER"], to: "WITHDRAWN" },
  expire: { from: LIVE_OFFER, by: ["SYSTEM"], to: "EXPIRED" },
  start_due_diligence: { from: ["ACCEPTED_IN_PRINCIPLE"], by: ["BUYER", "SELLER"], to: "PENDING_DUE_DILIGENCE" },
  start_transaction: {
    from: ["ACCEPTED_IN_PRINCIPLE", "PENDING_DUE_DILIGENCE"],
    by: ["BUYER", "SELLER"],
    to: "TRANSACTION_IN_PROGRESS",
  },
  complete: { from: ["TRANSACTION_IN_PROGRESS"], by: ["SELLER"], to: "COMPLETED" },
});

export const OFFER_ACTION_EVENT: Record<OfferAction, OfferEventType> = {
  mark_under_review: "VIEWED",
  counter: "COUNTERED",
  buyer_counter: "BUYER_COUNTERED",
  request_info: "INFO_REQUESTED",
  revise_conditions: "CONDITIONS_REVISED",
  accept: "ACCEPTED_IN_PRINCIPLE",
  accept_counter: "ACCEPTED_IN_PRINCIPLE",
  reject: "REJECTED",
  withdraw: "WITHDRAWN",
  expire: "EXPIRED",
  start_due_diligence: "DUE_DILIGENCE_STARTED",
  start_transaction: "TRANSACTION_STARTED",
  complete: "COMPLETED",
};

export const OFFER_FINAL_STATUSES: readonly OfferStatus[] = ["REJECTED", "WITHDRAWN", "EXPIRED", "COMPLETED"];

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  COUNTEROFFER_RECEIVED: "Counteroffer received",
  ACCEPTED_IN_PRINCIPLE: "Accepted in principle",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  EXPIRED: "Expired",
  PENDING_DUE_DILIGENCE: "Pending due diligence",
  TRANSACTION_IN_PROGRESS: "Transaction in progress",
  COMPLETED: "Completed",
};

/* ------------------------------------------------------ Rental applications */

export type ApplicationSide = "APPLICANT" | "LANDLORD";
export type ApplicationAction =
  | "submit"
  | "start_review"
  | "require_inspection"
  | "make_offer"
  | "accept_offer"
  | "approve"
  | "reject"
  | "withdraw"
  | "complete";

const APP_OPEN: ApplicationStatus[] = ["SUBMITTED", "UNDER_REVIEW", "INSPECTION_REQUIRED", "OFFER_MADE"];

export const applicationMachine = makeMachine<ApplicationStatus, ApplicationAction, ApplicationSide>("application", {
  submit: { from: ["DRAFT"], by: ["APPLICANT"], to: "SUBMITTED" },
  start_review: { from: ["SUBMITTED"], by: ["LANDLORD"], to: "UNDER_REVIEW" },
  require_inspection: { from: ["SUBMITTED", "UNDER_REVIEW"], by: ["LANDLORD"], to: "INSPECTION_REQUIRED" },
  make_offer: { from: ["SUBMITTED", "UNDER_REVIEW", "INSPECTION_REQUIRED"], by: ["LANDLORD"], to: "OFFER_MADE" },
  accept_offer: { from: ["OFFER_MADE"], by: ["APPLICANT"], to: "APPROVED" },
  approve: { from: APP_OPEN, by: ["LANDLORD"], to: "APPROVED" },
  reject: { from: [...APP_OPEN, "APPROVED"], by: ["LANDLORD"], to: "REJECTED" },
  withdraw: { from: ["DRAFT", ...APP_OPEN, "APPROVED"], by: ["APPLICANT"], to: "WITHDRAWN" },
  complete: { from: ["APPROVED"], by: ["LANDLORD"], to: "COMPLETED" },
});

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  INSPECTION_REQUIRED: "Inspection required",
  OFFER_MADE: "Terms offered",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  COMPLETED: "Completed",
};

/* -------------------------------------------------------------- Inspections */

export type InspectionSide = "REQUESTER" | "REPRESENTATIVE";
export type InspectionAction =
  | "confirm"
  | "propose_reschedule"
  | "accept_reschedule"
  | "decline"
  | "cancel"
  | "complete"
  | "mark_no_show";

export const inspectionMachine = makeMachine<InspectionStatus, InspectionAction, InspectionSide>("inspection", {
  confirm: { from: ["REQUESTED"], by: ["REPRESENTATIVE"], to: "CONFIRMED" },
  propose_reschedule: {
    from: ["REQUESTED", "CONFIRMED", "RESCHEDULE_PROPOSED"],
    by: ["REPRESENTATIVE", "REQUESTER"],
    to: "RESCHEDULE_PROPOSED",
  },
  accept_reschedule: { from: ["RESCHEDULE_PROPOSED"], by: ["REPRESENTATIVE", "REQUESTER"], to: "CONFIRMED" },
  decline: { from: ["REQUESTED", "RESCHEDULE_PROPOSED"], by: ["REPRESENTATIVE"], to: "DECLINED" },
  cancel: { from: ["REQUESTED", "CONFIRMED", "RESCHEDULE_PROPOSED"], by: ["REQUESTER", "REPRESENTATIVE"], to: "CANCELLED" },
  complete: { from: ["CONFIRMED"], by: ["REPRESENTATIVE"], to: "COMPLETED" },
  mark_no_show: { from: ["CONFIRMED"], by: ["REPRESENTATIVE"], to: "NO_SHOW" },
});

export const INSPECTION_STATUS_LABELS: Record<InspectionStatus, string> = {
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  RESCHEDULE_PROPOSED: "New time proposed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  NO_SHOW: "No show",
};

/* ----------------------------------------------------------------- Listings */

export type ListingSide = "OWNER" | "MODERATOR";
export type ListingAction =
  | "submit"
  | "pause"
  | "resume"
  | "remove"
  | "approve"
  | "request_changes"
  | "reject"
  | "suspend"
  | "reinstate";

export const listingMachine = makeMachine<ListingStatus, ListingAction, ListingSide>("listing", {
  submit: { from: ["DRAFT", "CHANGES_REQUESTED", "REJECTED", "EXPIRED"], by: ["OWNER"], to: "PENDING_REVIEW" },
  pause: { from: ["PUBLISHED"], by: ["OWNER"], to: "PAUSED" },
  resume: { from: ["PAUSED"], by: ["OWNER"], to: "PUBLISHED" },
  remove: {
    from: ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "PUBLISHED", "PAUSED", "REJECTED", "EXPIRED", "SUSPENDED"],
    by: ["OWNER", "MODERATOR"],
    to: "REMOVED",
  },
  approve: { from: ["PENDING_REVIEW"], by: ["MODERATOR"], to: "PUBLISHED" },
  request_changes: { from: ["PENDING_REVIEW"], by: ["MODERATOR"], to: "CHANGES_REQUESTED" },
  reject: { from: ["PENDING_REVIEW"], by: ["MODERATOR"], to: "REJECTED" },
  suspend: { from: ["PUBLISHED", "PAUSED", "PENDING_REVIEW"], by: ["MODERATOR"], to: "SUSPENDED" },
  reinstate: { from: ["SUSPENDED"], by: ["MODERATOR"], to: "PUBLISHED" },
});

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  CHANGES_REQUESTED: "Changes requested",
  PUBLISHED: "Published",
  PAUSED: "Paused",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
  REMOVED: "Removed",
  EXPIRED: "Expired",
};

/** Moderator actions that must carry a written reason. */
export const LISTING_ACTIONS_REQUIRING_REASON: readonly ListingAction[] = [
  "request_changes",
  "reject",
  "suspend",
  "reinstate",
];
