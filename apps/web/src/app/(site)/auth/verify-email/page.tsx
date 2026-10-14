import type { Metadata } from "next";
import Link from "next/link";
import { verifyEmail } from "@/server/services/auth";
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
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold text-navy-900">Email confirmation</h1>
      {ok ? <Notice tone="success">Your email address is confirmed. Thank you.</Notice> : <Notice tone="danger">This link is invalid or has expired.</Notice>}
      <p className="mt-6 text-center text-sm"><Link href="/dashboard" className="link">Go to your dashboard</Link></p>
    </>
  );
}
