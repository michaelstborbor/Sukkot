import type { Metadata } from "next";
import { Bell, Heart, MessageCircle, Search, Smartphone, Wifi } from "lucide-react";
import { brand } from "@/config/brand";
import { InstallButton } from "@/components/app/install-button";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Get the app", description: `Put ${brand.name} on your phone's home screen and search homes, land and shops across Sierra Leone.` };

const FEATURES = [
  { icon: Search, title: "Search the whole country", body: "Homes, rooms, land and shops from Freetown to Kenema, with filters for water, power and price." },
  { icon: Bell, title: "Alerts for new listings", body: "Save a search and we tell you as soon as a matching listing goes live." },
  { icon: Heart, title: "Save and compare", body: "Keep the places you like and compare them side by side." },
  { icon: MessageCircle, title: "Chat with us on WhatsApp", body: "Ask about any listing in one tap, with the details already filled in." },
  { icon: Wifi, title: "Light on data", body: "Small, fast pages that work on 3G and low data bundles." },
];

export default function GetTheAppPage() {
  const stores = [
    brand.androidAppUrl && { href: brand.androidAppUrl, label: "Get it on Google Play" },
    brand.iosAppUrl && { href: brand.iosAppUrl, label: "Download on the App Store" },
  ].filter((s): s is { href: string; label: string } => !!s);

  return (
    <div className="bg-white">
      <header className="border-b border-line bg-gradient-to-b from-navy-50 to-white">
        <div className="container-page grid max-w-5xl items-center gap-10 py-12 sm:py-16 md:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="mb-2 text-xs font-bold tracking-[0.14em] text-emerald-700 uppercase">On your phone</p>
            <h1 className="font-display text-4xl font-semibold text-navy-900 sm:text-5xl">{brand.name} in your pocket</h1>
            <p className="mt-4 text-lg text-muted">Put {brand.name} on your home screen. It opens full screen like any other app, and you never have to type the address again.</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {stores.map((s) => (
                <ButtonLink key={s.href} href={s.href} variant="primary" size="lg">
                  <Smartphone className="h-5 w-5" aria-hidden /> {s.label}
                </ButtonLink>
              ))}
              <InstallButton />
            </div>
          </div>
          <ul className="grid gap-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="card flex gap-3 p-4">
                <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
                <span>
                  <span className="block font-semibold text-navy-900">{f.title}</span>
                  <span className="block text-sm text-muted">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </header>

      <div className="container-page prose-page max-w-3xl py-10 sm:py-14">
        {stores.length === 0 && (
          <Notice tone="info" title="The store app is on its way" className="mb-8">
            Our Android and iPhone app is not in the Google Play or App Store yet. Until it is, add the website to your home screen with the steps below. It works the same way and uses less storage.
          </Notice>
        )}
        <h2>Android (Chrome)</h2>
        <ol>
          <li>Open {brand.name} in Chrome.</li>
          <li>Tap the menu button (three dots) at the top right.</li>
          <li>Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>, then <strong>Add</strong>.</li>
        </ol>
        <h2>iPhone (Safari)</h2>
        <ol>
          <li>Open {brand.name} in Safari.</li>
          <li>Tap the Share button (a square with an arrow pointing up).</li>
          <li>Scroll down, tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
        </ol>
        <p className="mt-4">The {brand.name} icon then sits on your home screen next to your other apps.</p>
      </div>
    </div>
  );
}
