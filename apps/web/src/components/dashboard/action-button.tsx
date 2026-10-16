"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button, type ButtonVariant, type ButtonSize } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/form";

/**
 * Posts an action to the API and refreshes the page. Optional confirm dialog with a
 * reason field (used for moderation decisions that must be documented).
 */
export function ActionButton({
  path,
  body,
  method = "POST",
  label,
  variant = "outline",
  size = "sm",
  success,
  confirm,
  reason,
  reasonKey = "reason",
  redirectTo,
}: {
  path: string;
  body?: Record<string, unknown>;
  method?: string;
  label: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  success?: string;
  confirm?: string;
  reason?: { label: string; required?: boolean; placeholder?: string };
  reasonKey?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  async function run(extra: Record<string, unknown> = {}) {
    setPending(true);
    try {
      await api(path, { method, body: { ...body, ...extra } });
      if (success) toast.success(success);
      setOpen(false);
      // Refreshing as well would race the navigation and can leave the browser on this page.
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  if (!confirm && !reason) {
    return (
      <Button variant={variant} size={size} loading={pending} onClick={() => run()}>
        {label}
      </Button>
    );
  }
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={typeof label === "string" ? label : "Confirm"} description={confirm}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(reason ? { [reasonKey]: text } : {});
          }}
        >
          {reason && (
            <Field id="action-reason" label={reason.label}>
              <Textarea id="action-reason" value={text} onChange={(e) => setText(e.target.value)} required={reason.required} minLength={reason.required ? 5 : undefined} placeholder={reason.placeholder} />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant={variant === "danger" ? "danger" : "primary"} loading={pending}>Confirm</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
