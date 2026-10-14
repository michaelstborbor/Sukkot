import type { Metadata } from "next";
import { PROPERTY_CATEGORY_LABELS } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { db } from "@/server/db";
import { PageHeader } from "@/components/dashboard/shell";
import { JsonForm } from "@/components/dashboard/json-form";
import { Badge } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Types and amenities" };

export default async function AdminCatalogPage() {
  await requirePagePermission("admin:catalog.manage", "/admin/catalog");
  const [types, amenities] = await Promise.all([
    db.propertyType.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { properties: true } } } }),
    db.amenity.findMany({ orderBy: [{ group: "asc" }, { name: "asc" }] }),
  ]);
  const groups = [...new Set(amenities.map((a) => a.group))];
  return (
    <>
      <PageHeader title="Property types and amenities" />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-navy-900">Property types</h2>
          <ul className="divide-y divide-line text-sm">
            {types.map((t) => (
              <li key={t.id} className="flex justify-between py-2">
                <span>{t.name} <span className="text-muted">· {PROPERTY_CATEGORY_LABELS[t.category]}</span></span>
                <span className="text-muted">{t._count.properties} listings</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Property types drive form validation, so they are changed through a database migration rather than here.</p>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-navy-900">Amenities</h2>
          <JsonForm
            path="/admin/amenities"
            reset
            submitLabel="Add or update amenity"
            success="Amenity saved"
            fields={[
              { name: "name", label: "Name" },
              { name: "group", label: "Group", type: "select", defaultValue: groups[0] ?? "General", options: groups.map((g) => ({ value: g, label: g })) },
            ]}
          />
          <div className="mt-4 space-y-3">
            {groups.map((g) => (
              <div key={g}>
                <p className="mb-1 text-xs font-bold tracking-wide text-muted uppercase">{g}</p>
                <div className="flex flex-wrap gap-1">
                  {amenities.filter((a) => a.group === g).map((a) => <Badge key={a.id} tone={a.isActive ? "neutral" : "warning"}>{a.name}</Badge>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
