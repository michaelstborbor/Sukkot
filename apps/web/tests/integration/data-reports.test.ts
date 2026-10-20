import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as downloadRoute } from "@/app/api/v1/admin/data-reports/route";
import { db } from "@/server/db";
import { createSession } from "@/server/auth/session";
import { csvCell, datasetsFor, exportReport, previewReport, toCsv } from "@/server/services/data-reports";
import { makeUser, publishedListing } from "../support/factory";

const tag = () => `rpt${randomBytes(4).toString("hex")}`;

/** Parse the CSV this service writes (quoted cells, doubled quotes, CRLF lines). */
function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const body = text.replace(/^﻿/, "");
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(cell), (cell = "");
    else if (c === "\r" && body[i + 1] === "\n") row.push(cell), rows.push(row), (row = []), (cell = ""), i++;
    else cell += c;
  }
  return rows;
}

describe("admin data reports", () => {
  it("lets each kind of staff see only the data their role covers", async () => {
    const [user, owner, support, moderator, finance, admin] = await Promise.all([makeUser(), makeUser(["OWNER"]), makeUser(["SUPPORT"]), makeUser(["MODERATOR"]), makeUser(["FINANCE"]), makeUser(["SUPER_ADMIN"])]);
    expect(datasetsFor(user)).toEqual([]);
    expect(datasetsFor(owner)).toEqual([]);
    expect(datasetsFor(finance)).toEqual([]);
    expect(datasetsFor(support)).toEqual(["users", "listings"]);
    expect(datasetsFor(moderator)).toEqual(["listings"]);
    expect(datasetsFor(admin)).toEqual(["users", "listings"]);

    await expect(previewReport(null, { dataset: "users" })).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(previewReport(owner, { dataset: "listings" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(previewReport(finance, { dataset: "users" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(previewReport(moderator, { dataset: "users" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(exportReport(user, { dataset: "users" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(previewReport(admin, { dataset: "payments" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("filters users by search, account type, status, confirmed email and joining date", async () => {
    const admin = await makeUser(["SUPER_ADMIN"]);
    const t = tag();
    // A number no other test uses, so the phone search finds Amina among the newest rows.
    const digits = String(Math.floor(100_000 + Math.random() * 900_000));
    const [amina, kofi, sia] = await Promise.all([makeUser(["OWNER"], `Amina ${t}`), makeUser(["AGENT"], `Kofi ${t}`), makeUser(["USER"], `Sia ${t}`)]);
    await db.user.update({ where: { id: amina.id }, data: { emailVerifiedAt: new Date(), createdAt: new Date("2025-03-10T09:00:00Z"), phone: `+23276${digits}` } });
    await db.user.update({ where: { id: kofi.id }, data: { status: "SUSPENDED", suspendedReason: "Fake listings", createdAt: new Date("2025-06-01T23:30:00Z") } });
    await db.user.update({ where: { id: sia.id }, data: { createdAt: new Date("2025-09-15T12:00:00Z") } });

    const names = async (filters: Record<string, string>) => (await previewReport(admin, { dataset: "users", q: t, ...filters })).rows.map((r) => r[1]).sort();

    expect(await names({})).toEqual([`Amina ${t}`, `Kofi ${t}`, `Sia ${t}`]);
    expect(await names({ role: "AGENT" })).toEqual([`Kofi ${t}`]);
    expect(await names({ status: "SUSPENDED" })).toEqual([`Kofi ${t}`]);
    expect(await names({ emailConfirmed: "yes" })).toEqual([`Amina ${t}`]);
    expect(await names({ emailConfirmed: "no" })).toEqual([`Kofi ${t}`, `Sia ${t}`]);
    // "To" takes in the whole day.
    expect(await names({ joinedFrom: "2025-03-11", joinedTo: "2025-06-01" })).toEqual([`Kofi ${t}`]);
    // Empty form fields are ignored.
    expect(await names({ role: "", status: "", joinedFrom: "" })).toHaveLength(3);
    expect((await previewReport(admin, { dataset: "users", q: `76 ${digits.slice(0, 3)} ${digits.slice(3)}` })).rows.some((r) => r[0] === amina.id)).toBe(true);
    await expect(previewReport(admin, { dataset: "users", joinedFrom: "31/01/2025" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(previewReport(admin, { dataset: "users", joinedTo: "2025-02-31" })).rejects.toMatchObject({ code: "VALIDATION", fields: { joinedTo: "Not a real date" } });

    const preview = await previewReport(admin, { dataset: "users", q: `Kofi ${t}` });
    expect(preview.total).toBe(1);
    const row = Object.fromEntries(preview.columns.map((c, i) => [c, preview.rows[0]![i]]));
    expect(row).toMatchObject({ Email: kofi.email, "Email confirmed": "No", "Account types": "Tenant / buyer; Agent", Status: "Suspended", "Suspension reason": "Fake listings", Joined: "2025-06-01 23:30" });
    expect(preview.columns).not.toContain("Password");
  });

  it("filters listings and shows listers' private contacts only to staff allowed to see them", async () => {
    const t = tag();
    const owner = await makeUser(["OWNER"]);
    const agent = await makeUser(["AGENT"]);
    const moderator = await makeUser(["MODERATOR"]);
    const support = await makeUser(["SUPPORT"]);
    const rent = await publishedListing(owner, moderator, { title: `Lumley house ${t} to rent`, price: "15000", privateContactPhone: "076 123 456", privateContactEmail: "owner-private@test.sukkot.sl" });
    const sale = await publishedListing(agent, moderator, { title: `Hill Station house ${t} for sale`, purpose: "SALE", rentalPeriod: undefined, price: "900000", listerCapacity: "AGENT_FOR_OWNER" });
    await db.property.update({ where: { id: sale.id }, data: { isFeatured: true, createdAt: new Date("2025-02-02T10:00:00Z") } });

    const refs = async (filters: Record<string, string>) => (await previewReport(moderator, { dataset: "listings", q: t, ...filters })).rows.map((r) => r[0]).sort();

    expect(await refs({})).toEqual([rent.reference, sale.reference].sort());
    expect(await refs({ purpose: "SALE" })).toEqual([sale.reference]);
    expect(await refs({ status: "PUBLISHED", category: "HOUSE" })).toHaveLength(2);
    expect(await refs({ status: "DRAFT" })).toEqual([]);
    expect(await refs({ listedBy: "AGENT" })).toEqual([sale.reference]);
    expect(await refs({ listedBy: "OWNER" })).toEqual([rent.reference]);
    expect(await refs({ featured: "yes" })).toEqual([sale.reference]);
    expect(await refs({ minPrice: "100,000" })).toEqual([sale.reference]);
    expect(await refs({ maxPrice: "20000", currency: "SLE" })).toEqual([rent.reference]);
    expect(await refs({ maxPrice: "20000", currency: "USD" })).toEqual([]);
    expect(await refs({ createdTo: "2025-02-02" })).toEqual([sale.reference]);
    expect(await refs({ typeId: rent.propertyTypeId, locationId: rent.locationPathIds[0]! })).toHaveLength(2);
    expect(await refs({ q: rent.reference.toLowerCase() })).toEqual([rent.reference]);
    await expect(refs({ minPrice: "lots" })).rejects.toMatchObject({ code: "VALIDATION" });

    // A moderator already sees private contacts on the moderation screen, so the report includes them.
    const forModerator = await previewReport(moderator, { dataset: "listings", q: rent.reference });
    const row = Object.fromEntries(forModerator.columns.map((c, i) => [c, forModerator.rows[0]![i]]));
    expect(row).toMatchObject({ Title: rent.title, Price: "15000", Currency: "SLE", "Rental period": "Month", "Listed by": "Owner", "Lister email": owner.email, "Private contact phone": "+23276123456", "Private contact email": "owner-private@test.sukkot.sl" });

    // Customer support can list listings but never sees the private contacts, in the preview or the file.
    const forSupport = await previewReport(support, { dataset: "listings", q: rent.reference });
    expect(forSupport.columns).not.toContain("Private contact phone");
    expect(forSupport.rows[0]).not.toContain("+23276123456");
    const file = await exportReport(support, { dataset: "listings", q: rent.reference });
    expect(file.csv).not.toContain("23276123456");
    expect(file.csv).not.toContain("owner-private@");
  });

  it("downloads a CSV file that spreadsheets cannot run as formulas, and records each download", async () => {
    const t = tag();
    const admin = await makeUser(["SUPER_ADMIN"]);
    const nasty = await makeUser(["USER"], `=HYPERLINK("http://evil.example","${t}")`);
    await db.user.update({ where: { id: nasty.id }, data: { suspendedReason: "Said, \"hello\"\nthen left", status: "SUSPENDED" } });
    const { token } = await createSession(admin.id, { client: "web" });
    const ctx = { params: Promise.resolve({}) };
    const url = `http://localhost:3000/api/v1/admin/data-reports?dataset=users&q=${t}`;

    const res = await downloadRoute(new NextRequest(url, { headers: { cookie: `ss_session=${token}` } }), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="sukkot-users-\d{4}-\d{2}-\d{2}\.csv"$/);
    const bytes = new Uint8Array(await res.arrayBuffer());
    // A UTF-8 byte order mark, so Excel reads names with accents correctly.
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes);
    const rows = parseCsv(text);
    expect(rows[0]![0]).toBe("User ID");
    expect(rows).toHaveLength(2);
    expect(rows[1]![1]).toBe(`'=HYPERLINK("http://evil.example","${t}")`);
    expect(rows[1]![9]).toBe('Said, "hello"\nthen left');

    const log = await db.auditLog.findFirstOrThrow({ where: { action: "data_report.download", actorId: admin.id } });
    expect(log).toMatchObject({ targetType: "DataReport", targetId: "users" });
    expect(log.metadata).toMatchObject({ dataset: "users", filters: { q: t }, rows: 1, total: 1 });

    // Signed out, or signed in without the permission: no file and no audit record.
    expect((await downloadRoute(new NextRequest(url), ctx)).status).toBe(401);
    const tenant = await makeUser(["USER"]);
    const tenantSession = await createSession(tenant.id, { client: "web" });
    expect((await downloadRoute(new NextRequest(url, { headers: { cookie: `ss_session=${tenantSession.token}` } }), ctx)).status).toBe(403);
    expect(await db.auditLog.count({ where: { action: "data_report.download", actorId: tenant.id } })).toBe(0);
  });

  it("escapes every cell that could start a formula or break a row", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("+232 76 123 456")).toBe("'+232 76 123 456");
    expect(csvCell("-1+2")).toBe("'-1+2");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\t=1")).toBe("'\t=1");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('=1,"x"')).toBe(`"'=1,""x"""`);
    expect(toCsv([["a", "b"], ["c", ""]])).toBe("﻿a,b\r\nc,\r\n");
  });
});
