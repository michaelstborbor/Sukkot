import { humanize } from "@/lib/format";
import { Badge } from "./ui";

const SUCCESS = new Set(["CONFIRMED", "ACCEPTED_IN_PRINCIPLE", "APPROVED", "COMPLETED", "PAID", "SUCCEEDED", "RECORDED", "ACTIVE", "PUBLISHED", "OFFER_ACCEPTED"]);
const DANGER = new Set(["REJECTED", "DECLINED", "CANCELLED", "FAILED", "DISPUTED", "EXPIRED", "NO_SHOW", "WITHDRAWN", "OVERDUE"]);
const WARNING = new Set(["PENDING", "REQUESTED", "SUBMITTED", "RESCHEDULE_PROPOSED", "COUNTERED", "BUYER_COUNTERED", "INFO_REQUESTED", "UNDER_REVIEW", "CREATED", "PART_PAID", "PENDING_PAYMENT", "INSPECTION_REQUIRED"]);

export function StatusBadge({ status }: { status: string }) {
  const tone = SUCCESS.has(status) ? "success" : DANGER.has(status) ? "danger" : WARNING.has(status) ? "warning" : "neutral";
  return <Badge label={humanize(status)} tone={tone} />;
}
