import "server-only";
import { createHmac } from "node:crypto";
import { minorToMajorString } from "@sukkot/shared";
import { safeEqual } from "../../crypto";
import { WebhookSignatureError, type PaymentProvider, type ProviderStatus } from "../types";

/**
 * Africell Afrimoney merchant collection.
 *
 * Africell does not publish a public merchant API; the request/response field names below follow
 * the common "collect → callback → status query" pattern and are isolated in this file so they can
 * be aligned with the API pack Africell issues during merchant onboarding. Until AFRIMONEY_* settings
 * are present the method stays disabled and is never offered at checkout.
 *
 * Security: callbacks must carry an HMAC-SHA256 signature of the raw body (header
 * `x-afrimoney-signature`), and success is re-confirmed with a status query before fulfilment.
 */
const cfg = () => ({
  base: (process.env.AFRIMONEY_API_BASE || "").replace(/\/$/, ""),
  merchantId: process.env.AFRIMONEY_MERCHANT_ID || "",
  apiKey: process.env.AFRIMONEY_API_KEY || "",
  webhookSecret: process.env.AFRIMONEY_WEBHOOK_SECRET || "",
});

function mapStatus(s: string | undefined): ProviderStatus {
  switch ((s ?? "").toUpperCase()) {
    case "SUCCESS":
    case "SUCCESSFUL":
    case "COMPLETED":
      return "SUCCEEDED";
    case "FAILED":
    case "DECLINED":
      return "FAILED";
    case "CANCELLED":
      return "CANCELLED";
    case "EXPIRED":
    case "TIMEOUT":
      return "EXPIRED";
    default:
      return "PENDING";
  }
}

export const afrimoneyProvider: PaymentProvider = {
  method: "AFRIMONEY",
  isConfigured() {
    const c = cfg();
    return !!(c.base && c.merchantId && c.apiKey && c.webhookSecret);
  },
  async initiate(charge) {
    const c = cfg();
    if (!charge.payerPhone) {
      return { providerReference: null, status: "FAILED", nextAction: null, raw: { message: "Payer phone number is required" } };
    }
    const res = await fetch(`${c.base}/merchant/collections`, {
      method: "POST",
      headers: { "x-api-key": c.apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        merchantId: c.merchantId,
        reference: charge.reference,
        amount: minorToMajorString(charge.amountMinor, charge.currency),
        currency: charge.currency,
        msisdn: charge.payerPhone.replace("+", ""),
        description: charge.description.slice(0, 60),
        callbackUrl: charge.notifyUrl,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => ({}))) as { transactionId?: string; status?: string; message?: string };
    if (!res.ok || !body.transactionId) {
      return { providerReference: null, status: "FAILED", nextAction: null, raw: { status: res.status, message: body.message } };
    }
    return {
      providerReference: body.transactionId,
      status: "PENDING",
      nextAction: { type: "USSD_PROMPT", message: "Check your phone and approve the Afrimoney payment prompt with your PIN." },
      raw: { status: res.status },
    };
  },
  async parseWebhook(req) {
    const c = cfg();
    const sig = req.headers.get("x-afrimoney-signature") ?? "";
    const expected = createHmac("sha256", c.webhookSecret).update(req.rawBody).digest("hex");
    if (!c.webhookSecret || !sig || !safeEqual(expected, sig)) throw new WebhookSignatureError("Invalid Afrimoney signature");
    const body = JSON.parse(req.rawBody) as { eventId?: string; transactionId: string; reference?: string; status: string; amount?: string; currency?: string };
    return {
      reference: body.reference,
      providerReference: body.transactionId,
      eventId: `am:${body.eventId ?? body.transactionId}:${body.status}`,
      status: mapStatus(body.status),
      currency: body.currency,
      raw: body,
    };
  },
  async queryStatus(tx) {
    const c = cfg();
    if (!tx.providerReference) return "PENDING";
    const res = await fetch(`${c.base}/merchant/collections/${encodeURIComponent(tx.providerReference)}`, {
      headers: { "x-api-key": c.apiKey, accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return "PENDING";
    const body = (await res.json()) as { status?: string };
    return mapStatus(body.status);
  },
};
