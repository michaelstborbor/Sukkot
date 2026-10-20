import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = { title: "Cookie policy", description: "The cookies and browser storage Sukkot Salone uses, and why there is no cookie banner." };

export default function CookiesPage() {
  return (
    <ProsePage eyebrow="Legal" title="Cookie policy" updated="20 October 2026" intro="Draft for legal review. This explains the small files and browser storage the website uses.">
      <h2>What we use</h2>
      <p>{brand.name} uses only what the website needs to work. We do not use advertising cookies, analytics or tracking tools, and we do not let other companies set cookies through our pages.</p>
      <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-2 [&_td]:py-2 [&_td]:align-top [&_th]:px-2 [&_th]:py-2">
        <thead>
          <tr><th>Name</th><th>Type</th><th>What it does</th><th>How long</th></tr>
        </thead>
        <tbody>
          <tr><td>ss_session (__Host-ss_session on the live site)</td><td>Cookie, strictly necessary</td><td>Keeps you signed in. It holds a random code, not your password or personal details.</td><td>30 days, or until you sign out</td></tr>
          <tr><td>ss_compare</td><td>Browser storage, functional</td><td>Remembers the listings you chose to compare. It stays on your device and is never sent to us.</td><td>Until you clear it or your browser storage</td></tr>
        </tbody>
      </table>
      </div>
      <h2>Why there is no cookie banner</h2>
      <p>Cookies that are strictly necessary to provide a service you ask for, such as staying signed in, do not need consent. If we ever add analytics or any other optional cookie, we will ask for your consent first and update this page.</p>
      <h2>The mobile app</h2>
      <p>The app keeps your sign-in in your phone&apos;s secure storage and uses no tracking or advertising tools.</p>
      <h2>Other websites</h2>
      <p>Links to WhatsApp, OpenStreetMap and payment providers open their own sites, which have their own cookie policies. Nothing from them loads on our pages until you follow the link.</p>
      <h2>Managing cookies</h2>
      <p>You can delete cookies in your browser settings. If you delete the session cookie you will be signed out. Read our <Link href="/privacy">privacy policy</Link> for how we handle personal information.</p>
    </ProsePage>
  );
}
