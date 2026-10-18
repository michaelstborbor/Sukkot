import type { Metadata } from "next";
import { minorToMajorString } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { getSetting } from "@/server/services/settings";
import { PageHeader } from "@/components/dashboard/shell";
import { JsonForm } from "@/components/dashboard/json-form";
import { Notice } from "@/components/ui/misc";
import { env } from "@/server/env";
import { clearMobileMoneyConfig, loadMobileMoneyConfig, type CredentialSource } from "@/server/payments/config";

/** Placeholder for a saved key: the key itself is never sent back to the browser. */
const savedKey = (stored: string) => (stored ? "Saved. Leave empty to keep it" : "");

function ProviderStatus({ name, enabled, ready, source, unreadable }: { name: string; enabled: boolean; ready: boolean; source: CredentialSource; unreadable: boolean }) {
  if (unreadable) return <Notice tone="danger">A saved {name} key can no longer be read, probably because APP_SECRET changed. Enter the keys again.</Notice>;
  if (source === "environment")
    return <Notice tone="info">{name} keys are set on the server (environment variables), which take precedence over the fields below. {enabled && ready ? "It is offered at checkout." : "It is not offered at checkout yet."}</Notice>;
  if (enabled && ready) return <Notice tone="success">{name} is offered at checkout.</Notice>;
  return <Notice tone="warning">{name} is not offered at checkout. {ready ? "Tick the box below to switch it on." : "Enter the merchant details from your provider, then switch it on."}</Notice>;
}

export const metadata: Metadata = { title: "Site settings" };

