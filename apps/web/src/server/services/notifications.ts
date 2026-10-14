import "server-only";
import type { NotificationDTO } from "@sukkot/shared";
import { db } from "../db";
import type { Actor } from "../auth/session";
import { assertActor } from "../auth/actor";

export async function listNotifications(actorIn: Actor | null, take = 50): Promise<NotificationDTO[]> {
  const actor = assertActor(actorIn);
  const rows = await db.notification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take });
  return rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() }));
}

export async function markNotificationsRead(actorIn: Actor | null, ids?: string[]) {
  const actor = assertActor(actorIn);
  await db.notification.updateMany({ where: { userId: actor.id, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
}

export const unreadNotificationCount = (userId: string) => db.notification.count({ where: { userId, readAt: null } });
