import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/actor";
import { myAgency } from "@/server/services/agency";
import { PageHeader } from "@/components/dashboard/shell";
import { JsonForm, type JsonField } from "@/components/dashboard/json-form";
import { ActionButton } from "@/components/dashboard/action-button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Agency and team" };

const FIELDS: JsonField[] = [
  { name: "name", label: "Agency name" },
  { name: "registrationNumber", label: "Business registration number", optional: true },
  { name: "phone", label: "Phone", type: "tel", optional: true },
  { name: "email", label: "Email", type: "email", optional: true },
  { name: "website", label: "Website", type: "url", optional: true, placeholder: "https://" },
  { name: "address", label: "Office address", optional: true },
  { name: "description", label: "About the agency", type: "textarea", optional: true },
];

export default async function AgencyPage() {
  const actor = await requirePagePermission("agency:manage", "/dashboard/agency");
  const mine = await myAgency(actor);
  if (!mine) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Agency and team" description="Create an agency profile so you can list on behalf of clients as a team." />
        <section className="card p-5">
          <JsonForm path="/agency" fields={FIELDS} submitLabel="Create agency" success="Agency created" />
        </section>
      </div>
    );
  }
  const { agency, role } = mine;
  const admin = role !== "AGENT";
  return (
    <div className="max-w-4xl">
      <PageHeader title={agency.name} description={`${agency._count.properties} live listings · you are ${role.toLowerCase()}`} />
      <Notice className="mb-6">An agency profile is not a licence. Submit agent credentials under Verification to earn the Verified Agent badge.</Notice>
      <section className="card mb-6 p-5">
        <h2 className="mb-3 font-bold text-navy-900">Team</h2>
        <ul className="divide-y divide-line">
          {agency.members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
              <span>
                <span className="font-medium">{m.user.profile?.fullName ?? m.user.email}</span> <span className="text-muted">· {m.user.email}</span>
              </span>
              <span className="flex items-center gap-2">
                <StatusBadge status={m.role} />
                {admin && m.role !== "OWNER" && m.userId !== actor.id && (
                  <ActionButton path={`/agency/members?id=${m.id}`} method="DELETE" label="Remove" variant="ghost" confirm="Remove this agent from the agency?" success="Removed" />
                )}
              </span>
            </li>
          ))}
        </ul>
        {admin && (
          <div className="mt-5 border-t border-line pt-5">
            <h3 className="mb-3 text-sm font-semibold">Add an agent</h3>
            <JsonForm
              path="/agency/members"
              reset
              submitLabel="Add to team"
              success="Agent added"
              fields={[
                { name: "email", label: "Agent's account email", type: "email" },
                { name: "role", label: "Role", type: "select", defaultValue: "AGENT", options: [{ value: "AGENT", label: "Agent" }, { value: "MANAGER", label: "Manager" }] },
              ]}
            />
          </div>
        )}
      </section>
      {admin && (
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-navy-900">Agency profile</h2>
          <JsonForm path="/agency" method="PATCH" fields={FIELDS.map((f) => ({ ...f, defaultValue: String((agency as Record<string, unknown>)[f.name] ?? "") }))} />
        </section>
      )}
    </div>
  );
}
