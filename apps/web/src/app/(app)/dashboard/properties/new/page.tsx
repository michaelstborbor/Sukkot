import type { Metadata } from "next";
import { NOTICES } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { getCatalog } from "@/server/services/catalog";
import { PageHeader } from "@/components/dashboard/shell";
import { ListingForm } from "@/components/dashboard/listing-form";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Add property" };

export default async function NewPropertyPage() {
  const actor = await requirePagePermission("listing:create", "/dashboard/properties/new");
  const catalog = await getCatalog();
  return (
    <div className="max-w-4xl">
      <PageHeader title="Add a property" description="Step 1 of 3: details. Next you add photos, then submit for review." />
      <Notice className="mb-6">{NOTICES.verificationLimits}</Notice>
      <ListingForm catalog={catalog} isAgent={actor.roles.includes("AGENT")} />
    </div>
  );
}
