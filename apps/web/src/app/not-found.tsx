import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <p className="text-sm font-bold tracking-widest text-gold-600 uppercase">404</p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-navy-900">We couldn&apos;t find that page</h1>
        <p className="mt-3 max-w-md text-muted">The listing may have been rented, sold or removed, or the link may be wrong.</p>
        <div className="mt-8 flex gap-3">
          <ButtonLink href="/properties">Browse properties</ButtonLink>
          <ButtonLink href="/" variant="outline">Home</ButtonLink>
        </div>
        <Link href="/help" className="link mt-6 text-sm">Get help</Link>
      </main>
    </>
  );
}
