import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/actor";
import { db } from "@/server/db";
import { PageHeader } from "@/components/dashboard/shell";
import { JsonForm } from "@/components/dashboard/json-form";
import { ActionButton } from "@/components/dashboard/action-button";
import { Badge } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Locations" };

export default async function AdminLocationsPage() {
  await requirePagePermission("admin:locations.manage", "/admin/locations");
  const all = await db.location.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const children = (id: string | null) => all.filter((l) => l.parentId === id);
  const country = all.find((l) => l.level === "COUNTRY");
  const parents = all.filter((l) => l.level !== "LOCALITY");
  const levelLabel = (l: { level: string; isCity: boolean }) => (l.level === "CITY" ? (l.isCity ? "city" : "town") : l.level === "LOCALITY" ? "area" : l.level.toLowerCase());

  function Node({ id, depth }: { id: string; depth: number }) {
    const kids = children(id);
    if (!kids.length) return null;
    return (
      <ul className={depth ? "ml-4 border-l border-line pl-3" : ""}>
        {kids.map((l) => (
          <li key={l.id} className="py-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className={l.isActive ? "" : "text-muted line-through"}>
                {l.name} <span className="text-xs text-muted">{levelLabel(l)}</span>
                {!l.isActive && <Badge tone="warning" className="ml-1">hidden</Badge>}
              </span>
              <ActionButton path={`/admin/locations/${l.id}`} method="PATCH" body={{ isActive: !l.isActive }} label={l.isActive ? "Hide" : "Show"} variant="ghost" success="Updated" />
            </div>
            {l.level !== "LOCALITY" && <Node id={l.id} depth={depth + 1} />}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <PageHeader title="Locations" description="Provinces, districts, cities, towns and their areas or sections, used for listings and search." />
      <section className="card mb-6 p-5">
        <h2 className="mb-3 font-bold text-navy-900">Add a location</h2>
        <JsonForm
          path="/admin/locations"
          reset
          submitLabel="Add location"
          success="Location added"
          fields={[
            { name: "name", label: "Name" },
            { name: "level", label: "Type", type: "select", defaultValue: "LOCALITY", options: [{ value: "LOCALITY", label: "Area or section (inside a city or town)" }, { value: "TOWN", label: "Town" }, { value: "CITY", label: "City" }, { value: "DISTRICT", label: "District" }, { value: "PROVINCE", label: "Province or region" }] },
            { name: "parentId", label: "Inside", type: "select", defaultValue: parents.find((p) => p.level === "CITY")?.id ?? "", options: parents.map((p) => ({ value: p.id, label: `${p.name} (${levelLabel(p)})` })) },
            { name: "latitude", label: "Latitude", type: "number", optional: true },
            { name: "longitude", label: "Longitude", type: "number", optional: true },
          ]}
        />
      </section>
      <section className="card p-5">{country && <Node id={country.id} depth={0} />}</section>
    </>
  );
}
