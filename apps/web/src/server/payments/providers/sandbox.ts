import "server-only";
import { createHmac } from "node:crypto";
import { safeEqual } from "../../crypto";
import { env } from "../../env";
import { WebhookSignatureError, type PaymentProvider } from "../types";

/**
 * Development-only provider that behaves like a mobile money gateway: it redirects the payer to a
 * test page and confirms through a signed callback, so the full verification path is exercised.
 */
const secret = () => process.env.SANDBOX_WEBHOOK_SECRET || "dev-sandbox-secret";

export function signSandboxPayload(body: string) {
  return createHmac("sha256", secret()).update(body).digest("hex");
}

export const sandboxProvider: PaymentProvider = {
  method: "SANDBOX",
  isConfigured() {
    return !env.isProd || process.env.ALLOW_SANDBOX_IN_PRODUCTION === "true";
  },
  async initiate(charge) {
    return {
      providerReference: `SBX-${charge.reference}`,
      status: "PENDING",
      nextAction: { type: "REDIRECT", url: `/payments/sandbox/${charge.reference}` },
    };
  },
  async parseWebhook(req) {
    const sig = req.headers.get("x-sandbox-signature") ?? "";
    if (!sig || !safeEqual(signSandboxPayload(req.rawBody), sig)) throw new WebhookSignatureError("Invalid sandbox signature");
    const body = JSON.parse(req.rawBody) as { eventId: string; providerReference: string; status: "SUCCEEDED" | "FAILED"; amountMinor: string; currency: string };
    return {
      eventId: body.eventId,
      providerReference: body.providerReference,
      status: body.status,
      amountMinor: BigInt(body.amountMinor),
      currency: body.currency,
      raw: body,
    };
  },
};
