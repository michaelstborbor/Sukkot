"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shown until the person confirms their email address, with a way to get a new link. */
export function EmailVerifyBanner({ email, className }: { email: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [demoLink, setDemoLink] = useState<string | null>(null);
  async function resend() {
    setBusy(true);
    try {
      const res = await api<{ alreadyVerified: boolean; demoLink: string | null }>("/auth/verify-email/resend", { method: "POST" });
      if (res.alreadyVerified) {
        toast.success("Your email is already confirmed");
        window.location.reload();
        return;
      }
      setDemoLink(res.demoLink);
      toast.success(`We sent a new link to ${email}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not send the link. Try again later.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div role="status" className={cn("flex flex-col gap-3 rounded-xl border border-gold-100 bg-gold-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex gap-3">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold-700" aria-hidden />
        <div>
          <p className="font-semibold text-navy-900">Confirm your email address</p>
          <p className="text-muted">
            We sent a link to <strong className="text-ink">{email}</strong>. You need a confirmed email to submit a listing, make an offer, apply to rent or pay for a service.
          </p>
          {demoLink && (
            <p className="mt-1">
              Demo site: emails are not sent. <a href={demoLink} className="link">Confirm your email now</a>
            </p>
          )}
        </div>
      </div>
      <Button variant="outline" size="sm" loading={busy} onClick={resend} className="shrink-0">Send the link again</Button>
    </div>
  );
}
