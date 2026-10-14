import "server-only";
import { enquirySchema, messageSchema, type ConversationSummaryDTO, type MessageDTO } from "@sukkot/shared";
import { db, type Tx } from "../db";
import { AppError, forbidden, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertActor, can } from "../auth/actor";
import { audit } from "../audit";
import { notify } from "../notify";
import { publicImageUrl } from "../storage";

async function isBlockedBetween(a: string, b: string, tx: Tx | typeof db = db) {
  const block = await tx.userBlock.findFirst({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    select: { blockerId: true },
  });
  return !!block;
}

/** Find or create the conversation for a property between a user and the listing side. */
export async function ensureConversation(
  tx: Tx,
  opts: { subject: string; propertyId: string; userIds: string[]; applicationId?: string; offerId?: string },
) {
  if (opts.applicationId) {
    const existing = await tx.conversation.findUnique({ where: { applicationId: opts.applicationId } });
    if (existing) return existing;
  }
  if (opts.offerId) {
    const existing = await tx.conversation.findUnique({ where: { offerId: opts.offerId } });
    if (existing) return existing;
  }
  const userIds = [...new Set(opts.userIds)];
  return tx.conversation.create({
    data: {
      subject: opts.subject,
      propertyId: opts.propertyId,
      applicationId: opts.applicationId,
      offerId: opts.offerId,
      participants: { create: userIds.map((userId) => ({ userId })) },
    },
  });
}

export async function postSystemMessage(tx: Tx, conversationId: string, senderId: string, body: string) {
  await tx.message.create({ data: { conversationId, senderId, body, isSystem: true } });
  await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
}

export async function createEnquiry(actorIn: Actor | null, input: unknown) {
  const actor = assertActor(actorIn);
  const data = enquirySchema.parse(input);
  const property = await db.property.findUnique({
    where: { id: data.propertyId },
    select: { id: true, title: true, reference: true, listerId: true, ownerId: true, listingStatus: true },
  });
  if (!property || property.listingStatus !== "PUBLISHED") throw notFound("Listing");
  if (property.listerId === actor.id || property.ownerId === actor.id) {
    throw new AppError("BAD_REQUEST", "You cannot send an enquiry about your own listing");
  }
  if (await isBlockedBetween(actor.id, property.listerId)) throw forbidden("You cannot contact this lister");

  return db.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        subject: `${property.title} (${property.reference})`,
        propertyId: property.id,
        participants: { create: [...new Set([actor.id, property.listerId])].map((userId) => ({ userId })) },
      },
    });
    await tx.message.create({ data: { conversationId: conversation.id, senderId: actor.id, body: data.message } });
    const enquiry = await tx.enquiry.create({
      data: {
        propertyId: property.id,
        userId: actor.id,
        intent: data.intent,
        message: data.message,
        contactPhone: data.contactPhone ?? null,
        preferredContact: data.preferredContact,
        conversationId: conversation.id,
      },
    });
    await tx.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: conversation.id, userId: actor.id } },
      data: { lastReadAt: new Date() },
    });
    await tx.property.update({ where: { id: property.id }, data: { enquiryCount: { increment: 1 } } });
    await notify(
      [
        {
          userId: property.listerId,
          type: "enquiry.new",
          title: `New enquiry about ${property.reference}`,
          body: `${actor.name}: ${data.message.slice(0, 140)}`,
          link: `/dashboard/messages/${conversation.id}`,
          email: true,
        },
      ],
      tx,
    );
    return { enquiryId: enquiry.id, conversationId: conversation.id };
  });
}

export async function listConversations(actorIn: Actor | null): Promise<ConversationSummaryDTO[]> {
  const actor = assertActor(actorIn);
  const links = await db.conversationParticipant.findMany({
    where: { userId: actor.id, archived: false },
    include: {
      conversation: {
        include: {
          property: { select: { id: true, title: true, slug: true, images: { take: 1, orderBy: { sortOrder: "asc" } } } },
          participants: { include: { user: { select: { id: true, profile: { select: { fullName: true } } } } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1, where: { hiddenAt: null } },
        },
      },
    },
    orderBy: { conversation: { lastMessageAt: "desc" } },
    take: 100,
  });
  const unreadCounts = await Promise.all(
    links.map((l) =>
      db.message.count({
        where: {
          conversationId: l.conversationId,
          senderId: { not: actor.id },
          hiddenAt: null,
          ...(l.lastReadAt ? { createdAt: { gt: l.lastReadAt } } : {}),
        },
      }),
    ),
  );
  return links.map((l, i) => {
    const c = l.conversation;
    const last = c.messages[0];
    return {
      id: c.id,
      subject: c.subject,
      property: c.property
        ? { id: c.property.id, title: c.property.title, slug: c.property.slug, coverUrl: c.property.images[0] ? publicImageUrl(c.property.images[0].storageKey, 480) : null }
        : null,
      otherParticipants: c.participants
        .filter((p) => p.userId !== actor.id)
        .map((p) => ({ id: p.userId, name: p.user.profile?.fullName ?? "User" })),
      lastMessage: last ? { body: last.body.slice(0, 160), at: last.createdAt.toISOString(), fromMe: last.senderId === actor.id } : null,
      unread: unreadCounts[i] ?? 0,
      updatedAt: c.lastMessageAt.toISOString(),
    };
  });
}

/** Participants only. Staff with moderation permission may read, and every such read is audited. */
async function authorizeConversation(actor: Actor, conversationId: string, ipHash?: string | null) {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: { include: { user: { select: { id: true, profile: { select: { fullName: true } } } } } },
      property: { select: { id: true, title: true, slug: true, reference: true } },
    },
  });
  if (!conversation) throw notFound("Conversation");
  const isParticipant = conversation.participants.some((p) => p.userId === actor.id);
  if (!isParticipant) {
    if (!can(actor, "admin:messages.moderate")) throw notFound("Conversation");
    await audit({ actorId: actor.id, action: "conversation.staff_view", targetType: "Conversation", targetId: conversationId, ipHash });
  }
  return { conversation, isParticipant };
}

