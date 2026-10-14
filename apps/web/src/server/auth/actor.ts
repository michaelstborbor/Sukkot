import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasPermission, isStaff, type Permission } from "@sukkot/shared";
import { forbidden, unauthenticated } from "../errors";
import { resolveSession, SESSION_COOKIE, type Actor } from "./session";

/** Current actor for server components and route handlers using the session cookie. Cached per request. */
export const getCurrentActor = cache(async (): Promise<Actor | null> => {
  const jar = await cookies();
  return resolveSession(jar.get(SESSION_COOKIE)?.value);
});

/** For pages: redirect to sign-in when not signed in. */
export async function requirePageActor(next?: string): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) redirect(`/auth/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return actor;
}

export async function requirePagePermission(permission: Permission, next?: string): Promise<Actor> {
  const actor = await requirePageActor(next);
  if (!hasPermission(actor.roles, permission)) redirect("/dashboard?denied=1");
  return actor;
}

export function assertActor(actor: Actor | null): Actor {
  if (!actor) throw unauthenticated();
  return actor;
}

export function assertPermission(actor: Actor | null, permission: Permission): Actor {
  const a = assertActor(actor);
  if (!hasPermission(a.roles, permission)) throw forbidden();
  return a;
}

export const can = (actor: Actor | null, permission: Permission) => !!actor && hasPermission(actor.roles, permission);
export const actorIsStaff = (actor: Actor | null) => !!actor && isStaff(actor.roles);
