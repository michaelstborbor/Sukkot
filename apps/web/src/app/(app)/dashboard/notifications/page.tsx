import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { relativeTime } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { listNotifications } from "@/server/services/notifications";
import { PageHeader } from "@/components/dashboard/shell";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const actor = await requirePageActor("/dashboard/notifications");
  const items = await listNotifications(actor, 100);
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <>
      <PageHeader title="Notifications" actions={unread > 0 ? <ActionButton path="/notifications" body={{}} label="Mark all as read" success="All caught up" /> : undefined} />
      {items.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications" />
      ) : (
        <ul className="card divide-y divide-line">
          {items.map((n) => {
            const inner = (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn("text-sm", !n.readAt ? "font-bold" : "font-semibold")}>{n.title}</p>
                  <span className="shrink-0 text-xs text-muted">{relativeTime(n.createdAt)}</span>
                </div>
                {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
              </>
            );
            return (
              <li key={n.id} className={cn(!n.readAt && "bg-gold-50/50")}>
                {n.link ? <Link href={n.link} className="block p-4 hover:bg-navy-50">{inner}</Link> : <div className="p-4">{inner}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
