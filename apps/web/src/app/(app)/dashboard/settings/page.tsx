import type { Metadata } from "next";
import { CONTACT_METHODS, ROLE_LABELS } from "@sukkot/shared";
import { requirePageActor } from "@/server/auth/actor";
import { db } from "@/server/db";
import { publicImageUrl } from "@/server/storage";
import { PageHeader } from "@/components/dashboard/shell";
import { JsonForm } from "@/components/dashboard/json-form";
import { ActionButton } from "@/components/dashboard/action-button";
import { AvatarUpload } from "@/components/dashboard/upload-forms";
import { Badge } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Account settings" };

const CONTACT_LABELS: Record<string, string> = { IN_APP: "In-app messages", PHONE: "Phone call", WHATSAPP: "WhatsApp", EMAIL: "Email" };

export default async function SettingsPage() {
  const actor = await requirePageActor("/dashboard/settings");
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id }, include: { profile: true } });
  const p = user.profile;
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Account settings" />
      <section className="card space-y-4 p-5">
        <h2 className="font-bold text-navy-900">Profile</h2>
        <AvatarUpload current={p?.avatarKey ? publicImageUrl(p.avatarKey, 480) : null} />
        <JsonForm
          path="/me"
          method="PATCH"
          fields={[
            { name: "fullName", label: "Full name", defaultValue: p?.fullName ?? "" },
            { name: "phone", label: "Phone", type: "tel", optional: true, defaultValue: user.phone ?? "", hint: "Sierra Leone number, e.g. 076 123 456" },
            { name: "whatsapp", label: "WhatsApp", type: "tel", optional: true, defaultValue: p?.whatsapp ?? "" },
            { name: "preferredContact", label: "Preferred contact", type: "select", defaultValue: p?.preferredContact ?? "IN_APP", options: CONTACT_METHODS.map((c) => ({ value: c, label: CONTACT_LABELS[c]! })) },
            { name: "bio", label: "About you", type: "textarea", optional: true, defaultValue: p?.bio ?? "" },
          ]}
        />
      </section>
      <section className="card space-y-3 p-5 text-sm">
        <h2 className="font-bold text-navy-900">Account</h2>
        <p>Email: <strong>{user.email}</strong> {user.emailVerifiedAt ? <Badge tone="verified">Verified</Badge> : <Badge tone="warning">Not verified</Badge>}</p>
        <p className="flex flex-wrap items-center gap-1">Roles: {actor.roles.map((r) => <Badge key={r}>{ROLE_LABELS[r]}</Badge>)}</p>
        <div className="flex flex-wrap gap-2 pt-2">
          <ButtonLink href="/auth/forgot-password" variant="outline" size="sm">Change password</ButtonLink>
          {!actor.roles.includes("OWNER") && <ActionButton path="/me/roles" body={{ role: "OWNER" }} label="Enable landlord tools" success="Landlord tools enabled" />}
          {!actor.roles.includes("AGENT") && <ActionButton path="/me/roles" body={{ role: "AGENT" }} label="Enable agent tools" success="Agent tools enabled" />}
        </div>
      </section>
      <section className="card space-y-3 border-red-200 p-5 text-sm">
        <h2 className="font-bold text-danger">Close account</h2>
        <p className="text-muted">Your listings are taken down and you are signed out everywhere. Records needed for legal, payment or dispute purposes are kept as described in the privacy policy.</p>
        <ActionButton path="/me" method="DELETE" label="Close my account" variant="danger" confirm="This cannot be undone from your side. Contact support if you change your mind." redirectTo="/" success="Account closed" />
      </section>
    </div>
  );
}