export default async function AdminSettingsPage() {
  await requirePagePermission("admin:settings.manage", "/admin/settings");
  clearMobileMoneyConfig();
  const [announcement, promo, visit, slot, manual, mobileMoney, mm] = await Promise.all([
    getSetting("site.announcement"),
    getSetting("promotion.featured7d"),
    getSetting("visit.inspection"),
    getSetting("listing.extraSlot"),
    getSetting("billing.manual"),
    getSetting("payments.mobileMoney"),
    loadMobileMoneyConfig(),
  ]);
  const om = mobileMoney.orangeMoney;
  const am = mobileMoney.afrimoney;
  const omReady = !!(mm.orangeMoney.clientId && mm.orangeMoney.clientSecret && mm.orangeMoney.merchantKey);
  const amReady = !!(mm.afrimoney.base && mm.afrimoney.merchantId && mm.afrimoney.apiKey && mm.afrimoney.webhookSecret);
  const prices = [
    { key: "promotionPrice", title: "Featured listing price (7 days)", hint: "Leave the amount empty to stop selling promotions.", value: promo },
    { key: "visitPrice", title: "Inspection visit price", hint: "What a lister pays for staff to visit, check and photograph a property, earning the dated \u201cInspected by Sukkot\u201d badge. Leave empty to stop selling visits.", value: visit },
    { key: "slotPrice", title: "Extra listing slot price", hint: "A one-off payment for one more active listing on top of the plan's allowance. The slot never expires. Leave empty to stop selling slots.", value: slot },
  ];
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Site settings" />
      <section className="card p-5">
        <h2 className="mb-3 font-bold text-navy-900">Announcement bar</h2>
        <JsonForm
          path="/admin/settings"
          fields={[
            { name: "announcement.text", label: "Text", defaultValue: announcement.text, wide: true },
            { name: "announcement.link", label: "Link", optional: true, defaultValue: announcement.link ?? "", placeholder: "/safety" },
            { name: "announcement.enabled", label: "Show the announcement bar", type: "checkbox", defaultValue: announcement.enabled, wide: true },
          ]}
        />
      </section>
      {prices.map((p) => (
        <section key={p.key} className="card p-5">
          <h2 className="mb-1 font-bold text-navy-900">{p.title}</h2>
          <p className="mb-3 text-sm text-muted">{p.hint}</p>
          <JsonForm
            path="/admin/settings"
            fields={[
              { name: `${p.key}.amount`, label: "Amount", optional: true, defaultValue: p.value ? minorToMajorString(p.value.priceMinor, p.value.currency) : "" },
              { name: `${p.key}.currency`, label: "Currency", type: "select", defaultValue: p.value?.currency ?? "SLE", options: [{ value: "SLE", label: "SLE" }, { value: "USD", label: "USD" }] },
            ]}
          />
        </section>
      ))}
      <section className="card p-5">
        <h2 className="mb-1 font-bold text-navy-900">Pay by transfer</h2>
        <p className="mb-3 text-sm text-muted">
          Lets customers pay for plans and featured listings by sending money to Sukkot Salone&apos;s own wallet or bank account. They enter the transaction ID, and nothing starts until finance confirms it under Payments → Transfers to check. Use business accounts only, never a personal number.
        </p>
        <JsonForm
          path="/admin/settings"
          fields={[
            { name: "billingManual.enabled", label: "Offer pay by transfer at checkout", type: "checkbox", defaultValue: manual.enabled, wide: true },
            { name: "billingManual.accountName", label: "Account name customers see", optional: true, defaultValue: manual.accountName, placeholder: "Sukkot Salone Ltd", wide: true },
            { name: "billingManual.orangeMoneyNumber", label: "Orange Money merchant or business number", optional: true, defaultValue: manual.orangeMoneyNumber },
            { name: "billingManual.afrimoneyNumber", label: "Afrimoney merchant or business number", optional: true, defaultValue: manual.afrimoneyNumber },
            { name: "billingManual.bankDetails", label: "Bank details", type: "textarea", optional: true, defaultValue: manual.bankDetails, placeholder: "Bank, branch, account number" },
          ]}
        />
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="font-bold text-navy-900">Orange Money checkout</h2>
        <p className="text-sm text-muted">
          Customers approve the payment on Orange&apos;s own page or by USSD, and it counts as paid only once Orange confirms it. Use the merchant details Orange Sierra Leone gives you when you sign up for the Orange Money Web Payment API. Keys are stored encrypted and never shown again.
        </p>
        <ProviderStatus name="Orange Money" enabled={mm.orangeMoney.enabled} ready={omReady} source={mm.orangeMoney.source} unreadable={mm.orangeMoney.unreadable} />
        <p className="text-sm text-muted">
          Payment notification URL to give Orange: <code className="break-all">{env.appUrl}/api/v1/payments/webhooks/orange_money</code>
        </p>
        <JsonForm
          path="/admin/settings"
          fields={[
            { name: "orangeMoney.enabled", label: "Offer Orange Money at checkout", type: "checkbox", defaultValue: om.enabled, wide: true },
            { name: "orangeMoney.clientId", label: "Client ID", optional: true, defaultValue: om.clientId },
            { name: "orangeMoney.clientSecret", label: "Client secret", type: "password", optional: true, placeholder: savedKey(om.clientSecret) },
            { name: "orangeMoney.merchantKey", label: "Merchant key", type: "password", optional: true, placeholder: savedKey(om.merchantKey) },
            { name: "orangeMoney.country", label: "Country code", optional: true, defaultValue: om.country, placeholder: "sl" },
            { name: "orangeMoney.apiBase", label: "API address", type: "url", optional: true, defaultValue: om.apiBase, placeholder: "https://api.orange.com", wide: true },
          ]}
        />
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="font-bold text-navy-900">Afrimoney checkout</h2>
        <p className="text-sm text-muted">
          Customers get a prompt on their phone to approve the payment, and it counts as paid only once Africell confirms it. Use the merchant API details Africell gives you. Keys are stored encrypted and never shown again.
        </p>
        <ProviderStatus name="Afrimoney" enabled={mm.afrimoney.enabled} ready={amReady} source={mm.afrimoney.source} unreadable={mm.afrimoney.unreadable} />
        <p className="text-sm text-muted">
          Callback URL to give Africell: <code className="break-all">{env.appUrl}/api/v1/payments/webhooks/afrimoney</code>
        </p>
        <JsonForm
          path="/admin/settings"
          fields={[
            { name: "afrimoney.enabled", label: "Offer Afrimoney at checkout", type: "checkbox", defaultValue: am.enabled, wide: true },
            { name: "afrimoney.merchantId", label: "Merchant ID", optional: true, defaultValue: am.merchantId },
            { name: "afrimoney.apiKey", label: "API key", type: "password", optional: true, placeholder: savedKey(am.apiKey) },
            { name: "afrimoney.webhookSecret", label: "Callback signing secret", type: "password", optional: true, placeholder: savedKey(am.webhookSecret) },
            { name: "afrimoney.apiBase", label: "API address", type: "url", optional: true, defaultValue: am.apiBase, placeholder: "From Africell's API pack" },
          ]}
        />
      </section>
    </div>
  );
}
