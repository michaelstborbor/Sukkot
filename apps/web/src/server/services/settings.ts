import "server-only";
import type { Currency } from "@sukkot/shared";
import type { Prisma } from "@prisma/client";
import { db } from "../db";

/** Typed platform settings stored in `system_settings` and editable by administrators. */
export interface SettingTypes {
  "site.announcement": { text: string; link?: string; enabled: boolean };
  "promotion.featured7d": { priceMinor: string; currency: Currency } | null;
  "listing.autoExpireDays": number;
  "inspection.maxPerDay": number;
  /** Sukkot Salone's own wallet numbers and bank account, shown to customers who pay by transfer. */
  "billing.manual": ManualBillingSettings;
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
  "listing.autoExpireDays": 90,
  "inspection.maxPerDay": 8,
  "billing.manual": { enabled: false, accountName: "", orangeMoneyNumber: "", afrimoneyNumber: "", bankDetails: "" },
};

export async function getSetting<K extends keyof SettingTypes>(key: K): Promise<SettingTypes[K]> {
  const row = await db.systemSetting.findUnique({ where: { key } });
  return (row?.value as SettingTypes[K] | undefined) ?? SETTING_DEFAULTS[key];
}

export async function setSetting<K extends keyof SettingTypes>(key: K, value: SettingTypes[K]) {
  const json = value as unknown as Prisma.InputJsonValue;
  await db.systemSetting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
}
