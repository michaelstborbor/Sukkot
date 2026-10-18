import type { Metadata } from "next";
import { minorToMajorString } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { getSetting } from "@/server/services/settings";
import { PageHeader } from "@/components/dashboard/shell";
import { JsonForm } from "@/components/dashboard/json-form";

export const metadata: Metadata = { title: "Site settings" };

export default async function AdminSettingsPage() {
  await requirePagePermission("admin:settings.manage", "/admin/settings");
  const [announcement, promo, visit, slot, manual] = await Promise.all([
    getSetting("site.announcement"),
    getSetting("promotion.featured7d"),
    getSetting("visit.inspection"),
    getSetting("listing.extraSlot"),
    getSetting("billing.manual"),
  ]);
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
    </div>
  );
}
