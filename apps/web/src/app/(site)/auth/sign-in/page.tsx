import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignInForm } from "@/components/forms/auth-forms";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-navy-900">Welcome back</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Sign in to message owners, save properties and manage listings.</p>
      <Suspense>
        <SignInForm demo={env.demoMode} />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted">New here? <Link href="/auth/sign-up" className="link">Create an account</Link></p>
    </>
  );
}
