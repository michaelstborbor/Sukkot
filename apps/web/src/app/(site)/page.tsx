import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ArrowRight, BadgeCheck, Building2, Eye, FileCheck2, Hotel, Home as HomeIcon, Landmark, MapPin, MessagesSquare, ShieldCheck, Trees, UserCheck } from "lucide-react";
import { VERIFICATION_BADGES } from "@sukkot/shared";
import { brand } from "@/config/brand";
import { getCurrentActor } from "@/server/auth/actor";
import { listProperties } from "@/server/services/properties";
import { locationsWithCounts, popularAreas } from "@/server/services/catalog";
import { searchOptions } from "@/server/services/search-options";
import { savedIds } from "@/server/services/favorites";
import { db } from "@/server/db";
import { PropertyCard } from "@/components/property/property-card";
import { CompareBar } from "@/components/property/compare";
import { HeroSearch } from "@/components/search/hero-search";
import { HeroPhoto } from "@/components/home/hero-photo";
import { getSetting } from "@/server/services/settings";
import { HowItWorks } from "@/components/home/how-it-works";
import { Faq } from "@/components/home/faq";
import { CategoryGallery } from "@/components/home/category-gallery";
import { Reveal } from "@/components/layout/reveal";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, EmptyState, SectionHeading } from "@/components/ui/misc";
import { VerificationBadge } from "@/components/property/badges";

export const revalidate = 60;

const CATEGORIES = [
  { href: "/properties?category=HOUSE", label: "Houses", icon: HomeIcon, blurb: "Family homes and bungalows" },
  { href: "/properties?category=APARTMENT", label: "Apartments", icon: Building2, blurb: "Flats, rooms and studios" },
  { href: "/properties?category=LAND", label: "Land", icon: Trees, blurb: "Plots and farmland" },
  { href: "/properties?category=COMMERCIAL", label: "Commercial", icon: Landmark, blurb: "Shops, offices, warehouses" },
  { href: "/stays", label: "Short stays", icon: Hotel, blurb: "Book hotels, guest houses and homes" },
];

/** Photo rows on the home page, one per kind of property. Rows with no photographed listing are left out. */
const GALLERY = [
  { label: "Houses", href: "/properties?category=HOUSE", where: { category: "HOUSE" } },
  { label: "Apartments", href: "/properties?category=APARTMENT", where: { category: "APARTMENT" } },
  { label: "Land", href: "/properties?category=LAND", where: { category: "LAND" } },
  { label: "Commercial", href: "/properties?category=COMMERCIAL", where: { category: "COMMERCIAL" } },
  { label: "Short stays", href: "/properties?purpose=SHORT_STAY", where: { OR: [{ category: "SHORT_STAY" }, { purpose: "SHORT_STAY" }] } },
  { label: "Other property", href: "/properties?category=OTHER", where: { category: "OTHER" } },
] satisfies { label: string; href: string; where: Prisma.PropertyWhereInput }[];

