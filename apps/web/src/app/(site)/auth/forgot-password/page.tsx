import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-navy-900">Forgot your password?</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Enter your email and we&apos;ll send you a reset link.</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm"><Link href="/auth/sign-in" className="link">Back to sign in</Link></p>
    </>
  );
}
