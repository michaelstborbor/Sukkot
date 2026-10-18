import "server-only";
import { decryptSecret } from "../crypto";
import { env } from "../env";
import { getSetting } from "../services/settings";

/**
 * Where each mobile money provider's credentials come from. Settings on the server (environment
 * variables) win over what an administrator typed into Admin → Site settings, so a deployment can
 * keep keys out of the database entirely.
 */
export type CredentialSource = "environment" | "settings" | "none";

export interface MobileMoneyConfig {
  orangeMoney: { enabled: boolean; source: CredentialSource; base: string; country: string; clientId: string; clientSecret: string; merchantKey: string; unreadable: boolean };
  afrimoney: { enabled: boolean; source: CredentialSource; base: string; merchantId: string; apiKey: string; webhookSecret: string; unreadable: boolean };
}

const e = (name: string) => process.env[name]?.trim() || "";

/** A stored secret: empty when none was saved, null when it was saved but cannot be read. */
function secret(stored: string): string | null {
  return stored ? decryptSecret(stored) : "";
}

async function resolve(): Promise<MobileMoneyConfig> {
  const saved = await getSetting("payments.mobileMoney");
  const enabledByEnv = (m: string) => env.paymentMethodsEnabled.includes(m);

  const om = saved.orangeMoney;
  const omSecret = secret(om.clientSecret);
  const omKey = secret(om.merchantKey);
  const omEnv = !!e("ORANGE_MONEY_CLIENT_ID");
  const orangeMoney: MobileMoneyConfig["orangeMoney"] = omEnv
    ? { enabled: enabledByEnv("ORANGE_MONEY") || om.enabled, source: "environment", base: e("ORANGE_MONEY_API_BASE") || "https://api.orange.com", country: e("ORANGE_MONEY_COUNTRY") || "sl", clientId: e("ORANGE_MONEY_CLIENT_ID"), clientSecret: e("ORANGE_MONEY_CLIENT_SECRET"), merchantKey: e("ORANGE_MONEY_MERCHANT_KEY"), unreadable: false }
    : { enabled: enabledByEnv("ORANGE_MONEY") || om.enabled, source: om.clientId ? "settings" : "none", base: om.apiBase || "https://api.orange.com", country: om.country || "sl", clientId: om.clientId, clientSecret: omSecret ?? "", merchantKey: omKey ?? "", unreadable: omSecret === null || omKey === null };

  const am = saved.afrimoney;
  const amKey = secret(am.apiKey);
  const amHook = secret(am.webhookSecret);
  const amEnv = !!e("AFRIMONEY_MERCHANT_ID");
  const afrimoney: MobileMoneyConfig["afrimoney"] = amEnv
    ? { enabled: enabledByEnv("AFRIMONEY") || am.enabled, source: "environment", base: e("AFRIMONEY_API_BASE"), merchantId: e("AFRIMONEY_MERCHANT_ID"), apiKey: e("AFRIMONEY_API_KEY"), webhookSecret: e("AFRIMONEY_WEBHOOK_SECRET"), unreadable: false }
    : { enabled: enabledByEnv("AFRIMONEY") || am.enabled, source: am.merchantId ? "settings" : "none", base: am.apiBase, merchantId: am.merchantId, apiKey: amKey ?? "", webhookSecret: amHook ?? "", unreadable: amKey === null || amHook === null };

  for (const c of [orangeMoney, afrimoney]) c.base = c.base.replace(/\/$/, "");
  return { orangeMoney, afrimoney };
}

const TTL_MS = 30_000;
let cache: { at: number; value: MobileMoneyConfig } | null = null;

/** Read the current credentials (cached briefly). Call before using a mobile money provider. */
export async function loadMobileMoneyConfig(): Promise<MobileMoneyConfig> {
  if (!cache || Date.now() - cache.at > TTL_MS) cache = { at: Date.now(), value: await resolve() };
  return cache.value;
}

/** The credentials last loaded by `loadMobileMoneyConfig`, for the providers' synchronous checks. */
export function mobileMoneyConfig(): MobileMoneyConfig | null {
  return cache?.value ?? null;
}

/** Forget the cached credentials, so a change saved in Site settings applies at once. */
export function clearMobileMoneyConfig() {
  cache = null;
}
