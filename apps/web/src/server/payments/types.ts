import type { Currency, PaymentMethod } from "@sukkot/shared";

export interface ProviderCharge {
  reference: string;
  amountMinor: bigint;
  currency: Currency;
  payerPhone: string | null;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

export type ProviderStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";

export interface InitiateResult {
  providerReference: string | null;
  status: "PENDING" | "FAILED";
  nextAction: { type: "REDIRECT"; url: string } | { type: "USSD_PROMPT"; message: string } | null;
  /** Secrets needed later to verify callbacks; stored server-side only. */
  providerData?: Record<string, unknown>;
  raw?: unknown;
}

export interface WebhookResult {
  /** Our reference or the provider's, whichever the callback carries. */
  reference?: string;
  providerReference?: string;
  /** Unique id of this callback delivery, used to drop duplicates. */
  eventId: string;
  status: ProviderStatus;
  amountMinor?: bigint;
  currency?: string;
  raw: unknown;
}

export interface StoredTransaction {
  reference: string;
  providerReference: string | null;
  amountMinor: bigint;
  currency: Currency;
  providerData: Record<string, unknown> | null;
}

export class WebhookSignatureError extends Error {}

export interface PaymentProvider {
  method: PaymentMethod;
  isConfigured(): boolean;
  initiate(charge: ProviderCharge): Promise<InitiateResult>;
  /**
   * Authenticate and parse a callback. Must throw WebhookSignatureError when the request
   * cannot be authenticated. `lookup` lets a provider fetch stored tokens to compare against.
   */
  parseWebhook(
    req: { headers: Headers; rawBody: string; url: string },
    lookup: (ref: { reference?: string; providerReference?: string }) => Promise<StoredTransaction | null>,
  ): Promise<WebhookResult>;
  /** Ask the provider directly for the authoritative status. */
  queryStatus?(tx: StoredTransaction): Promise<ProviderStatus>;
}
