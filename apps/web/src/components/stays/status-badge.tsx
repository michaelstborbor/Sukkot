import { STAY_BOOKING_STATUS_LABELS, type StayBookingStatus } from "@sukkot/shared";
import { Badge } from "@/components/ui/misc";

const TONE: Record<StayBookingStatus, "gold" | "verified" | "danger" | "neutral" | "warning"> = {
  REQUESTED: "gold",
  CONFIRMED: "warning",
  PAID: "verified",
  COMPLETED: "neutral",
  NO_SHOW: "danger",
  UNAVAILABLE: "danger",
  CANCELLED: "danger",
  EXPIRED: "neutral",
};

export function StayStatusBadge({ status }: { status: StayBookingStatus }) {
  return <Badge tone={TONE[status]}>{STAY_BOOKING_STATUS_LABELS[status]}</Badge>;
}
