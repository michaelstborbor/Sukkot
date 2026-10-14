import { getCurrentActor } from "@/server/auth/actor";
import { hasPermission, isStaff } from "@sukkot/shared";
import { unreadMessageCount } from "@/server/services/messaging";
import { unreadNotificationCount } from "@/server/services/notifications";
import { HeaderClient } from "./header-client";

export async function SiteHeader() {
  const actor = await getCurrentActor();
  const [unreadMessages, unreadNotifications] = actor ? await Promise.all([unreadMessageCount(actor.id), unreadNotificationCount(actor.id)]) : [0, 0];
  return (
    <HeaderClient
      user={
        actor
          ? {
              name: actor.name,
              canList: hasPermission(actor.roles, "listing:create"),
              isStaff: isStaff(actor.roles),
              unreadMessages,
              unreadNotifications,
            }
          : null
      }
    />
  );
}
