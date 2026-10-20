import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentActor } from "@/server/auth/actor";
import { db } from "@/server/db";
import { verifyEmail } from "@/server/services/auth";
import { EmailVerifyBanner } from "@/components/dashboard/email-verify-banner";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Confirm email", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let ok = false;
  if (token) {
    try {
      await verifyEmail(token);
      ok = true;
    } catch {
      ok = false;
    }
  }
  const actor = await getCurrentActor();
  const me = actor ? await db.user.findUnique({ where: { id: actor.id }, select: { email: true, emailVerifiedAt: true } }) : null;

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold text-navy-900">Email confirmation</h1>
      {ok ? (
        <Notice tone="success" title="Your email address is confirmed">You can now submit listings, make offers, apply to rent and pay for services.</Notice>
      ) : me?.emailVerifiedAt ? (
        <Notice tone="success" title="Your email is already confirmed">There is nothing more to do.</Notice>
      ) : (
        <>
          <Notice tone="danger" title="This link is invalid or has expired">Links work once and expire after 3 days. Each new link cancels the earlier ones, so use the most recent email.</Notice>
          {me ? (
            <EmailVerifyBanner email={me.email} className="mt-4" />
          ) : (
            <p className="mt-4 text-sm text-muted"><Link href="/auth/sign-in?next=/dashboard" className="link">Sign in</Link> to get a new link.</p>
          )}
        </>
      )}
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/dashboard" variant={ok ? "primary" : "outline"}>Go to your dashboard</ButtonLink>
      </div>
    </>
  );
}
