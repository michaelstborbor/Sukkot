import { cn } from "@/lib/utils";

/**
 * The logo mark, built in front of the visitor: the walls are drawn, the gold roof goes on, then
 * the door opens with a warm light. It ends exactly on the static logo, and shows that final state
 * straight away when reduced motion is on.
 */
export function HouseMark({ className, label }: { className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("house-mark", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <radialGradient id="house-mark-glow">
          <stop offset="0" stopColor="#F6CF7A" stopOpacity="0.9" />
          <stop offset="0.45" stopColor="#E0AE4E" stopOpacity="0.45" />
          <stop offset="1" stopColor="#C8962E" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect className="hm-tile" width="40" height="40" rx="11" fill="#0B1F3A" />
      <ellipse className="hm-glow" cx="20" cy="26" rx="11" ry="10" fill="url(#house-mark-glow)" />
      <path className="hm-walls" pathLength={1} d="M12 18v12h16V18" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round" />
      <path className="hm-roof" pathLength={1} d="M8 19 20 9l12 10" fill="none" stroke="#C8962E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path className="hm-door" d="M18 30v-6a2 2 0 0 1 4 0v6" fill="#0F766E" />
    </svg>
  );
}
