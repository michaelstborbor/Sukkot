import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createEnquiry, getConversation, sendMessage, blockUser, unreadMessageCount } from "@/server/services/messaging";
import { makeUser, publishedListing } from "../support/factory";

describe("messaging access control", () => {
  it("lets only participants read a conversation, audits staff access, and honours blocks", async () => {
    const owner = await makeUser(["OWNER"], "Landlord");
    const mod = await makeUser(["MODERATOR"], "Mod");
    const tenant = await makeUser(["USER"], "Tenant");
    const stranger = await makeUser(["USER"], "Stranger");
    const p = await publishedListing(owner, mod);

    const enq = await createEnquiry(tenant, { propertyId: p.id, message: "Is this still available from next month?" });
    expect(await unreadMessageCount(owner.id)).toBeGreaterThan(0);

    const asOwner = await getConversation(owner, enq.conversationId);
    expect(asOwner.messages).toHaveLength(1);
    await expect(getConversation(stranger, enq.conversationId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(sendMessage(stranger, enq.conversationId, { body: "hello" })).rejects.toMatchObject({ code: "NOT_FOUND" });

    const asMod = await getConversation(mod, enq.conversationId);
    expect(asMod.isParticipant).toBe(false);
    const auditRow = await db.auditLog.findFirst({ where: { actorId: mod.id, action: "conversation.staff_view", targetId: enq.conversationId } });
    expect(auditRow).not.toBeNull();

    await blockUser(owner, tenant.id);
    await expect(sendMessage(tenant, enq.conversationId, { body: "Hello again" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not allow enquiring about your own listing", async () => {
    const owner = await makeUser(["OWNER"]);
    const mod = await makeUser(["MODERATOR"]);
    const p = await publishedListing(owner, mod);
    await expect(createEnquiry(owner, { propertyId: p.id, message: "Talking to myself here" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