export async function getConversation(actorIn: Actor | null, conversationId: string, ipHash?: string | null) {
  const actor = assertActor(actorIn);
  const { conversation, isParticipant } = await authorizeConversation(actor, conversationId, ipHash);
  const messages = await db.message.findMany({
    where: { conversationId, ...(isParticipant ? { hiddenAt: null } : {}) },
    include: { sender: { select: { profile: { select: { fullName: true } } } } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const others = conversation.participants.filter((p) => p.userId !== actor.id);
  const otherReadAt = others.map((o) => o.lastReadAt?.getTime() ?? 0);
  if (isParticipant) {
    await db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: actor.id } },
      data: { lastReadAt: new Date() },
    });
  }
  const dto: MessageDTO[] = messages.map((m) => ({
    id: m.id,
    body: m.body,
    senderId: m.senderId,
    senderName: m.isSystem ? "Sukkot Salone" : (m.sender.profile?.fullName ?? "User"),
    createdAt: m.createdAt.toISOString(),
    fromMe: m.senderId === actor.id && !m.isSystem,
    readByOthers: otherReadAt.some((t) => t >= m.createdAt.getTime()),
  }));
  return {
    id: conversation.id,
    subject: conversation.subject,
    property: conversation.property,
    participants: conversation.participants.map((p) => ({ id: p.userId, name: p.user.profile?.fullName ?? "User" })),
    isParticipant,
    messages: dto,
  };
}

export async function sendMessage(actorIn: Actor | null, conversationId: string, input: unknown) {
  const actor = assertActor(actorIn);
  const { body } = messageSchema.parse(input);
  const conversation = await db.conversation.findUnique({ where: { id: conversationId }, include: { participants: true } });
  if (!conversation || !conversation.participants.some((p) => p.userId === actor.id)) throw notFound("Conversation");
  const others = conversation.participants.filter((p) => p.userId !== actor.id);
  for (const o of others) {
    if (await isBlockedBetween(actor.id, o.userId)) throw forbidden("You cannot message this user");
  }
  return db.$transaction(async (tx) => {
    const message = await tx.message.create({ data: { conversationId, senderId: actor.id, body } });
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: message.createdAt } });
    await tx.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: actor.id } },
      data: { lastReadAt: message.createdAt, archived: false },
    });
    await tx.conversationParticipant.updateMany({ where: { conversationId, userId: { not: actor.id } }, data: { archived: false } });
    await notify(
      others.map((o) => ({
        userId: o.userId,
        type: "message.new",
        title: `New message from ${actor.name}`,
        body: body.slice(0, 140),
        link: `/dashboard/messages/${conversationId}`,
      })),
      tx,
    );
    return { id: message.id, createdAt: message.createdAt.toISOString() };
  });
}

export async function unreadMessageCount(actorId: string): Promise<number> {
  const rows = await db.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM messages m
    JOIN conversation_participants cp ON cp."conversationId" = m."conversationId" AND cp."userId" = ${actorId}
    WHERE m."senderId" <> ${actorId}
      AND m."hiddenAt" IS NULL
      AND (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt")`;
  return Number(rows[0]?.n ?? 0);
}

export async function blockUser(actorIn: Actor | null, userId: string) {
  const actor = assertActor(actorIn);
  if (userId === actor.id) throw new AppError("BAD_REQUEST", "You cannot block yourself");
  await db.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: actor.id, blockedId: userId } },
    create: { blockerId: actor.id, blockedId: userId },
    update: {},
  });
}

export async function unblockUser(actorIn: Actor | null, userId: string) {
  const actor = assertActor(actorIn);
  await db.userBlock.deleteMany({ where: { blockerId: actor.id, blockedId: userId } });
}

/** Moderators can hide abusive messages; the content stays for audit. */
export async function hideMessage(actorIn: Actor | null, messageId: string, reason: string) {
  const actor = assertActor(actorIn);
  if (!can(actor, "admin:messages.moderate")) throw forbidden();
  await db.message.update({ where: { id: messageId }, data: { hiddenAt: new Date(), hiddenReason: reason } });
  await audit({ actorId: actor.id, action: "message.hide", targetType: "Message", targetId: messageId, metadata: { reason } });
}