export default async function HomePage() {
  const actor = await getCurrentActor();
  const [featured, recent, districts, options, agents, galleryListings, areas] = await Promise.all([
    listProperties({ isFeatured: true }, 6, [{ publishedAt: "desc" }]),
    listProperties({}, 8, [{ publishedAt: "desc" }]),
    locationsWithCounts("DISTRICT"),
    searchOptions(),
    db.user.findMany({
      where: { status: "ACTIVE", roles: { some: { role: "AGENT" } }, verificationRequests: { some: { kind: "AGENT_CREDENTIALS", status: "VERIFIED" } } },
      include: { profile: true, agencyMemberships: { include: { agency: true } }, _count: { select: { listedProperties: { where: { listingStatus: "PUBLISHED" } } } } },
      take: 4,
    }),
    Promise.all(GALLERY.map((g) => listProperties({ ...g.where, images: { some: {} } }, 4, [{ publishedAt: "desc" }]))),
    popularAreas(),
  ]);
  const gallery = GALLERY.map((g, i) => ({ label: g.label, href: g.href, listings: galleryListings[i]! })).filter((g) => g.listings.length > 0);
  const saved = await savedIds(actor?.id, [...featured, ...recent].map((p) => p.id));
  const hero = await getSetting("site.heroImage");
  const topDistricts = districts.sort((a, b) => b.count - a.count).slice(0, 8);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-navy-900 text-[#f9f4ec]">
        <HeroPhoto hero={hero} />
        <div className="container-page relative pt-24 pb-28 sm:pt-40 sm:pb-36">
          <div className="max-w-2xl animate-[fade-up_0.6s_ease-out_both]">
            <h1 className="font-display text-5xl leading-[1.05] sm:text-6xl">{brand.heroTitle}</h1>
            <p className="mt-4 max-w-lg text-lg text-[#f9f4ec]/85">{brand.heroSubtitle}</p>
          </div>
          <HeroSearch locations={options.locations} className="mt-8 animate-[fade-up_0.6s_0.12s_ease-out_both]" />
          <p className="mt-4 flex items-center gap-2 text-sm text-[#f9f4ec]/75">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Checked listings, direct contact, no hidden fees
          </p>
        </div>
      </section>

      {/* Quick categories */}
      <section className="container-page mt-14">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((c, i) => (
            <Reveal as="li" key={c.label} delay={i * 50}>
              <Link href={c.href} className="group flex h-full items-center gap-3 rounded-xl border border-line bg-surface p-4 transition hover:border-clay-600">
                <c.icon className="h-5 w-5 shrink-0 text-clay-600" aria-hidden />
                <span>
                  <span className="block font-medium text-ink">{c.label}</span>
                  <span className="block text-xs text-muted">{c.blurb}</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* Area shortcuts */}
      {areas.length > 0 && (
        <nav aria-labelledby="popular-areas" className="container-page mt-8">
          <h2 id="popular-areas" className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">Popular areas</h2>
          <ul className="flex flex-wrap gap-2">
            {areas.map((a) => (
              <li key={a.slug}>
                <Link href={`/properties?locality=${a.slug}`} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-ink ring-1 ring-line transition hover:ring-clay-600">
                  <MapPin className="h-3.5 w-3.5 text-clay-600" aria-hidden />
                  {a.name}
                  {a.count > 0 && <span className="text-xs text-muted">{a.count}</span>}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/locations" className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-clay-700 hover:underline">
                All areas <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </li>
          </ul>
        </nav>
      )}

      {/* Photos by category */}
      {gallery.length > 0 && (
        <section className="container-page mt-20">
          <SectionHeading eyebrow="Browse" title="Photos from every category" body="A look at homes, land and more listed across Salone. Search or pick a filter to narrow it down." />
          <CategoryGallery rows={gallery} />
        </section>
      )}

      {/* Featured */}
      <section className="container-page mt-20">
        <SectionHeading eyebrow="Featured" title="Handpicked properties" body="Promoted listings from owners and agents across the country." action={<ButtonLink href="/properties" variant="outline">View all <ArrowRight className="h-4 w-4" /></ButtonLink>} />
        {featured.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p, i) => (
              <Reveal key={p.id} delay={i * 60}>
                <PropertyCard p={p} saved={saved.has(p.id)} priority={i < 3} />
              </Reveal>
            ))}
          </div>
        ) : (
          <EmptyState title="No featured properties yet" body="Featured listings will appear here." />
        )}
      </section>

      {/* Locations */}
      <section className="container-page mt-24">
        <SectionHeading eyebrow="Explore" title="Explore by location" body="From the Western Area to Kono, find property where you want to live and work." action={<ButtonLink href="/locations" variant="outline">All locations</ButtonLink>} />
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {topDistricts.map((d, i) => (
            <Reveal as="li" key={d.id} delay={i * 40}>
              <Link href={`/locations/${d.slug}`} className="group relative flex h-32 flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br from-navy-800 to-clay-700 p-4 text-white transition hover:shadow-[var(--shadow-lift)]">
                <svg viewBox="0 0 200 80" className="absolute inset-x-0 top-0 h-20 w-full opacity-25 transition-transform duration-500 group-hover:scale-110" aria-hidden>
                  <path d={`M0 60 Q 50 ${20 + (i % 3) * 10} 100 45 T 200 ${30 + (i % 4) * 8} V80 H0Z`} fill="#fff" />
                </svg>
                <span className="relative font-semibold">{d.name}</span>
                <span className="relative text-sm text-white/75">{d.count} {d.count === 1 ? "listing" : "listings"}</span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section className="mt-24 bg-gradient-to-b from-surface to-canvas py-20">
        <div className="container-page">
          <SectionHeading eyebrow="How it works" title="Simple steps, fewer surprises" className="sm:justify-center sm:text-center [&>div]:mx-auto" />
          <HowItWorks />
        </div>
      </section>

      {/* Recently added */}
      <section className="container-page mt-12">
        <SectionHeading eyebrow="Just listed" title="Recently added" action={<ButtonLink href="/properties?sort=newest" variant="outline">See newest</ButtonLink>} />
        {recent.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((p, i) => (
              <Reveal key={p.id} delay={(i % 4) * 50}>
                <PropertyCard p={p} saved={saved.has(p.id)} />
              </Reveal>
            ))}
          </div>
        ) : (
          <EmptyState title="No listings yet" body="Be the first to list a property." action={<ButtonLink href="/list-your-property">List a property</ButtonLink>} />
        )}
      </section>

      {/* Verification */}
      <section className="container-page mt-24">
        <div className="grid items-center gap-10 overflow-hidden rounded-3xl bg-navy-900 p-8 text-white sm:p-12 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold tracking-[0.14em] text-clay-500 uppercase">Verified properties</p>
            <h2 className="font-display text-3xl sm:text-4xl">Trust you can check</h2>
            <p className="mt-4 text-white/80">Every badge on {brand.name} means a specific check by our verification team, based on evidence the lister provided. We tell you exactly what each badge covers and what it does not.</p>
            <ButtonLink href="/verification" variant="accent" className="mt-6">How verification works</ButtonLink>
          </div>
          <ul className="space-y-3">
            {(["IDENTITY", "AGENT_CREDENTIALS", "PROPERTY_DOCUMENTS"] as const).map((k) => (
              <li key={k} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="flex items-center gap-2 font-semibold">
                  {k === "IDENTITY" ? <UserCheck className="h-5 w-5 text-emerald-100" /> : k === "AGENT_CREDENTIALS" ? <BadgeCheck className="h-5 w-5 text-emerald-100" /> : <FileCheck2 className="h-5 w-5 text-emerald-100" />}
                  {VERIFICATION_BADGES[k].label}
                </div>
                <p className="mt-1 text-sm text-white/75">{VERIFICATION_BADGES[k].means}</p>
                <p className="mt-1 text-xs text-gold-100/80">{VERIFICATION_BADGES[k].doesNotMean}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Agents */}
      {agents.length > 0 && (
        <section className="container-page mt-24">
          <SectionHeading eyebrow="Professionals" title="Featured agents" action={<ButtonLink href="/agents" variant="outline">All agents</ButtonLink>} />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {agents.map((a) => (
              <li key={a.id}>
                <Link href={`/agents/${a.id}`} className="card flex h-full flex-col items-center p-6 text-center transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
                  <Avatar name={a.profile?.fullName ?? "Agent"} size={64} />
                  <p className="mt-3 font-semibold text-navy-900">{a.profile?.fullName}</p>
                  <p className="text-sm text-muted">{a.agencyMemberships[0]?.agency.name ?? "Independent agent"}</p>
                  <div className="mt-3"><VerificationBadge kind="AGENT_CREDENTIALS" /></div>
                  <p className="mt-3 text-xs text-muted">{a._count.listedProperties} active listings</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Why us */}
      <section className="container-page mt-24">
        <SectionHeading eyebrow="Why Sukkot Salone" title="Built for how property works in Salone" />
        <ul className="grid gap-8 rounded-2xl bg-sand p-8 sm:grid-cols-2 sm:p-12 lg:grid-cols-4">
          {[
            { icon: ShieldCheck, title: "Trust first", body: "Moderated listings, evidence-based verification and fast fraud reporting." },
            { icon: MessagesSquare, title: "Talk directly", body: "Message owners and agents, or call and WhatsApp where they share a number." },
            { icon: Eye, title: "Transparent", body: "Clear prices in Leones, rental terms up front and a timeline for every offer." },
            { icon: Building2, title: "Light on data", body: "Fast pages and compressed images that work on 3G and low data bundles." },
          ].map((f, i) => (
            <Reveal as="li" key={f.title} delay={i * 50}>
              <f.icon className={`h-8 w-8 ${i % 2 ? "text-clay-600" : "text-emerald-600"}`} aria-hidden />
              <h3 className="mt-3 font-display text-2xl text-ink">{f.title}</h3>
              <p className="mt-2 text-muted">{f.body}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* Owner CTA */}
      <section className="container-page mt-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-clay-700 to-clay-600 p-8 text-white sm:p-12">
          <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-gold-500/25 blur-2xl" aria-hidden />
          <div className="relative max-w-2xl">
            <h2 className="font-display text-3xl sm:text-4xl">Have a property to rent, sell or lease?</h2>
            <p className="mt-3 text-white/85">Reach serious tenants and buyers across Sierra Leone. Listing is free to start, and you manage enquiries, inspections and applications in one dashboard.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/list-your-property" variant="accent" size="lg">List your property</ButtonLink>
              <ButtonLink href="/auth/sign-up?type=AGENT" variant="outline" size="lg" className="border-white/30 bg-transparent text-white hover:bg-white/10">I&apos;m an agent</ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-page mt-24 max-w-4xl">
        <SectionHeading eyebrow="FAQ" title="Questions people ask" />
        <Faq />
      </section>
      <CompareBar />
    </>
  );
}
