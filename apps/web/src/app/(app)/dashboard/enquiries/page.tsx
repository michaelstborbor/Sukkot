import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { formatDateTime, maskPhone } from "@sukkot/shared";
import { requirePagePermission } from "@/server/auth/actor";
import { listReceivedEnquiries } from "@/server/services/messaging";
import { PageHeader } from "@/components/dashboard/shell";
import { Badge, EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Enquiries" };

const INTENT: Record<string, string> = { GENERAL: "General question", RENT: "Wants to rent", BUY: "Wants to buy", INSPECTION: "Wants to view", DOCUMENTS: "Asked about documents" };
const CONTACT: Record<string, string> = { IN_APP: "In-app messages", PHONE: "Phone call", WHATSAPP: "WhatsApp", EMAIL: "Email" };

export default async function EnquiriesPage() {
  const actor = await requirePagePermission("listing:create", "/dashboard/enquiries");
  const rows = await listReceivedEnquiries(actor);
  return (
    <>
      <PageHeader title="Enquiries" description="Questions from people interested in your listings. Reply through messages so there is a record." />
      {rows.length === 0 ? (
        <EmptyState icon={<Inbox className="h-6 w-6" />} title="No enquiries yet" body="When someone contacts you about a listing, it will appear here." />
      ) : (
        <ul className="space-y-3">
          {rows.map((e) => (
            <li key={e.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <Badge tone="gold">{INTENT[e.intent] ?? e.intent}</Badge>
                <span>{e.property.reference}</span>
                <span>· {formatDateTime(e.createdAt)}</span>
              </div>
              <p className="mt-2 font-semibold text-navy-900">
                {e.user.profile?.fullName ?? "User"} <span className="font-normal text-muted">about</span> {e.property.title}
              </p>
              <p className="mt-1 line-clamp-3 text-sm text-ink">{e.message}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted">
                  Prefers: {CONTACT[e.preferredContact]}
                  {e.contactPhone && e.preferredContact !== "IN_APP" ? ` · ${e.contactPhone}` : e.user.phone ? ` · ${maskPhone(e.user.phone)}` : ""}
                </span>
                <Link href={`/dashboard/messages/${e.conversationId}`} className="link">
                  Open conversation
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
