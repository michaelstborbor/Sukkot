import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { brand } from "@/config/brand";
import { getCurrentActor } from "@/server/auth/actor";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/misc";

export const metadata: Metadata = { title: "List your property", description: `Reach tenants and buyers across Sierra Leone with ${brand.name}.` };

const STEPS = [
  ["Create a free account", "Sign up as a landlord, owner or agent."],
  ["Add your property", "Describe it honestly, set the price in Leones or US dollars, and upload clear photos."],
  ["Get reviewed", "Our moderators check every listing before it goes live, usually within one working day."],
  ["Talk to interested people", "Answer enquiries, confirm viewings and manage applications and offers in one place."],
];

export default async function ListYourPropertyPage() {
  const actor = await getCurrentActor();
  const href = actor ? "/dashboard/properties/new" : "/auth/sign-up?type=OWNER&next=/dashboard/properties/new";
  return (
    <>
      <section className="bg-navy-900 text-white">
        <div className="container-page py-16 sm:py-24">
          <p className="mb-3 text-xs font-bold tracking-[0.14em] text-gold-500 uppercase">For landlords, owners and agents</p>
          <h1 className="max-w-2xl font-display text-4xl font-semibold sm:text-5xl">List your property where serious tenants and buyers look.</h1>
          <p className="mt-4 max-w-xl text-lg text-white/75">Free to list. Reviewed listings, verified badges and tools for enquiries, viewings, applications and offers.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={href} variant="accent" size="lg">Start listing</ButtonLink>
            <ButtonLink href="/auth/sign-up?type=AGENT" variant="outline" size="lg" className="border-white/30 bg-transparent text-white hover:bg-white/10">I&apos;m an agent</ButtonLink>
          </div>
        </div>
      </section>
      <section className="container-page py-16">
        <SectionHeading eyebrow="How it works" title="Four steps to a live listing" />
        <ol className="grid gap-4 md:grid-cols-4">
          {STEPS.map(([t, b], i) => (
            <li key={t} className="card p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-100 font-bold text-gold-700">{i + 1}</span>
              <h3 className="mt-3 font-semibold text-navy-900">{t}</h3>
              <p className="mt-1 text-sm text-muted">{b}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="card p-6">
            <h3 className="font-bold text-navy-900">What you need</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {["Clear photos of every room or the whole plot", "The asking price or rent and how often it is paid", "Your authority to market the property", "Title or tenancy documents if you want a Documents Reviewed badge"].map((x) => (
                <li key={x} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /> {x}</li>
              ))}
            </ul>
          </div>
          <div className="card p-6">
            <h3 className="font-bold text-navy-900">Our rules</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>List only property you own or are authorised to market.</li>
              <li>Use real photos of the actual property.</li>
              <li>Keep availability up to date; mark it rented or sold promptly.</li>
              <li>Never ask anyone to pay before they have inspected the property.</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
