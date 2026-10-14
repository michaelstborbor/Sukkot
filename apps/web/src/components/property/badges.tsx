import { BadgeCheck, FileCheck2, Sparkles, UserCheck } from "lucide-react";
import { VERIFICATION_BADGES, type VerificationKind } from "@sukkot/shared";
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
