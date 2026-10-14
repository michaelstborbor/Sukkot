import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/forms/auth-forms";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-navy-900">Choose a new password</h1>
      {token ? <ResetPasswordForm token={token} /> : <Notice tone="danger">This reset link is incomplete. Request a new one.</Notice>}
    </>
  );
}
