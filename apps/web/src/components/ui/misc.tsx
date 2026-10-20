import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const badgeTones = {
  neutral: "bg-navy-50 text-navy-800 ring-navy-100",
  verified: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  gold: "bg-gold-50 text-gold-700 ring-gold-100",
  warning: "bg-warning-50 text-warning ring-amber-100",
  danger: "bg-danger-50 text-danger ring-red-100",
  dark: "bg-navy-900/85 text-white ring-white/10 backdrop-blur",
  light: "bg-surface/90 text-ink ring-transparent font-medium",
} as const;

export function Badge({ tone = "neutral", className, children, title }: { tone?: keyof typeof badgeTones; className?: string; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export function Card({ className, children, as: As = "div" }: { className?: string; children: React.ReactNode; as?: "div" | "section" | "article" }) {
  return <As className={cn("card", className)}>{children}</As>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-md", className)} />;
}

export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line bg-surface px-6 py-12 text-center">
      {icon && <div className="mb-3 rounded-full bg-navy-50 p-3 text-navy-700">{icon}</div>}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {body && <p className="mt-1 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, icon, href }: { label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode; href?: string }) {
  const body = (
    <div className="card h-full p-4 transition-shadow hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-center justify-between text-muted">
        <span className="text-xs font-semibold tracking-wide uppercase">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold text-navy-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-[var(--radius-card)]">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Pagination({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (p: number) => string }) {
  if (totalPages <= 1) return null;
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  const item = "inline-flex h-10 min-w-10 items-center justify-center rounded-[10px] border border-line bg-surface px-3 text-sm font-semibold transition hover:border-navy-600";
  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className={item} rel="prev" aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      )}
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-muted">…</span>
        ) : (
          <Link key={p} href={hrefFor(p)} aria-current={p === page ? "page" : undefined} className={cn(item, p === page && "border-navy-900 bg-navy-900 text-white hover:border-navy-900")}>
            {p}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link href={hrefFor(page + 1)} className={item} rel="next" aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </nav>
  );
}

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const letters = name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full bg-navy-100 font-bold text-navy-800" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {letters || "?"}
    </span>
  );
}

export function SectionHeading({ eyebrow, title, body, action, className, as: Heading = "h2" }: { eyebrow?: string; title: string; body?: string; action?: React.ReactNode; className?: string; as?: "h1" | "h2" }) {
  return (
    <div className={cn("mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className="mb-2 text-xs font-bold tracking-[0.14em] text-clay-700 uppercase">{eyebrow}</p>}
        <Heading className="font-display text-3xl text-ink sm:text-4xl">{title}</Heading>
        {body && <p className="mt-3 text-base text-muted">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "danger" | "success"; title?: string; children: React.ReactNode; className?: string }) {
  const tones = {
    info: "border-navy-100 bg-navy-50 text-navy-900",
    warning: "border-amber-200 bg-warning-50 text-amber-900",
    danger: "border-red-200 bg-danger-50 text-red-900",
    success: "border-emerald-100 bg-emerald-50 text-emerald-900",
  };
  return (
    <div role="note" className={cn("rounded-xl border p-4 text-sm leading-relaxed", tones[tone], className)}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {children}
    </div>
  );
}
