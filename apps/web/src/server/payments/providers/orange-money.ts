import "server-only";
import { minorToMajorString } from "@sukkot/shared";
import { safeEqual } from "../../crypto";
import { WebhookSignatureError, type PaymentProvider, type ProviderStatus, type StoredTransaction } from "../types";

/**
 * Orange Money Sierra Leone via the Orange Developer "Orange Money Web Payment" API.
 *
 * Flow: OAuth client-credentials token → create a web payment (returns payment_url, pay_token,
 * notif_token) → payer approves on Orange's page or USSD → Orange POSTs {status, notif_token, txnid}
 * to our notif_url → we compare notif_token AND confirm with a transaction-status call before
 * marking the payment as paid.
 *
 * Requires merchant onboarding with Orange Sierra Leone. Endpoint paths, the country segment and
 * currency code must be confirmed against the credentials pack issued to the merchant.
 */
const cfg = () => ({
  base: (process.env.ORANGE_MONEY_API_BASE || "https://api.orange.com").replace(/\/$/, ""),
  clientId: process.env.ORANGE_MONEY_CLIENT_ID || "",
  clientSecret: process.env.ORANGE_MONEY_CLIENT_SECRET || "",
  merchantKey: process.env.ORANGE_MONEY_MERCHANT_KEY || "",
  country: process.env.ORANGE_MONEY_COUNTRY || "sl",
});

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const c = cfg();
  const res = await fetch(`${c.base}/oauth/v3/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Orange Money token request failed (${res.status})`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

function mapStatus(s: string | undefined): ProviderStatus {
  switch ((s ?? "").toUpperCase()) {
    case "SUCCESS":
      return "SUCCEEDED";
    case "FAILED":
      return "FAILED";
    case "EXPIRED":
      return "EXPIRED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

export const orangeMoneyProvider: PaymentProvider = {
  method: "ORANGE_MONEY",
  isConfigured() {
    const c = cfg();
    return !!(c.clientId && c.clientSecret && c.merchantKey);
  },
  async initiate(charge) {
    const c = cfg();
    const token = await accessToken();
    const res = await fetch(`${c.base}/orange-money-webpay/${c.country}/v1/webpayment`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        merchant_key: c.merchantKey,
        currency: charge.currency,
        order_id: charge.reference,
        // Orange's Web Payment API takes whole currency units.
        amount: Number(minorToMajorString(charge.amountMinor, charge.currency)),
        return_url: charge.returnUrl,
        cancel_url: charge.cancelUrl,
        notif_url: charge.notifyUrl,
        lang: "en",
        reference: charge.description.slice(0, 30),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => ({}))) as { payment_url?: string; pay_token?: string; notif_token?: string; message?: string };
    if (!res.ok || !body.payment_url || !body.pay_token) {
      return { providerReference: null, status: "FAILED", nextAction: null, raw: { status: res.status, message: body.message } };
    }
    return {
      providerReference: body.pay_token,
      status: "PENDING",
      nextAction: { type: "REDIRECT", url: body.payment_url },
      providerData: { payToken: body.pay_token, notifToken: body.notif_token },
      raw: { status: res.status },
    };
  },
  async parseWebhook(req, lookup) {
    let body: { status?: string; notif_token?: string; txnid?: string; order_id?: string };
    try {
      body = JSON.parse(req.rawBody);
    } catch {
      throw new WebhookSignatureError("Malformed body");
    }
    // The notification carries no order id in every variant; our notify URL embeds it as ?ref=.
    const reference = body.order_id ?? new URL(req.url, "http://localhost").searchParams.get("ref") ?? undefined;
    const stored = reference ? await lookup({ reference }) : null;
    const expected = (stored?.providerData?.notifToken as string | undefined) ?? "";
    if (!stored || !expected || !body.notif_token || !safeEqual(expected, body.notif_token)) {
      throw new WebhookSignatureError("notif_token mismatch");
    }
    return {
      reference: stored.reference,
      eventId: `om:${body.txnid ?? body.notif_token}:${body.status}`,
      status: mapStatus(body.status),
      raw: { status: body.status, txnid: body.txnid },
    };
  },
  async queryStatus(tx: StoredTransaction) {
    const c = cfg();
    const token = await accessToken();
    const res = await fetch(`${c.base}/orange-money-webpay/${c.country}/v1/transactionstatus`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        order_id: tx.reference,
        amount: Number(minorToMajorString(tx.amountMinor, tx.currency)),
        pay_token: tx.providerData?.payToken,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return "PENDING";
    const body = (await res.json()) as { status?: string };
    return mapStatus(body.status);
  },
};
