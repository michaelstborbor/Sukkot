"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

/** Submit a JSON body to /api/v1 and surface server-side field errors next to inputs. */
export function useApiForm<T = unknown>(path: string, opts: { method?: string; success?: string; onSuccess?: (data: T) => void } = {}) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  async function submit(body: unknown) {
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      const data = await api<T>(path, { method: opts.method ?? "POST", body });
      if (opts.success) toast.success(opts.success);
      opts.onSuccess?.(data);
      return data;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) setErrors(err.fields);
        setFormError(err.message);
        if (err.status === 401) window.location.href = `/auth/sign-in?next=${encodeURIComponent(window.location.pathname)}`;
      } else setFormError("Something went wrong");
      return null;
    } finally {
      setPending(false);
    }
  }
  return { submit, pending, errors, formError };
}

/** Convert a <input type="datetime-local"> value in Freetown time (GMT, no DST) to an ISO instant. */
export function freetownLocalToIso(value: string) {
  return value ? new Date(`${value}:00Z`).toISOString() : "";
}
