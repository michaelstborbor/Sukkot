import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { addDocument, getDocumentAccessUrl } from "@/server/services/properties";
import { verifyPrivateSignature } from "@/server/storage";
import { makeUser, pngFile, publishedListing } from "../support/factory";

describe("private documents", () => {
  it("only the lister and authorised staff can open documents; denials are audited", async () => {
    const owner = await makeUser(["OWNER"]);
    const mod = await makeUser(["MODERATOR"]);
    const officer = await makeUser(["VERIFICATION_OFFICER"]);
    const stranger = await makeUser();
    const p = await publishedListing(owner, mod);
    const doc = await addDocument(owner, p.id, await pngFile("deed.png"), "Title deed", "TITLE_DEED");

    const url = await getDocumentAccessUrl(owner, doc.id);
    expect(url).toContain("sig=");
    expect(await getDocumentAccessUrl(officer, doc.id)).toContain("sig=");

    await expect(getDocumentAccessUrl(stranger, doc.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getDocumentAccessUrl(mod, doc.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getDocumentAccessUrl(null, doc.id)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(await db.auditLog.count({ where: { action: "document.access_denied", targetId: doc.id } })).toBe(2);
    expect((await db.property.findUniqueOrThrow({ where: { id: p.id } })).documentsStatus).toBe("PENDING_REVIEW");
  });

  it("rejects tampered signed URLs", () => {
    expect(verifyPrivateSignature("property-docs/x/y.pdf", Math.floor(Date.now() / 1000) + 60, "not-a-signature")).toBe(false);
  });
});
