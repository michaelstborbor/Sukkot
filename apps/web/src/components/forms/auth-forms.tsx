"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

function PasswordInput({ id, value, onChange, autoComplete, invalid }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required className="pr-11" aria-invalid={invalid} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function SignInForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("/auth/login", { body: { email, password } });
      toast.success("Welcome back");
      router.push(safeNext(params.get("next")));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in");
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field id="email" label="Email">
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field id="password" label="Password">
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <div className="text-right text-sm">
        <Link href="/auth/forgot-password" className="link">Forgot password?</Link>
      </div>
      {error && <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" size="lg" loading={pending}>Sign in</Button>
      {demo && (
        <Notice tone="info" title="Demo accounts (local development)">
          tenant@demo.sukkot.sl, landlord@demo.sukkot.sl, agent@demo.sukkot.sl, buyer@demo.sukkot.sl or admin@demo.sukkot.sl with password <code>SukkotDemo2026</code>.
        </Notice>
      )}
    </form>
  );
}

const TYPES = [
  { value: "USER", title: "Tenant or buyer", body: "Search, save and contact owners" },
  { value: "OWNER", title: "Landlord or owner", body: "List and manage your property" },
  { value: "AGENT", title: "Agent", body: "Market properties for clients" },
] as const;

export function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialType = (params.get("type") as (typeof TYPES)[number]["value"]) ?? "USER";
  const [v, setV] = useState({ fullName: "", email: "", phone: "", password: "", accountType: TYPES.some((t) => t.value === initialType) ? initialType : "USER", verifyBy: "EMAIL" as "EMAIL" | "PHONE", acceptTerms: false });
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setError(null);
    try {
      await api("/auth/register", { body: v });
      const next = v.accountType === "USER" ? safeNext(params.get("next")) : "/dashboard/properties/new";
      if (v.verifyBy === "PHONE") {
        toast.success(`Account created. We texted a 6-digit code to ${v.phone}.`);
        router.push(`/auth/verify-phone?next=${encodeURIComponent(next)}`);
      } else {
        toast.success(`Account created. We sent a link to ${v.email} to confirm your email address.`);
        router.push(next);
      }
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {});
        setError(err.message);
      } else setError("Could not create your account");
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">I am a</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPES.map((t) => (
            <label key={t.value} className={cn("cursor-pointer rounded-xl border p-3 transition", v.accountType === t.value ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20" : "border-line hover:border-navy-600")}>
              <input type="radio" name="accountType" value={t.value} className="sr-only" checked={v.accountType === t.value} onChange={() => setV((c) => ({ ...c, accountType: t.value }))} />
              <span className="block text-sm font-semibold">{t.title}</span>
              <span className="block text-xs text-muted">{t.body}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="fullName" label="Full name" error={errors.fullName}>
        <Input id="fullName" autoComplete="name" value={v.fullName} onChange={(e) => setV((c) => ({ ...c, fullName: e.target.value }))} required aria-invalid={!!errors.fullName} />
      </Field>
      <Field id="email" label="Email" error={errors.email}>
        <Input id="email" type="email" autoComplete="email" value={v.email} onChange={(e) => setV((c) => ({ ...c, email: e.target.value }))} required aria-invalid={!!errors.email} />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Confirm my account by</legend>
        <div className="grid grid-cols-2 gap-2">
          {([["EMAIL", "Email", "We email you a link"], ["PHONE", "Text message", "We text a code to your phone"]] as const).map(([value, title, body]) => (
            <label key={value} className={cn("cursor-pointer rounded-xl border p-3 transition", v.verifyBy === value ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20" : "border-line hover:border-navy-600")}>
              <input type="radio" name="verifyBy" value={value} className="sr-only" checked={v.verifyBy === value} onChange={() => setV((c) => ({ ...c, verifyBy: value }))} />
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-xs text-muted">{body}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="phone" label="Phone number" optional={v.verifyBy === "EMAIL"} hint={v.verifyBy === "PHONE" ? "Sierra Leone number that can receive texts, e.g. 076 123 456" : "Sierra Leone number, e.g. 076 123 456"} error={errors.phone}>
        <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={v.phone} onChange={(e) => setV((c) => ({ ...c, phone: e.target.value }))} required={v.verifyBy === "PHONE"} aria-invalid={!!errors.phone} />
      </Field>
      <Field id="password" label="Password" hint="At least 10 characters with letters and numbers." error={errors.password}>
        <PasswordInput id="password" value={v.password} onChange={(p) => setV((c) => ({ ...c, password: p }))} autoComplete="new-password" invalid={!!errors.password} />
      </Field>
      <Checkbox
        id="terms"
        checked={v.acceptTerms}
        onChange={(e) => setV((c) => ({ ...c, acceptTerms: e.target.checked }))}
        label={<>I agree to the <Link href="/terms" className="link" target="_blank">terms of use</Link> and <Link href="/privacy" className="link" target="_blank">privacy policy</Link>.</>}
      />
      {errors.acceptTerms && <p className="text-xs text-danger">{errors.acceptTerms}</p>}
      {error && <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" size="lg" variant="secondary" loading={pending}>Create account</Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  if (sent) return <Notice tone="success" title="Check your email">If an account exists for {email}, we have sent a link to reset your password. It expires in one hour.</Notice>;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await api("/auth/forgot-password", { body: { email } });
          setSent(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Please try again");
        } finally {
          setPending(false);
        }
      }}
    >
      <Field id="email" label="Email">
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={pending}>Send reset link</Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        try {
          await api("/auth/reset-password", { body: { token, password } });
          toast.success("Password updated. Please sign in.");
          router.push("/auth/sign-in");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not reset password");
        } finally {
          setPending(false);
        }
      }}
    >
      <Field id="password" label="New password" hint="At least 10 characters with letters and numbers.">
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" />
      </Field>
      {error && <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" size="lg" loading={pending}>Update password</Button>
    </form>
  );
}

/** Enter the code texted to the phone, send a new one, or switch to a different number. */
export function PhoneVerifyForm({ phone: initialPhone, next, demoNoSms = false }: { phone: string | null; next: string; demoNoSms?: boolean }) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [editing, setEditing] = useState(!initialPhone);
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(initialPhone);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [pending, setPending] = useState<"send" | "check" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setPending("send");
    setErrors({});
    setError(null);
    try {
      const res = await api<{ alreadyVerified: boolean; phone: string; demoCode: string | null }>("/auth/verify-phone/send", { body: editing ? { phone } : {} });
      if (res.alreadyVerified) {
        toast.success("Your phone number is already confirmed");
        router.push(safeNext(next));
        return;
      }
      setSentTo(res.phone);
      setEditing(false);
      setDemoCode(res.demoCode);
      toast.success("We sent you a new code");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {});
        setError(err.message);
      } else setError("Could not send the code");
    } finally {
      setPending(null);
    }
  }

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setPending("check");
    setErrors({});
    setError(null);
    try {
      await api("/auth/verify-phone", { body: { code } });
      toast.success("Your phone number is confirmed");
      router.push(safeNext(next));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {});
        setError(err.message);
      } else setError("Could not check the code");
    } finally {
      setPending(null);
    }
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <Field id="vp-phone" label="Phone number" hint="Sierra Leone number that can receive texts, e.g. 076 123 456" error={errors.phone}>
          <Input id="vp-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errors.phone} />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger">{error}</p>}
        <Button className="w-full" size="lg" loading={pending === "send"} onClick={send}>Text me a code</Button>
      </div>
    );
  }
  return (
    <form onSubmit={check} className="space-y-4" noValidate>
      <p className="text-sm text-muted">
        Enter the 6-digit code we texted to <strong className="text-ink">{sentTo}</strong>. Codes expire after 10 minutes.
      </p>
      {demoNoSms && !demoCode && (
        <Notice tone="info" title="Demo site">Texts are not sent here. Choose Send a new code and the code appears on this page.</Notice>
      )}
      {demoCode && (
        <Notice tone="info" title="Demo site">Texts are not sent here. Your code is <strong className="font-mono">{demoCode}</strong>.</Notice>
      )}
      <Field id="vp-code" label="Code" error={errors.code}>
        <Input id="vp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} className="font-mono tracking-[0.3em]" aria-invalid={!!errors.code} />
      </Field>
      {error && <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" size="lg" loading={pending === "check"}>Confirm my phone</Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <button type="button" className="link" onClick={send} disabled={pending !== null}>Send a new code</button>
        <button type="button" className="link" onClick={() => { setEditing(true); setError(null); }}>Use a different number</button>
      </div>
    </form>
  );
}
