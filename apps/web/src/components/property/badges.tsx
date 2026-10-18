import { BadgeCheck, Camera, FileCheck2, Sparkles, UserCheck } from "lucide-react";
import { formatDate, INSPECTED_BADGE, VERIFICATION_BADGES, type VerificationKind } from "@sukkot/shared";
import { Badge } from "@/components/ui/misc";

const ICONS: Record<VerificationKind, React.ReactNode> = {
  IDENTITY: <UserCheck className="h-3.5 w-3.5" aria-hidden />,
  AGENT_CREDENTIALS: <BadgeCheck className="h-3.5 w-3.5" aria-hidden />,
  LISTING_AUTHORITY: <BadgeCheck className="h-3.5 w-3.5" aria-hidden />,
  PROPERTY_DOCUMENTS: <FileCheck2 className="h-3.5 w-3.5" aria-hidden />,
};

/** Shows only badges whose verification is actually complete; the tooltip says what each one means. */
export function VerificationBadge({ kind, compact }: { kind: VerificationKind; compact?: boolean }) {
  const b = VERIFICATION_BADGES[kind];
  return (
    <Badge tone="verified" title={`${b.means} ${b.doesNotMean}`}>
      {ICONS[kind]}
      {compact ? b.label.split(" ")[0] : b.label}
    </Badge>
  );
}

export function FeaturedBadge() {
  return (
    <Badge tone="gold">
      <Sparkles className="h-3.5 w-3.5" aria-hidden /> Featured
    </Badge>
  );
}

/** Sukkot Salone staff visited the property in person. Always dated, so renters can judge how recent it is. */
export function InspectedBadge({ date, compact }: { date: string; compact?: boolean }) {
  return (
    <Badge tone="verified" title={`${INSPECTED_BADGE.means} ${INSPECTED_BADGE.doesNotMean}`}>
      <Camera className="h-3.5 w-3.5" aria-hidden />
      {compact ? "Inspected" : `${INSPECTED_BADGE.label} · ${formatDate(date)}`}
    </Badge>
  );
}
