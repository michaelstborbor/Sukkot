import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { stayDateString, stayToday } from "@sukkot/shared";
import { db } from "@/server/db";
import { reviewManualPayment, submitManualPlatformPayment } from "@/server/payments";
import { setSetting } from "@/server/services/settings";
import {
  addRoomType,
  arrangeStay,
  cancelStayByGuest,
  cancelStayByStaff,
  confirmStayBooking,
  expireStayBookings,
  getStayReceipt,
  getStaySetup,
  listBookableStays,
  markStayUnavailable,
  quoteStay,
  recordStayOutcome,
  recordStayPayout,
  recordStayRefund,
  requestStayBooking,
  saveStayDetails,
  setStayRoom,
} from "@/server/services/stays";
import type { Actor } from "@/server/auth/session";
import { makeUser, publishedListing } from "../support/factory";

const txId = () => `BK${randomBytes(5).toString("hex").toUpperCase()}`;
const day = (n: number) => stayDateString(new Date(stayToday().getTime() + n * 86_400_000));

let moderator: Actor;
let finance: Actor;

beforeAll(async () => {
  await setSetting("billing.manual", { enabled: true, accountName: "Sukkot Salone (test)", orangeMoneyNumber: "076000000", afrimoneyNumber: "", bankDetails: "" });
  await setSetting("stay.listingFee", { priceMinor: "100000", currency: "SLE" });
  await setSetting("stay.lateBooking", { noticeDays: 7, surchargePercent: 10 });
  moderator = await makeUser(["MODERATOR"]);
  finance = await makeUser(["FINANCE"]);
});

/** A published hotel with three standard doubles at Le 500 a night, open by agreement. */
async function hotel(policy = "MODERATE") {
  const owner = await makeUser(["OWNER"]);
  const p = await publishedListing(owner, moderator, { purpose: "SHORT_STAY", rentalPeriod: "DAY", price: "500" });
  await saveStayDetails(owner, p.id, { kind: "HOTEL", cancellationPolicy: policy, facilities: ["restaurant", "notAFacility"], receptionPhone: "076 111 222" });
  const room = await addRoomType(owner, p.id, { name: "Standard double", roomsCount: 3, maxAdults: 2, maxChildren: 1, nightlyPrice: "500" });
  await arrangeStay(moderator, p.id, { open: true, commissionPercent: 12 });
  return { owner, property: p, room };
}

const request = (guest: Actor, propertyId: string, roomTypeId: string, checkIn: number, nights: number, extra: Record<string, unknown> = {}) =>
  requestStayBooking(guest, propertyId, {
    roomTypeId,
    checkIn: day(checkIn),
    checkOut: day(checkIn + nights),
    adults: 2,
    guestName: "Aminata Kamara",
    guestPhone: "+44 7700 900123",
    guestEmail: "Aminata@Example.com",
    extras: {},
    acceptPolicy: true,
    ...extra,
  });

/** Confirm, pay by transfer and have finance approve it. */
async function confirmAndPay(guest: Actor, bookingId: string) {
  await confirmStayBooking(moderator, bookingId, { propertyConfirmation: "Fatu at reception, ref 4471" });
  const payment = await submitManualPlatformPayment(guest, { purpose: "STAY_BOOKING", stayBookingId: bookingId, channel: "ORANGE_MONEY", externalReference: txId(), payerPhone: "076123456", idempotencyKey: randomUUID() });
  await reviewManualPayment(finance, payment.id, { approve: true });
  return payment;
}

