import Link from "next/link";

/** A one-line notice under forms that send personal details: what we do with them, and where to read more. */
export function PrivacyNote({ children }: { children?: React.ReactNode }) {
  return (
    <p className="text-xs text-muted">
      {children ?? "We use these details only to handle this request."} See our{" "}
      <Link href="/privacy" className="link" target="_blank">privacy policy</Link>.
    </p>
  );
}
