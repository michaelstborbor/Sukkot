import type { Metadata } from "next";
import { formatSlPhone, NOTICES } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { db } from "@/server/db";
import { getCatalog } from "@/server/services/catalog";
import { PageHeader } from "@/components/dashboard/shell";
import { ListingForm } from "@/components/dashboard/listing-form";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Add property" };

export default async function NewPropertyPage() {
  const actor = await requirePagePermission("listing:create", "/dashboard/properties/new");
  const [catalog, me] = await Promise.all([getCatalog(), db.user.findUnique({ where: { id: actor.id }, select: { phone: true, email: true } })]);
  // Start the private contact details from the account; the lister can change them per listing.
  const initial = { privateContactPhone: me?.phone ? formatSlPhone(me.phone) : "", privateContactEmail: me?.email ?? "" };
  return (
    <div className="max-w-4xl">
      <PageHeader title="Add a property" description="Choose the type of property first: the form then asks only what applies to it. Then add photos, or ask us to take them, and submit." />
      <Notice className="mb-6">{NOTICES.verificationLimits}</Notice>
      <ListingForm catalog={catalog} initial={initial} isAgent={actor.roles.includes("AGENT")} />
    </div>
  );
}
