import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { db } from "@/server/db";
import { locationsWithCounts } from "@/server/services/catalog";
import { SectionHeading } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Locations", description: "Browse property by province, district and town across Sierra Leone." };
export const revalidate = 300;

export default async function LocationsPage() {
  const [districts, cities, provinces] = await Promise.all([
    locationsWithCounts("DISTRICT"),
    locationsWithCounts("CITY"),
    db.location.findMany({ where: { level: "PROVINCE", isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <div className="container-page py-10 sm:py-14">
      <SectionHeading eyebrow="Explore" title="Property across Sierra Leone" body="Choose a district or town to see what is available there." />
      <div className="space-y-10">
        {provinces.map((prov) => {
          const ds = districts.filter((d) => d.parentId === prov.id);
          return (
            <section key={prov.id}>
              <h2 className="mb-3 text-lg font-bold text-navy-900">{prov.name}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ds.map((d) => {
                  const towns = cities.filter((c) => c.parentId === d.id);
                  return (
                    <div key={d.id} className="card p-4">
                      <Link href={`/locations/${d.slug}`} className="flex items-center justify-between font-semibold text-navy-900 hover:underline">
                        <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-emerald-700" /> {d.name}</span>
                        <span className="text-xs font-normal text-muted">{d.count}</span>
                      </Link>
                      {towns.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {towns.map((t) => (
                            <li key={t.id}>
                              <Link href={`/locations/${t.slug}`} className="inline-block rounded-full bg-canvas px-2.5 py-0.5 text-xs hover:bg-navy-50">
                                {t.name} {t.count > 0 && <span className="text-muted">({t.count})</span>}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
