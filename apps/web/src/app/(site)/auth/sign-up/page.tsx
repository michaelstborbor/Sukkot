import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignUpForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-navy-900">Create your account</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Free for tenants, buyers, landlords and agents.</p>
      <Suspense>
        <SignUpForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link href="/auth/sign-in" className="link">Sign in</Link></p>
    </>
  );
}
