"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function DashboardNav({ items, title }: { items: NavItem[]; title: string }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/dashboard" || href === "/admin" ? pathname === href : pathname.startsWith(href));
  return (
    <>
      <nav aria-label={title} className="sticky top-16 z-20 -mx-4 overflow-x-auto border-b border-line bg-white/95 px-4 backdrop-blur lg:hidden">
        <ul className="flex gap-1 py-2">
          {items.map((i) => (
            <li key={i.href}>
              <Link href={i.href} aria-current={active(i.href) ? "page" : undefined} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap", active(i.href) ? "bg-navy-900 text-white" : "text-ink hover:bg-navy-50")}>
                {i.label}
                {!!i.badge && <span className="rounded-full bg-gold-500 px-1.5 text-[11px] font-bold text-navy-950">{i.badge}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <aside className="hidden lg:block" aria-label={title}>
        <nav className="sticky top-24">
          <p className="mb-2 px-3 text-xs font-bold tracking-wider text-muted uppercase">{title}</p>
          <ul className="space-y-0.5">
            {items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} aria-current={active(i.href) ? "page" : undefined} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition", active(i.href) ? "bg-navy-900 text-white" : "text-ink hover:bg-white")}>
                  <span className="opacity-80">{i.icon}</span>
                  <span className="flex-1">{i.label}</span>
                  {!!i.badge && <span className="rounded-full bg-gold-500 px-1.5 text-[11px] font-bold text-navy-950">{i.badge}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
