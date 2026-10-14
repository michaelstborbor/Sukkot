import { z } from "zod";
import { randomUUID } from "node:crypto";
import { handler } from "@/server/http";
import { AppError, forbidden } from "@/server/errors";
import { getPaymentByReference, handleWebhook } from "@/server/payments";
import { sandboxProvider, signSandboxPayload } from "@/server/payments/providers/sandbox";

/**
 * Test-only: simulates the payer approving or declining in the sandbox gateway. The result still
 * goes through the signed-webhook path, exactly like a real provider callback.
 */
export const POST = handler<{ reference: string }>(async (ctx) => {
  if (!sandboxProvider.isConfigured()) throw new AppError("NOT_FOUND", "Not available");
  const { outcome } = await ctx.body(z.object({ outcome: z.enum(["SUCCEEDED", "FAILED"]) }));
  const payment = await getPaymentByReference(ctx.actor, ctx.params.reference);
  if (payment.method !== "SANDBOX") throw forbidden();
  const body = JSON.stringify({ eventId: randomUUID(), providerReference: payment.providerReference, status: outcome, amountMinor: payment.amountMinor.toString(), currency: payment.currency });
  const headers = new Headers({ "x-sandbox-signature": signSandboxPayload(body) });
  return handleWebhook("SANDBOX", { headers, rawBody: body, url: ctx.req.url });
});
