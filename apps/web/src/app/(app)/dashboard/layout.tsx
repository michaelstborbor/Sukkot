import { Bell, Building2, CalendarClock, CreditCard, FileText, HandCoins, Heart, Home, Inbox, KeyRound, LayoutDashboard, MessageSquare, Settings, ShieldCheck, Users } from "lucide-react";
import { hasPermission } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { unreadMessageCount } from "@/server/services/messaging";
import { unreadNotificationCount } from "@/server/services/notifications";
import { db } from "@/server/db";
import { DashboardNav, type NavItem } from "@/components/dashboard/shell";
import { EmailVerifyBanner } from "@/components/dashboard/email-verify-banner";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor("/dashboard");
  const lister = hasPermission(actor.roles, "listing:create");
  const [unread, notes, me] = await Promise.all([
    unreadMessageCount(actor.id),
    unreadNotificationCount(actor.id),
    db.user.findUnique({ where: { id: actor.id }, select: { email: true, emailVerifiedAt: true, phoneVerifiedAt: true } }),
  ]);
  const icon = (I: typeof Home) => <I className="h-4 w-4" />;
  const items: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: icon(LayoutDashboard) },
    ...(lister ? [{ href: "/dashboard/properties", label: "My properties", icon: icon(Building2) }, { href: "/dashboard/enquiries", label: "Enquiries", icon: icon(Inbox) }] : []),
    { href: "/dashboard/messages", label: "Messages", icon: icon(MessageSquare), badge: unread },
    { href: "/dashboard/inspections", label: "Inspections", icon: icon(CalendarClock) },
    { href: "/dashboard/applications", label: "Applications", icon: icon(FileText) },
    { href: "/dashboard/offers", label: "Offers", icon: icon(HandCoins) },
    { href: "/dashboard/tenancies", label: lister ? "Tenants and leases" : "My tenancies", icon: icon(KeyRound) },
    { href: "/dashboard/payments", label: "Payments", icon: icon(CreditCard) },
    { href: "/dashboard/saved", label: "Saved", icon: icon(Heart) },
    { href: "/dashboard/notifications", label: "Notifications", icon: icon(Bell), badge: notes },
    { href: "/dashboard/verification", label: "Verification", icon: icon(ShieldCheck) },
    ...(actor.roles.includes("AGENT") ? [{ href: "/dashboard/agency", label: "Agency and team", icon: icon(Users) }] : []),
    ...(lister ? [{ href: "/dashboard/billing", label: "Plans and billing", icon: icon(CreditCard) }] : []),
    { href: "/dashboard/settings", label: "Account settings", icon: icon(Settings) },
  ];
  return (
    <div className="container-page grid gap-6 py-6 lg:grid-cols-[230px_1fr] lg:gap-10 lg:py-10">
      <DashboardNav items={items} title="Dashboard" />
      <div className="min-w-0">
        {me && !me.emailVerifiedAt && !me.phoneVerifiedAt && <EmailVerifyBanner email={me.email} className="mb-6" />}
        {children}
      </div>
    </div>
  );
}
