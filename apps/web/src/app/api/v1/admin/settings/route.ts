import { z } from "zod";
import { parseMajorToMinor } from "@sukkot/shared";
import { handler } from "@/server/http";
import { assertPermission } from "@/server/auth/actor";
import { audit } from "@/server/audit";
import { setSetting } from "@/server/services/settings";

const schema = z.object({
  announcement: z.object({ text: z.string().trim().max(200), link: z.string().max(200).optional(), enabled: z.boolean() }).optional(),
  promotionPrice: z.object({ amount: z.string().max(20), currency: z.enum(["SLE", "USD"]) }).nullable().optional(),
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
});

export const POST = handler(async (ctx) => {
  const actor = assertPermission(ctx.actor, "admin:settings.manage");
  const input = await ctx.body(schema);
  if (input.announcement) await setSetting("site.announcement", input.announcement);
  if (input.promotionPrice !== undefined) {
    const minor = input.promotionPrice ? parseMajorToMinor(input.promotionPrice.amount, input.promotionPrice.currency) : null;
    await setSetting("promotion.featured7d", minor ? { priceMinor: minor.toString(), currency: input.promotionPrice!.currency } : null);
  }
  if (input.billingManual) await setSetting("billing.manual", input.billingManual);
  await audit({ actorId: actor.id, action: "settings.update", metadata: JSON.parse(JSON.stringify(input)), ipHash: ctx.ipHash });
  return { ok: true };
});
