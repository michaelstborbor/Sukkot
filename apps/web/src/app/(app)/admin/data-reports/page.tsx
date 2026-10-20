import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { LISTING_PURPOSES, LISTING_PURPOSE_LABELS, LISTING_STATUSES, LISTING_STATUS_LABELS, PROPERTY_CATEGORIES, PROPERTY_CATEGORY_LABELS, ROLES, ROLE_LABELS } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { db } from "@/server/db";
import { toAppError } from "@/server/errors";
import { canSeePrivateContacts, DATASET_LABELS, datasetsFor, PREVIEW_ROWS, previewReport, REPORT_ROW_LIMIT, reportQuery, type Dataset } from "@/server/services/data-reports";
import { PageHeader } from "@/components/dashboard/shell";
import { Field, Input, Select } from "@/components/ui/form";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Data reports" };

type Params = Record<string, string | undefined>;

export default async function AdminDataReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const actor = await requirePagePermission("admin:access", "/admin/data-reports");
  const datasets = datasetsFor(actor);
  if (datasets.length === 0) redirect("/admin");
  const sp = await searchParams;
  const dataset: Dataset = datasets.includes(sp.dataset as Dataset) ? (sp.dataset as Dataset) : datasets[0]!;
  const params: Params = { ...Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === "string")), dataset };

  let preview: Awaited<ReturnType<typeof previewReport>> | null = null;
  let errors: Record<string, string> = {};
  try {
    preview = await previewReport(actor, params);
  } catch (err) {
    const e = toAppError(err);
    if (e.code !== "VALIDATION") throw err;
    errors = e.fields ?? { _: e.message };
  }
  const [types, places] =
    dataset === "listings"
      ? await Promise.all([
          db.propertyType.findMany({ where: { isActive: true }, select: { id: true, name: true, category: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
          db.location.findMany({ where: { isActive: true, level: { in: ["PROVINCE", "DISTRICT", "CITY"] } }, select: { id: true, name: true, level: true }, orderBy: [{ level: "asc" }, { name: "asc" }] }),
        ])
      : [[], []];
  const query = reportQuery(params);
  const v = (k: string) => params[k] ?? "";

  return (
    <>
      <PageHeader
        title="Data reports"
        description={`Choose users or listings, narrow them down with the filters, check the first rows, then download a CSV file. A download holds up to ${REPORT_ROW_LIMIT.toLocaleString("en-GB")} rows. Each download is recorded in the audit log.`}
      />
      <nav className="mb-4 flex flex-wrap gap-1" aria-label="Data">
        {datasets.map((d) => (
          <Link key={d} href={`?dataset=${d}`} aria-current={d === dataset ? "page" : undefined} className={cn("rounded-full px-3 py-1 text-sm font-medium", d === dataset ? "bg-navy-900 text-white" : "bg-surface text-ink ring-1 ring-line hover:bg-navy-50")}>
            {DATASET_LABELS[d]}
          </Link>
        ))}
      </nav>

      <form className="card mb-6 p-4">
        <input type="hidden" name="dataset" value={dataset} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dataset === "users" ? (
            <>
              <Field id="q" label="Search" error={errors.q}>
                <Input id="q" name="q" defaultValue={v("q")} placeholder="Name, email or phone" />
              </Field>
              <Field id="role" label="Account type" error={errors.role}>
                <Select id="role" name="role" defaultValue={v("role")}>
                  <option value="">Any</option>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </Select>
              </Field>
              <Field id="status" label="Status" error={errors.status}>
                <Select id="status" name="status" defaultValue={v("status")}>
                  <option value="">Any</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="DEACTIVATED">Deactivated</option>
                </Select>
              </Field>
              <Field id="emailConfirmed" label="Email confirmed" error={errors.emailConfirmed}>
                <YesNo id="emailConfirmed" value={v("emailConfirmed")} />
              </Field>
              <Field id="joinedFrom" label="Joined from" error={errors.joinedFrom}>
                <Input id="joinedFrom" name="joinedFrom" type="date" defaultValue={v("joinedFrom")} />
              </Field>
              <Field id="joinedTo" label="Joined to" error={errors.joinedTo}>
                <Input id="joinedTo" name="joinedTo" type="date" defaultValue={v("joinedTo")} />
              </Field>
            </>
          ) : (
            <>
              <Field id="q" label="Search" error={errors.q}>
                <Input id="q" name="q" defaultValue={v("q")} placeholder="Title or reference" />
              </Field>
              <Field id="status" label="Listing status" error={errors.status}>
                <Select id="status" name="status" defaultValue={v("status")}>
                  <option value="">Any</option>
                  {LISTING_STATUSES.map((s) => <option key={s} value={s}>{LISTING_STATUS_LABELS[s]}</option>)}
                </Select>
              </Field>
              <Field id="purpose" label="Purpose" error={errors.purpose}>
                <Select id="purpose" name="purpose" defaultValue={v("purpose")}>
                  <option value="">Any</option>
                  {LISTING_PURPOSES.map((p) => <option key={p} value={p}>{LISTING_PURPOSE_LABELS[p]}</option>)}
                </Select>
              </Field>
              <Field id="category" label="Category" error={errors.category}>
                <Select id="category" name="category" defaultValue={v("category")}>
                  <option value="">Any</option>
                  {PROPERTY_CATEGORIES.map((c) => <option key={c} value={c}>{PROPERTY_CATEGORY_LABELS[c]}</option>)}
                </Select>
              </Field>
              <Field id="typeId" label="Property type" error={errors.typeId}>
                <Select id="typeId" name="typeId" defaultValue={v("typeId")}>
                  <option value="">Any</option>
                  {PROPERTY_CATEGORIES.map((c) => {
                    const inCategory = types.filter((t) => t.category === c);
                    return inCategory.length ? (
                      <optgroup key={c} label={PROPERTY_CATEGORY_LABELS[c]}>
                        {inCategory.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </optgroup>
                    ) : null;
                  })}
                </Select>
              </Field>
              <Field id="locationId" label="Location" error={errors.locationId}>
                <Select id="locationId" name="locationId" defaultValue={v("locationId")}>
                  <option value="">Anywhere</option>
                  {(["PROVINCE", "DISTRICT", "CITY"] as const).map((level) => (
                    <optgroup key={level} label={{ PROVINCE: "Provinces", DISTRICT: "Districts", CITY: "Cities and towns" }[level]}>
                      {places.filter((l) => l.level === level).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </optgroup>
                  ))}
                </Select>
              </Field>
              <Field id="minPrice" label="Price from" error={errors.minPrice}>
                <Input id="minPrice" name="minPrice" inputMode="numeric" defaultValue={v("minPrice")} placeholder="No minimum" />
              </Field>
              <Field id="maxPrice" label="Price up to" error={errors.maxPrice}>
                <Input id="maxPrice" name="maxPrice" inputMode="numeric" defaultValue={v("maxPrice")} placeholder="No maximum" />
              </Field>
              <Field id="currency" label="Currency" error={errors.currency} hint="Prices are compared in Leones unless you pick another currency.">
                <Select id="currency" name="currency" defaultValue={v("currency")}>
                  <option value="">Any (Leones for a price range)</option>
                  <option value="SLE">Leones (Le)</option>
                  <option value="USD">US dollars (US$)</option>
                </Select>
              </Field>
              <Field id="listedBy" label="Listed by" error={errors.listedBy}>
                <Select id="listedBy" name="listedBy" defaultValue={v("listedBy")}>
                  <option value="">Anyone</option>
                  <option value="OWNER">Owners and developers</option>
                  <option value="AGENT">Agents</option>
                </Select>
              </Field>
              <Field id="featured" label="Featured" error={errors.featured}>
                <YesNo id="featured" value={v("featured")} />
              </Field>
              <Field id="createdFrom" label="Created from" error={errors.createdFrom}>
                <Input id="createdFrom" name="createdFrom" type="date" defaultValue={v("createdFrom")} />
              </Field>
              <Field id="createdTo" label="Created to" error={errors.createdTo}>
                <Input id="createdTo" name="createdTo" type="date" defaultValue={v("createdTo")} />
              </Field>
            </>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className={buttonClasses("primary", "md")}>Show results</button>
          <Link href={`?dataset=${dataset}`} className={buttonClasses("ghost", "md")}>Clear filters</Link>
        </div>
      </form>

      {errors._ && <Notice tone="danger" className="mb-4">{errors._}</Notice>}
      {Object.keys(errors).length > 0 && !errors._ && <Notice tone="danger" className="mb-4">Please check the highlighted filters.</Notice>}

      {preview && (
        <section aria-labelledby="results">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="results" className="text-lg font-semibold text-navy-900">
                {preview.total.toLocaleString("en-GB")} {preview.total === 1 ? (dataset === "users" ? "user" : "listing") : DATASET_LABELS[dataset].toLowerCase()}
              </h2>
              <p className="text-sm text-muted">
                {preview.total > PREVIEW_ROWS ? `Showing the newest ${PREVIEW_ROWS}. ` : ""}
                {preview.total > REPORT_ROW_LIMIT ? `The download holds the newest ${REPORT_ROW_LIMIT.toLocaleString("en-GB")}; narrow the filters to get the rest.` : preview.total > 0 ? "The download holds all of them." : ""}
              </p>
              {dataset === "listings" && canSeePrivateContacts(actor) && <p className="text-sm text-muted">The download includes listers&apos; private phone numbers and emails. Keep it safe.</p>}
            </div>
            {preview.total > 0 && (
              <a href={`/api/v1/admin/data-reports?${query}`} download className={buttonClasses("accent", "md")}>
                <Download className="h-4 w-4" aria-hidden /> Download CSV
              </a>
            )}
          </div>
          {preview.total === 0 ? (
            <EmptyState title="Nothing matches" body="Try fewer filters." />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    {preview.columns.map((c) => <th key={c} scope="col" className="p-2 font-semibold whitespace-nowrap">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i} className="border-b border-line/60 align-top last:border-0">
                      {r.map((cell, j) => <td key={j} className="max-w-[16rem] truncate p-2 whitespace-nowrap" title={cell}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function YesNo({ id, value }: { id: string; value: string }) {
  return (
    <Select id={id} name={id} defaultValue={value}>
      <option value="">Either</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </Select>
  );
}
