import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { parseMajorToMinor } from "@sukkot/shared";
import { handler } from "@/server/http";
import { AppError } from "@/server/errors";
import { assertPermission } from "@/server/auth/actor";
import { audit } from "@/server/audit";
import { encryptSecret } from "@/server/crypto";
import { clearMobileMoneyConfig, loadMobileMoneyConfig } from "@/server/payments/config";
import { getSetting, setSetting, type MobileMoneySettings } from "@/server/services/settings";

const price = z.object({ amount: z.string().max(20), currency: z.enum(["SLE", "USD"]) }).nullable().optional();

/** An empty amount switches the item off (not on sale). */
function toPrice(input: z.infer<typeof price>) {
  const minor = input ? parseMajorToMinor(input.amount, input.currency) : null;
  return minor ? { priceMinor: minor.toString(), currency: input!.currency } : null;
}

const schema = z.object({
  announcement: z.object({ text: z.string().trim().max(200), link: z.string().max(200).optional(), enabled: z.boolean() }).optional(),
  promotionPrice: price,
  visitPrice: price,
  photoShootPrice: price,
  slotPrice: price,
  billingManual: z
    .object({
      enabled: z.boolean(),
      accountName: z.string().trim().max(120),
      orangeMoneyNumber: z.string().trim().max(30),
      afrimoneyNumber: z.string().trim().max(30),
      bankDetails: z.string().trim().max(500),
    })
    .refine((v) => !v.enabled || v.accountName.length >= 2, { message: "Enter the account name customers will see", path: ["accountName"] })
    .refine((v) => !v.enabled || v.orangeMoneyNumber || v.afrimoneyNumber || v.bankDetails, { message: "Add at least one way to pay", path: ["orangeMoneyNumber"] })
    .optional(),
  // Secret fields left empty keep the key already saved; saved keys are never sent back to the browser.
  orangeMoney: z
    .object({
      enabled: z.boolean(),
      apiBase: z.union([z.literal(""), z.string().trim().url().max(200)]),
      country: z.string().trim().max(10),
      clientId: z.string().trim().max(200),
      clientSecret: z.string().trim().max(500),
      merchantKey: z.string().trim().max(500),
    })
    .optional(),
  afrimoney: z
    .object({
      enabled: z.boolean(),
      apiBase: z.union([z.literal(""), z.string().trim().url().max(200)]),
      merchantId: z.string().trim().max(200),
      apiKey: z.string().trim().max(500),
      webhookSecret: z.string().trim().max(500),
    })
    .optional(),
});

/** Encrypt a newly typed key, or keep the one already saved when the field was left empty. */
const keep = (typed: string, saved: string) => (typed ? encryptSecret(typed) : saved);

export const POST = handler(async (ctx) => {
  const actor = assertPermission(ctx.actor, "admin:settings.manage");
  const input = await ctx.body(schema);
  if (input.announcement) await setSetting("site.announcement", input.announcement);
  if (input.promotionPrice !== undefined) await setSetting("promotion.featured7d", toPrice(input.promotionPrice));
  if (input.visitPrice !== undefined) await setSetting("visit.inspection", toPrice(input.visitPrice));
  if (input.photoShootPrice !== undefined) await setSetting("visit.photoShoot", toPrice(input.photoShootPrice));
  if (input.slotPrice !== undefined) await setSetting("listing.extraSlot", toPrice(input.slotPrice));
  if (input.billingManual) await setSetting("billing.manual", input.billingManual);
  if (input.orangeMoney || input.afrimoney) {
    const saved = await getSetting("payments.mobileMoney");
    const next: MobileMoneySettings = { ...saved };
    if (input.orangeMoney) {
      const o = input.orangeMoney;
      next.orangeMoney = { enabled: o.enabled, apiBase: o.apiBase, country: o.country, clientId: o.clientId, clientSecret: keep(o.clientSecret, saved.orangeMoney.clientSecret), merchantKey: keep(o.merchantKey, saved.orangeMoney.merchantKey) };
    }
    if (input.afrimoney) {
      const a = input.afrimoney;
      next.afrimoney = { enabled: a.enabled, apiBase: a.apiBase, merchantId: a.merchantId, apiKey: keep(a.apiKey, saved.afrimoney.apiKey), webhookSecret: keep(a.webhookSecret, saved.afrimoney.webhookSecret) };
    }
    await setSetting("payments.mobileMoney", next);
    clearMobileMoneyConfig();
    // Switching a method on without everything it needs would offer a checkout that cannot work.
    const cfg = await loadMobileMoneyConfig();
    const missing = (fields: Record<string, string>) => Object.keys(fields).filter((name) => !fields[name]);
    if (input.orangeMoney?.enabled && cfg.orangeMoney.source !== "environment") {
      const o = cfg.orangeMoney;
      const gaps = missing({ "orangeMoney.clientId": o.clientId, "orangeMoney.clientSecret": o.clientSecret, "orangeMoney.merchantKey": o.merchantKey });
      if (gaps.length) await failMissing("orangeMoney", next, gaps);
    }
    if (input.afrimoney?.enabled && cfg.afrimoney.source !== "environment") {
      const a = cfg.afrimoney;
      const gaps = missing({ "afrimoney.apiBase": a.base, "afrimoney.merchantId": a.merchantId, "afrimoney.apiKey": a.apiKey, "afrimoney.webhookSecret": a.webhookSecret });
      if (gaps.length) await failMissing("afrimoney", next, gaps);
    }
  }
  // Keys are never written to the audit log: only whether a new one was entered.
  const logged = JSON.parse(JSON.stringify(input)) as Record<string, Record<string, unknown> | undefined>;
  for (const [group, fields] of [["orangeMoney", ["clientSecret", "merchantKey"]], ["afrimoney", ["apiKey", "webhookSecret"]]] as const) {
    const g = logged[group];
    if (g) for (const f of fields) g[f] = g[f] ? "(new key entered)" : "(unchanged)";
  }
  await audit({ actorId: actor.id, action: "settings.update", metadata: logged as Prisma.InputJsonObject, ipHash: ctx.ipHash });
  return { ok: true };
});

/** Leave the method switched off, keep what was typed, and say which fields are missing. */
async function failMissing(group: "orangeMoney" | "afrimoney", next: MobileMoneySettings, fields: string[]): Promise<never> {
  await setSetting("payments.mobileMoney", { ...next, [group]: { ...next[group], enabled: false } });
  clearMobileMoneyConfig();
  throw new AppError("VALIDATION", "Fill in every field before switching this payment method on", Object.fromEntries(fields.map((f) => [f, "Required"])));
}
