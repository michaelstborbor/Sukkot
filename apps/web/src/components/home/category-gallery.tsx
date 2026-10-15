import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ImageDTO, PropertySummaryDTO } from "@sukkot/shared";
import { PropertyImage } from "@/components/property/property-image";
import { LogoMark } from "@/components/ui/logo";
import { Reveal } from "@/components/layout/reveal";

export interface GalleryRow {
  label: string;
  href: string;
  listings: PropertySummaryDTO[];
}

/**
 * Uploaded photos carry the mark in the image itself. Anything that does not yet (demo artwork, or a
 * photo the start-up backfill has not reached) gets the same mark laid over it here.
 */
function MarkOverlay({ image }: { image: ImageDTO }) {
  if (image.watermarked) return null;
  return (
    <span className="pointer-events-none absolute right-2.5 bottom-2.5 flex items-center gap-1.5 opacity-80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" aria-hidden>
      <LogoMark className="h-6 w-6" />
      <span className="font-display text-sm font-semibold text-white">
        Sukkot<span className="text-gold-500"> Salone</span>
      </span>
    </span>
  );
}

export function CategoryGallery({ rows }: { rows: GalleryRow[] }) {
  return (
    <div className="space-y-10">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h3 className="font-display text-xl font-semibold text-navy-900">{row.label}</h3>
            <Link href={row.href} className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline">
              See all <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {row.listings.map((p, i) => (
              <Reveal as="li" key={p.id} delay={i * 40}>
                <Link href={`/properties/${p.slug}`} className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-navy-50 transition hover:shadow-[var(--shadow-lift)]">
                  <PropertyImage image={p.coverImage} sizes="(min-width: 1024px) 25vw, 50vw" className="transition-transform duration-500 group-hover:scale-[1.04]" />
                  <span className="absolute inset-x-0 top-0 bg-gradient-to-b from-navy-950/75 to-transparent p-3 pb-8 text-white">
                    <span className="line-clamp-1 text-sm font-semibold">{p.title}</span>
                    <span className="block text-xs text-white/85">{p.price.formatted}</span>
                  </span>
                  {p.coverImage && <MarkOverlay image={p.coverImage} />}
                  {p.coverImage?.illustrative && <span className="sr-only">Illustrative image, not a photograph of the property.</span>}
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
