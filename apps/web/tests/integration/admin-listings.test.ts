import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { addImages, deleteListingPermanently, updateProperty } from "@/server/services/properties";
import { houseInput, makeUser, pngFile, publishedListing } from "../support/factory";

describe("administrators and other people's listings", () => {
  it("lets a super administrator edit any listing, records it and tells the lister; moderators cannot", async () => {
    const owner = await makeUser(["OWNER"]);
    const moderator = await makeUser(["MODERATOR"]);
    const admin = await makeUser(["SUPER_ADMIN"]);
    const listing = await publishedListing(owner, moderator);

    await expect(updateProperty(moderator, listing.id, await houseInput({ title: "Moderator rewrite of this house" }))).rejects.toMatchObject({ code: "FORBIDDEN" });

    await updateProperty(admin, listing.id, await houseInput({ title: "Corrected title for this family house" }));
    expect((await db.property.findUniqueOrThrow({ where: { id: listing.id } })).title).toBe("Corrected title for this family house");
    expect(await db.propertyStatusHistory.count({ where: { propertyId: listing.id, field: "details", actorId: admin.id } })).toBe(1);
    expect(await db.notification.count({ where: { userId: owner.id, type: "listing.staff_edit" } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "listing.staff_edit", targetId: listing.id } })).toBe(1);

    // Photos too.
    await addImages(admin, listing.id, [await pngFile("fixed.png")]);
    expect(await db.propertyImage.count({ where: { propertyId: listing.id } })).toBe(2);
  });

  it("deletes a listing for good only for a super administrator with a reason, and keeps an audit record", async () => {
    const owner = await makeUser(["OWNER"]);
    const moderator = await makeUser(["MODERATOR"]);
    const admin = await makeUser(["SUPER_ADMIN"]);
    const listing = await publishedListing(owner, moderator);

    await expect(deleteListingPermanently(moderator, listing.id, "Duplicate of another listing")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(deleteListingPermanently(admin, listing.id, "")).rejects.toMatchObject({ code: "VALIDATION" });

    await deleteListingPermanently(admin, listing.id, "Duplicate of another listing");
    expect(await db.property.findUnique({ where: { id: listing.id } })).toBeNull();
    expect(await db.propertyImage.count({ where: { propertyId: listing.id } })).toBe(0);
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "listing.delete", targetId: listing.id } });
    expect(log.metadata).toMatchObject({ reference: listing.reference, reason: "Duplicate of another listing" });
    expect(await db.notification.count({ where: { userId: owner.id, type: "listing.deleted" } })).toBe(1);
  });
});