describe("setting a place up for bookings", () => {
  it("says what is missing, and the paid listing fee opens bookings and books the photo shoot", async () => {
    const owner = await makeUser(["OWNER"]);
    const p = await publishedListing(owner, moderator, { purpose: "SHORT_STAY", rentalPeriod: "DAY", price: "700" });

    let setup = await getStaySetup(owner, p.id);
    expect(setup.bookable).toBe(false);
    expect(setup.missing).toEqual(["Choose what kind of place it is", "Add at least one room with its price", "Pay the Le 1,000 listing fee"]);
    await expect(getStaySetup(await makeUser(["OWNER"]), p.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const saved = await saveStayDetails(owner, p.id, { kind: "GUEST_HOUSE", facilities: ["hostOnSite", "pool"], gateClosesAt: "23:00", cleaningFee: "100" });
    expect(saved.details.facilities).toEqual(["hostOnSite"]);
    expect(saved.details.cleaningFee).toBeUndefined();
    await addRoomType(owner, p.id, { name: "Single", maxAdults: 1, nightlyPrice: "400" });

    const pay = () => submitManualPlatformPayment(owner, { purpose: "STAY_LISTING", propertyId: p.id, channel: "ORANGE_MONEY", externalReference: txId(), payerPhone: "076123456", idempotencyKey: randomUUID() });
    const payment = await pay();
    expect(payment.amount.amountMinor).toBe("100000");
    expect((await getStaySetup(owner, p.id)).bookable).toBe(false);
    await reviewManualPayment(finance, payment.id, { approve: true });

    setup = await getStaySetup(owner, p.id);
    expect(setup.bookable).toBe(true);
    expect(setup.property.stayListingPaidAt).not.toBeNull();
    const shoot = await db.siteVisit.findFirstOrThrow({ where: { propertyId: p.id, kind: "PHOTO_SHOOT" } });
    expect(shoot).toMatchObject({ status: "REQUESTED", paymentId: payment.id });
    await expect(pay()).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await listBookableStays("GUEST_HOUSE")).map((s) => s.id)).toContain(p.id);
    expect((await listBookableStays("HOTEL")).map((s) => s.id)).not.toContain(p.id);
  });

  it("refuses booking details on a listing that is not a short stay", async () => {
    const owner = await makeUser(["OWNER"]);
    const p = await publishedListing(owner, moderator);
    await expect(saveStayDetails(owner, p.id, { kind: "HOTEL" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("quotes", () => {
  it("adds the late booking charge under 7 days' notice and checks the guests fit", async () => {
    const { property, room } = await hotel();
    const early = await quoteStay(property.id, { roomTypeId: room.id, checkIn: day(7), checkOut: day(9), adults: 2 });
    expect(early).toMatchObject({ nights: 2, isLate: false, totalMinor: "100000" });
    const late = await quoteStay(property.id, { roomTypeId: room.id, checkIn: day(6), checkOut: day(8), rooms: 2, adults: 3 });
    expect(late).toMatchObject({ isLate: true, totalMinor: "220000" });
    expect(late.lines.at(-1)!.label).toContain("Late booking charge");

    await expect(quoteStay(property.id, { roomTypeId: room.id, checkIn: day(-1), checkOut: day(1) })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(quoteStay(property.id, { roomTypeId: room.id, checkIn: day(10), checkOut: day(10) })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(quoteStay(property.id, { roomTypeId: room.id, checkIn: day(10), checkOut: day(12), adults: 3 })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(quoteStay(property.id, { roomTypeId: room.id, checkIn: day(10), checkOut: day(12), rooms: 4 })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("a booking from request to receipt", () => {
  it("is checked with the property, paid to Sukkot Salone, verified by finance and paid out", async () => {
    const { owner, property, room } = await hotel();
    const guest = await makeUser();

    await expect(request(owner, property.id, room.id, 10, 3)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(request(guest, property.id, room.id, 10, 3, { acceptPolicy: false })).rejects.toThrow(/cancellation policy/);
    const b = await request(guest, property.id, room.id, 10, 3);
    expect(b).toMatchObject({ status: "REQUESTED", nights: 3, totalMinor: 150_000n, isLate: false, guestPhone: "+447700900123", guestEmail: "aminata@example.com", cancellationPolicy: "MODERATE" });
    await expect(request(guest, property.id, room.id, 10, 3)).rejects.toMatchObject({ code: "CONFLICT" });
    const staffAlert = await db.notification.findFirstOrThrow({ where: { userId: moderator.id, type: "stay.requested" }, orderBy: { createdAt: "desc" } });
    expect(staffAlert.body).toContain("Check availability with the property");

    // Nobody can pay before the property confirms.
    const payEarly = () => submitManualPlatformPayment(guest, { purpose: "STAY_BOOKING", stayBookingId: b.id, channel: "ORANGE_MONEY", externalReference: txId(), payerPhone: "076123456", idempotencyKey: randomUUID() });
    await expect(payEarly()).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(getStayReceipt(guest, b.reference)).rejects.toMatchObject({ code: "CONFLICT" });

    const { paymentDueAt } = await confirmStayBooking(moderator, b.id, { propertyConfirmation: "Fatu at reception, ref 4471" });
    expect(paymentDueAt.getTime() - Date.now()).toBeGreaterThan(47 * 3_600_000);
    const payment = await submitManualPlatformPayment(guest, { purpose: "STAY_BOOKING", stayBookingId: b.id, channel: "ORANGE_MONEY", externalReference: txId(), payerPhone: "076123456", idempotencyKey: randomUUID() });
    expect(payment.amount.amountMinor).toBe("150000");
    // A transfer waiting for finance is not a payment yet, and holds the room past the deadline.
    expect((await db.stayBooking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CONFIRMED");
    await db.stayBooking.update({ where: { id: b.id }, data: { paymentDueAt: new Date(Date.now() - 1000) } });
    await expireStayBookings();
    expect((await db.stayBooking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CONFIRMED");
    await expect(cancelStayByGuest(guest, b.reference, {})).rejects.toMatchObject({ code: "CONFLICT" });

    await reviewManualPayment(finance, payment.id, { approve: true });
    const paid = await db.stayBooking.findUniqueOrThrow({ where: { id: b.id } });
    expect(paid.status).toBe("PAID");
    expect(paid.paidAt).not.toBeNull();

    // The receipt has the address and dates; the room number is added when the property gives it.
    let receipt = await getStayReceipt(guest, b.reference);
    expect(receipt.booking.roomNumber).toBeNull();
    expect(receipt.details?.receptionPhone).toBe("+23276111222");
    expect(receipt.booking.checkIn.toISOString().slice(0, 10)).toBe(day(10));
    await setStayRoom(moderator, b.id, { roomNumber: "214" });
    receipt = await getStayReceipt(guest, b.reference);
    expect(receipt.booking.roomNumber).toBe("214");
    await expect(getStayReceipt(await makeUser(), b.reference)).rejects.toMatchObject({ code: "NOT_FOUND" });

    // The stay cannot be closed before the check-in day.
    await expect(recordStayOutcome(moderator, b.id, { outcome: "COMPLETED" })).rejects.toMatchObject({ code: "CONFLICT" });

    // Finance pay the property and cannot pay out more than was received.
    await expect(recordStayPayout(moderator, b.id, { amount: "1320", reference: "OM-PAYOUT-1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(recordStayPayout(finance, b.id, { amount: "1600", reference: "OM-PAYOUT-1" })).rejects.toMatchObject({ code: "VALIDATION" });
    await recordStayPayout(finance, b.id, { amount: "1320", reference: "OM-PAYOUT-1" });
    expect((await db.stayBooking.findUniqueOrThrow({ where: { id: b.id } })).payoutMinor).toBe(132_000n);
    await expect(recordStayPayout(finance, b.id, { amount: "1", reference: "OM-PAYOUT-2" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("expires a confirmed booking that is not paid in time", async () => {
    const { property, room } = await hotel();
    const guest = await makeUser();
    const b = await request(guest, property.id, room.id, 3, 1);
    expect(b.isLate).toBe(true);
    const { paymentDueAt } = await confirmStayBooking(moderator, b.id, { propertyConfirmation: "Manager by phone" });
    expect(paymentDueAt.getTime() - Date.now()).toBeLessThanOrEqual(12 * 3_600_000 + 5_000);
    await db.stayBooking.update({ where: { id: b.id }, data: { paymentDueAt: new Date(Date.now() - 1000) } });
    expect(await expireStayBookings()).toBeGreaterThanOrEqual(1);
    expect((await db.stayBooking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("EXPIRED");
    const pay = submitManualPlatformPayment(guest, { purpose: "STAY_BOOKING", stayBookingId: b.id, channel: "ORANGE_MONEY", externalReference: txId(), payerPhone: "076123456", idempotencyKey: randomUUID() });
    await expect(pay).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("tells the guest when the property has no room, without charging them", async () => {
    const { property, room } = await hotel();
    const guest = await makeUser();
    const b = await request(guest, property.id, room.id, 12, 2);
    await markStayUnavailable(moderator, b.id, { reason: "The hotel is fully booked for a conference." });
    const n = await db.notification.findFirstOrThrow({ where: { userId: guest.id, type: "stay.unavailable" } });
    expect(n.body).toContain("You have not been charged");
  });
});

describe("cancellations and refunds", () => {
  it("refunds a paid guest under the policy, and finance record what they send back", async () => {
    const { property, room } = await hotel("STRICT");
    const guest = await makeUser();
    const b = await request(guest, property.id, room.id, 10, 2);
    const payment = await confirmAndPay(guest, b.id);

    // Strict, 10 days ahead: nothing back.
    const res = await cancelStayByGuest(guest, b.reference, { reason: "Flight moved" });
    expect(res.refundDue).toBe("Le 0");
    expect((await db.stayBooking.findUniqueOrThrow({ where: { id: b.id } })).refundDueMinor).toBe(0n);

    // Moderate, 10 days ahead: everything back, sent in two parts.
    const m = await hotel("MODERATE");
    const b2 = await request(guest, m.property.id, m.room.id, 10, 2);
    const p2 = await confirmAndPay(guest, b2.id);
    expect((await cancelStayByGuest(guest, b2.reference, {})).refundDue).toBe("Le 1,000");
    await expect(recordStayRefund(moderator, b2.id, { amount: "400", externalReference: "OMREF001" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await recordStayRefund(finance, b2.id, { amount: "400", externalReference: "OMREF001" });
    expect((await db.paymentTransaction.findUniqueOrThrow({ where: { id: p2.id } })).status).toBe("RECORDED");
    await expect(recordStayRefund(finance, b2.id, { amount: "700", externalReference: "OMREF002" })).rejects.toMatchObject({ code: "VALIDATION" });
    await recordStayRefund(finance, b2.id, { amount: "600", externalReference: "OMREF002" });
    expect((await db.paymentTransaction.findUniqueOrThrow({ where: { id: p2.id } })).status).toBe("REFUNDED");
    expect((await db.stayBooking.findUniqueOrThrow({ where: { id: b2.id } })).refundedMinor).toBe(100_000n);
    expect(payment.amount.amountMinor).toBe("100000");
  });

  it("refunds everything when staff cancel because the property let the guest down", async () => {
    const { property, room } = await hotel("NON_REFUNDABLE");
    const guest = await makeUser();
    const b = await request(guest, property.id, room.id, 9, 1);
    await confirmAndPay(guest, b.id);
    await cancelStayByStaff(moderator, b.id, { reason: "The hotel lost power for the week", refund: "FULL" });
    expect((await db.stayBooking.findUniqueOrThrow({ where: { id: b.id } })).refundDueMinor).toBe(50_000n);
    const due = await db.notification.findFirstOrThrow({ where: { userId: finance.id, type: "stay.refund_due" }, orderBy: { createdAt: "desc" } });
    expect(due.title).toContain(b.reference);
  });
});
