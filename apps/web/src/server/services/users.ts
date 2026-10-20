import "server-only";
import { profileUpdateSchema, type MeDTO, type VerificationKind } from "@sukkot/shared";
import { db } from "../db";
import { notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertActor } from "../auth/actor";
import { publicImageUrl } from "../storage";
import { storeImage } from "../uploads";
import { unreadMessageCount } from "./messaging";
import { unreadNotificationCount } from "./notifications";

export async function getMe(actorIn: Actor | null): Promise<MeDTO> {
  const actor = assertActor(actorIn);
  const user = await db.user.findUnique({
    where: { id: actor.id },
    include: { profile: true, verificationRequests: { where: { status: "VERIFIED", propertyId: null }, select: { kind: true, expiresAt: true } } },
  });
  if (!user) throw notFound("User");
  const now = new Date();
  const [unreadMessages, unreadNotifications] = await Promise.all([unreadMessageCount(actor.id), unreadNotificationCount(actor.id)]);
  return {
    id: user.id,
    email: user.email,
    fullName: user.profile?.fullName ?? user.email,
    phone: user.phone,
    roles: actor.roles,
    avatarUrl: user.profile?.avatarKey ? publicImageUrl(user.profile.avatarKey, 480) : null,
    badges: [...new Set(user.verificationRequests.filter((v) => !v.expiresAt || v.expiresAt > now).map((v) => v.kind as VerificationKind))],
    unreadMessages,
    unreadNotifications,
  };
}

export async function updateProfile(actorIn: Actor | null, input: unknown) {
  const actor = assertActor(actorIn);
  const data = profileUpdateSchema.parse(input);
  const current = await db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { phone: true } });
  // A different number loses its confirmation and any code sent to the old one; saving the same number keeps it.
  const phoneChanged = data.phone !== undefined && (data.phone ?? null) !== current.phone;
  if (phoneChanged) await db.authToken.deleteMany({ where: { userId: actor.id, type: "PHONE_VERIFICATION" } });
  await db.user.update({
    where: { id: actor.id },
    data: {
      ...(phoneChanged ? { phone: data.phone, phoneVerifiedAt: null } : {}),
      profile: {
        update: {
          ...(data.fullName ? { fullName: data.fullName } : {}),
          ...(data.whatsapp !== undefined ? { whatsapp: data.whatsapp } : {}),
          ...(data.bio !== undefined ? { bio: data.bio ?? null } : {}),
          ...(data.preferredContact ? { preferredContact: data.preferredContact } : {}),
          ...(data.showPhone !== undefined ? { showPhone: data.showPhone } : {}),
          ...(data.locale ? { locale: data.locale } : {}),
        },
      },
    },
  });
  return getMe(actor);
}

export async function updateAvatar(actorIn: Actor | null, file: File) {
  const actor = assertActor(actorIn);
  const stored = await storeImage(file, `avatars/${actor.id}`);
  await db.userProfile.update({ where: { userId: actor.id }, data: { avatarKey: stored.baseKey } });
  return { avatarUrl: publicImageUrl(stored.baseKey, 480) };
}

/** Self-service account upgrade to landlord/owner or agent. Staff roles are never self-assigned. */
export async function addSelfServiceRole(actorIn: Actor | null, role: "OWNER" | "AGENT") {
  const actor = assertActor(actorIn);
  await db.userRoleAssignment.upsert({ where: { userId_role: { userId: actor.id, role } }, create: { userId: actor.id, role }, update: {} });
}

/** Data-protection: user-requested deletion anonymises personal data while keeping financial/audit records. */
export async function deactivateAccount(actorIn: Actor | null) {
  const actor = assertActor(actorIn);
  await db.$transaction([
    db.property.updateMany({ where: { listerId: actor.id, listingStatus: { in: ["PUBLISHED", "PAUSED", "PENDING_REVIEW", "DRAFT"] } }, data: { listingStatus: "REMOVED" } }),
    db.user.update({
      where: { id: actor.id },
      data: { status: "DEACTIVATED", email: `deleted+${actor.id}@deleted.invalid`, phone: null, profile: { update: { fullName: "Deleted user", bio: null, whatsapp: null, avatarKey: null } } },
    }),
    db.session.deleteMany({ where: { userId: actor.id } }),
    db.auditLog.create({ data: { actorId: actor.id, action: "account.deactivate", targetType: "User", targetId: actor.id } }),
  ]);
}

export async function publicAgentProfile(userId: string) {
  const user = await db.user.findFirst({
    where: { id: userId, status: "ACTIVE", roles: { some: { role: { in: ["AGENT", "OWNER"] } } } },
    include: {
      profile: true,
      roles: true,
      agencyMemberships: { include: { agency: true } },
      verificationRequests: { where: { status: "VERIFIED", propertyId: null }, select: { kind: true, expiresAt: true } },
    },
  });
  return user;
}
