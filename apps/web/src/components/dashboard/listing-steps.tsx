import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const LISTING_STEPS = ["Basics", "Price and details", "Photos and video", "Review and submit"] as const;

/** Where the lister is in adding a property: 1 Basics, 2 Price and details, 3 Photos and video, 4 Review and submit. */
export function ListingSteps({ current }: { current: number }) {
  return (
    <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Steps to list a property">
      {LISTING_STEPS.map((label, i) => (
        <li key={label} aria-current={i === current ? "step" : undefined} className="min-w-0">
          <div className={cn("h-1.5 rounded-full", i <= current ? "bg-emerald-700" : "bg-line")} />
          <p className={cn("mt-2 flex items-center gap-1 text-xs font-semibold sm:text-sm", i === current ? "text-navy-900" : "text-muted")}>
            {i < current ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden /> : <span className="shrink-0">{i + 1}.</span>}
            <span className="truncate">{label}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}
