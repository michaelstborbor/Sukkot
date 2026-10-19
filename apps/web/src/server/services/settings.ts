import "server-only";
import type { Currency } from "@sukkot/shared";
import type { Prisma } from "@prisma/client";
import { db } from "../db";

/** Typed platform settings stored in `system_settings` and editable by administrators. */
export interface SettingTypes {
  "site.announcement": { text: string; link?: string; enabled: boolean };
  "promotion.featured7d": { priceMinor: string; currency: Currency } | null;
  /** Price of a visit by Sukkot Salone staff that earns the "Inspected by Sukkot" badge. Null: not on sale. */
  "visit.inspection": { priceMinor: string; currency: Currency } | null;
  /** Price of one extra listing slot on top of the plan's allowance. Null: not on sale. */
  "listing.extraSlot": { priceMinor: string; currency: Currency } | null;
  "listing.autoExpireDays": number;
  "inspection.maxPerDay": number;
  /** Sukkot Salone's own wallet numbers and bank account, shown to customers who pay by transfer. */
  "billing.manual": ManualBillingSettings;
  /** Online mobile money checkout. Secret fields are stored encrypted (see `encryptSecret`). */
  "payments.mobileMoney": MobileMoneySettings;
  /** Background photo of the homepage hero, stored at several widths. Null: the bundled default photo. */
  "site.heroImage": HeroImageSettings | null;
}

export interface HeroImageSettings {
  baseKey: string;
  width: number;
  height: number;
  widths: number[];
  placeholder: string;
  alt: string;
}

export interface MobileMoneySettings {
  orangeMoney: { enabled: boolean; apiBase: string; country: string; clientId: string; clientSecret: string; merchantKey: string };
  afrimoney: { enabled: boolean; apiBase: string; merchantId: string; apiKey: string; webhookSecret: string };
}

export interface ManualBillingSettings {
  enabled: boolean;
  accountName: string;
  orangeMoneyNumber: string;
  afrimoneyNumber: string;
  bankDetails: string;
}

export const SETTING_DEFAULTS: SettingTypes = {
  "site.announcement": {
    text: "Never pay for a property before inspecting it and checking the documents.",
    link: "/safety",
    enabled: true,
  },
  "promotion.featured7d": null,
  "visit.inspection": null,
  "listing.extraSlot": null,
  "listing.autoExpireDays": 90,
  "inspection.maxPerDay": 8,
  "billing.manual": { enabled: false, accountName: "", orangeMoneyNumber: "", afrimoneyNumber: "", bankDetails: "" },
  "site.heroImage": null,
  "payments.mobileMoney": {
    orangeMoney: { enabled: false, apiBase: "", country: "", clientId: "", clientSecret: "", merchantKey: "" },
    afrimoney: { enabled: false, apiBase: "", merchantId: "", apiKey: "", webhookSecret: "" },
  },
};

export async function getSetting<K extends keyof SettingTypes>(key: K): Promise<SettingTypes[K]> {
  const row = await db.systemSetting.findUnique({ where: { key } });
  return (row?.value as SettingTypes[K] | undefined) ?? SETTING_DEFAULTS[key];
}

export async function setSetting<K extends keyof SettingTypes>(key: K, value: SettingTypes[K]) {
  const json = value as unknown as Prisma.InputJsonValue;
  await db.systemSetting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
}
