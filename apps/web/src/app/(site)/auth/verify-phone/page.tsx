import type { Metadata } from "next";
import { safeNext } from "@/lib/safe-next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatSlPhone } from "@sukkot/shared";
import { getCurrentActor } from "@/server/auth/actor";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { PhoneVerifyForm } from "@/components/forms/auth-forms";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Confirm your phone", robots: { index: false } };

export default async function VerifyPhonePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  const actor = await getCurrentActor();
  if (!actor) redirect(`/auth/sign-in?next=${encodeURIComponent(`/auth/verify-phone?next=${encodeURIComponent(next)}`)}`);
  const me = await db.user.findUnique({ where: { id: actor.id }, select: { phone: true, phoneVerifiedAt: true } });

  return (
    <>
      <h1 className="text-2xl font-bold text-navy-900">Confirm your phone number</h1>
      <p className="mt-1 mb-6 text-sm text-muted">An alternative to confirming your email. Either one lets you submit listings, make offers, apply to rent and pay for services.</p>
      {me?.phoneVerifiedAt && me.phone ? (
        <>
          <Notice tone="success" title="Your phone number is confirmed">{formatSlPhone(me.phone)} is confirmed on your account.</Notice>
          <div className="mt-6 flex justify-center">
            <ButtonLink href={next}>Continue</ButtonLink>
          </div>
        </>
      ) : (
        <>
          <PhoneVerifyForm phone={me?.phone ? formatSlPhone(me.phone) : null} next={next} demoNoSms={env.demoMode && env.smsDriver === "console"} />
          <p className="mt-6 text-center text-sm text-muted">
            No phone signal? <Link href={next} className="link">Skip for now</Link> and confirm your email from the dashboard instead.
          </p>
        </>
      )}
    </>
  );
}
