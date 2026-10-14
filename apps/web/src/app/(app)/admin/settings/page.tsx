import type { Metadata } from "next";
import { minorToMajorString } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { getSetting } from "@/server/services/settings";
import { PageHeader } from "@/components/dashboard/shell";
import { JsonForm } from "@/components/dashboard/json-form";

export const metadata: Metadata = { title: "Site settings" };

export default async function AdminSettingsPage() {
  await requirePagePermission("admin:settings.manage", "/admin/settings");
  const [announcement, promo] = await Promise.all([getSetting("site.announcement"), getSetting("promotion.featured7d")]);
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
      <section className="card p-5">
        <h2 className="mb-1 font-bold text-navy-900">Featured listing price (7 days)</h2>
        <p className="mb-3 text-sm text-muted">Leave the amount empty to stop selling promotions.</p>
        <JsonForm
          path="/admin/settings"
          fields={[
            { name: "promotionPrice.amount", label: "Amount", optional: true, defaultValue: promo ? minorToMajorString(promo.priceMinor, promo.currency) : "" },
            { name: "promotionPrice.currency", label: "Currency", type: "select", defaultValue: promo?.currency ?? "SLE", options: [{ value: "SLE", label: "SLE" }, { value: "USD", label: "USD" }] },
          ]}
        />
      </section>
    </div>
  );
}
