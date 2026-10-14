"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <h1 className="font-display text-3xl font-semibold text-navy-900">Something went wrong</h1>
      <p className="mt-3 max-w-md text-muted">Please try again. If the problem continues, contact support{error.digest ? ` and quote reference ${error.digest}` : ""}.</p>
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </main>
  );
}
