"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApiForm } from "@/hooks/use-api-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export interface JsonField {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "url" | "number" | "date" | "textarea" | "select" | "checkbox" | "list";
  options?: { value: string; label: string }[];
  optional?: boolean;
  hint?: string;
  defaultValue?: string | boolean;
  placeholder?: string;
  wide?: boolean;
}

/** Small declarative form that posts JSON to /api/v1 and shows field errors. Props are serialisable. */
export function JsonForm({
  path,
  method = "POST",
  fields,
  submitLabel = "Save",
  success = "Saved",
  reset = false,
  extra,
  columns = 2,
}: {
  path: string;
  method?: string;
  fields: JsonField[];
  submitLabel?: string;
  success?: string;
  reset?: boolean;
  extra?: Record<string, unknown>;
  columns?: 1 | 2;
}) {
  const router = useRouter();
  const initial = () => Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? (f.type === "checkbox" ? false : "")]));
  const [v, setV] = useState<Record<string, string | boolean>>(initial);
  const { submit, pending, errors, formError } = useApiForm(path, {
    method,
    success,
    onSuccess: () => {
      if (reset) setV(initial());
      router.refresh();
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const body: Record<string, unknown> = { ...extra };
        for (const f of fields) {
          const val = v[f.name];
          if (f.type === "checkbox") body[f.name] = val === true;
          else if (f.type === "number") body[f.name] = val === "" ? undefined : Number(val);
          else if (f.type === "list") body[f.name] = String(val).split("\n").map((s) => s.trim()).filter(Boolean);
          else body[f.name] = val;
        }
        submit(body);
      }}
    >
      {formError && <Notice tone="danger">{formError}</Notice>}
      <div className={cn("grid gap-4", columns === 2 && "sm:grid-cols-2")}>
        {fields.map((f) => {
          const id = `jf-${path.replace(/\W/g, "")}-${f.name}`;
          const common = { id, "aria-invalid": !!errors[f.name] };
          const val = v[f.name];
          if (f.type === "checkbox")
            return (
              <Checkbox key={f.name} {...common} label={f.label} checked={val === true} onChange={(e) => setV((p) => ({ ...p, [f.name]: e.target.checked }))} className={cn(f.wide && "sm:col-span-2")} />
            );
          return (
            <Field key={f.name} id={id} label={f.label} optional={f.optional} hint={f.hint} error={errors[f.name]} className={cn((f.wide || f.type === "textarea" || f.type === "list") && "sm:col-span-2")}>
              {f.type === "textarea" || f.type === "list" ? (
                <Textarea {...common} rows={f.type === "list" ? 4 : 3} value={String(val)} placeholder={f.placeholder} onChange={(e) => setV((p) => ({ ...p, [f.name]: e.target.value }))} />
              ) : f.type === "select" ? (
                <Select {...common} value={String(val)} onChange={(e) => setV((p) => ({ ...p, [f.name]: e.target.value }))}>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              ) : (
                <Input {...common} type={f.type ?? "text"} required={!f.optional} value={String(val)} placeholder={f.placeholder} onChange={(e) => setV((p) => ({ ...p, [f.name]: e.target.value }))} />
              )}
            </Field>
          );
        })}
      </div>
      <Button type="submit" loading={pending}>{submitLabel}</Button>
    </form>
  );
}
