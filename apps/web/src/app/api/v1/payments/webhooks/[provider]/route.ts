import type { PaymentMethod } from "@sukkot/shared";
import { handler } from "@/server/http";
import { AppError } from "@/server/errors";
import { LIMITS } from "@/server/rate-limit";
import { handleWebhook } from "@/server/payments";

const PROVIDERS: Record<string, PaymentMethod> = { orange_money: "ORANGE_MONEY", afrimoney: "AFRIMONEY", sandbox: "SANDBOX" };

/** Provider callbacks. Authenticated by signature/token inside handleWebhook, not by cookies. */
export const POST = handler<{ provider: string }>(
  async (ctx) => {
    const method = PROVIDERS[ctx.params.provider];
    if (!method) throw new AppError("NOT_FOUND", "Unknown provider");
    await ctx.limit(`webhook:${method}`, LIMITS.webhook);
    const rawBody = await ctx.req.text();
    if (rawBody.length > 64_000) throw new AppError("BAD_REQUEST", "Payload too large");
    return handleWebhook(method, { headers: ctx.req.headers, rawBody, url: ctx.req.url });
  },
  { csrf: false },
);
