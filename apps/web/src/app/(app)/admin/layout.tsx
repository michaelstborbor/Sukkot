import { BadgeCheck, Building2, Camera, ClipboardList, CreditCard, Flag, LayoutDashboard, ListChecks, MapPin, Settings, Shapes, Users, Briefcase } from "lucide-react";
import { hasPermission, type Permission } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { db } from "@/server/db";
import { DashboardNav, type NavItem } from "@/components/dashboard/shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePagePermission("admin:access", "/admin");
  const [pending, visits, verif, reports] = await Promise.all([
    db.property.count({ where: { listingStatus: "PENDING_REVIEW" } }),
    db.siteVisit.count({ where: { status: "REQUESTED" } }),
    db.verificationRequest.count({ where: { status: "PENDING_REVIEW" } }),
    db.report.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
  ]);
  const icon = (I: typeof Users) => <I className="h-4 w-4" />;
  const all: (NavItem & { perm: Permission })[] = [
    { href: "/admin", label: "Overview", icon: icon(LayoutDashboard), perm: "admin:access" },
    { href: "/admin/listings", label: "Listing moderation", icon: icon(Building2), perm: "admin:listings.moderate", badge: pending },
    { href: "/admin/visits", label: "Visits and photos", icon: icon(Camera), perm: "admin:listings.moderate", badge: visits },
    { href: "/admin/verification", label: "Verification queue", icon: icon(BadgeCheck), perm: "admin:verification.review", badge: verif },
    { href: "/admin/reports", label: "Reports", icon: icon(Flag), perm: "admin:reports.handle", badge: reports },
    { href: "/admin/users", label: "Users", icon: icon(Users), perm: "admin:users.manage" },
    { href: "/admin/agencies", label: "Agencies", icon: icon(Briefcase), perm: "admin:users.manage" },
    { href: "/admin/locations", label: "Locations", icon: icon(MapPin), perm: "admin:locations.manage" },
    { href: "/admin/catalog", label: "Types and amenities", icon: icon(Shapes), perm: "admin:catalog.manage" },
    { href: "/admin/plans", label: "Plans", icon: icon(ListChecks), perm: "admin:plans.manage" },
    { href: "/admin/payments", label: "Payments", icon: icon(CreditCard), perm: "admin:payments.view" },
    { href: "/admin/settings", label: "Site settings", icon: icon(Settings), perm: "admin:settings.manage" },
    { href: "/admin/audit", label: "Audit log", icon: icon(ClipboardList), perm: "admin:audit.view" },
  ];
  const items = all.filter((i) => hasPermission(actor.roles, i.perm));
  return (
    <div className="container-page grid gap-6 py-6 lg:grid-cols-[230px_1fr] lg:gap-10 lg:py-10">
      <DashboardNav items={items} title="Administration" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
