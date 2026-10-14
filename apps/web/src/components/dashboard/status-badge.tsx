import {
  APPLICATION_STATUS_LABELS,
  AVAILABILITY_LABELS,
  INSPECTION_STATUS_LABELS,
  LISTING_STATUS_LABELS,
  OFFER_STATUS_LABELS,
  VERIFICATION_STATUS_LABELS,
} from "@sukkot/shared";
import { Badge } from "@/components/ui/misc";

type Tone = "neutral" | "verified" | "gold" | "warning" | "danger";

const GOOD = ["PAID", "PUBLISHED", "AVAILABLE", "ACCEPTED", "APPROVED", "CONFIRMED", "COMPLETED", "VERIFIED", "SUCCEEDED", "RECORDED", "ACTIVE", "ACTION_TAKEN"];
const WAITING = ["PENDING_REVIEW", "SUBMITTED", "UNDER_REVIEW", "REQUESTED", "PENDING", "COUNTEROFFER_RECEIVED", "INFO_REQUESTED", "RESCHEDULE_PROPOSED", "PROCESSING", "OPEN", "INVESTIGATING", "DUE_DILIGENCE", "TRANSACTION_IN_PROGRESS", "UNDER_OFFER", "CHANGES_REQUESTED", "AWAITING_CONFIRMATION", "PART_PAID", "PENDING_PAYMENT"];
const BAD = ["OVERDUE", "REJECTED", "SUSPENDED", "REMOVED", "FAILED", "DISPUTED", "CANCELLED", "DECLINED", "NO_SHOW", "EXPIRED", "WITHDRAWN", "REFUNDED", "SUSPENDED"];

export function toneFor(status: string): Tone {
  if (GOOD.includes(status)) return "verified";
  if (WAITING.includes(status)) return "gold";
  if (BAD.includes(status)) return "danger";
  return "neutral";
}

const LABELS: Record<string, Record<string, string>> = {
  listing: LISTING_STATUS_LABELS,
  availability: AVAILABILITY_LABELS,
  offer: OFFER_STATUS_LABELS,
  application: APPLICATION_STATUS_LABELS,
  inspection: INSPECTION_STATUS_LABELS,
  verification: VERIFICATION_STATUS_LABELS,
};

export function humanize(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}

export function StatusBadge({ status, kind }: { status: string; kind?: keyof typeof LABELS }) {
  const label = (kind && LABELS[kind]?.[status]) ?? humanize(status);
  return <Badge tone={toneFor(status)}>{label}</Badge>;
}
