import type { HeroImageSettings } from "@/server/services/settings";
import { publicFileUrl } from "@/server/storage";

/**
 * The homepage background photo. The browser picks the smallest stored width that fills the screen
 * (768 px on most phones, 1920 or 2560 px on large and high-density screens). The blurred preview
 * shows at once while it loads.
 */
export function HeroPhoto({ hero }: { hero: HeroImageSettings }) {
  const url = (w: number) => publicFileUrl(`${hero.baseKey}-${w}.webp`);
  const fallback = hero.widths.find((w) => w >= 1280) ?? hero.widths[hero.widths.length - 1]!;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url(fallback)}
        srcSet={hero.widths.map((w) => `${url(w)} ${w}w`).join(", ")}
        sizes="100vw"
        alt={hero.alt}
        width={hero.width}
        height={hero.height}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ backgroundImage: `url(${hero.placeholder})`, backgroundSize: "cover", backgroundPosition: "center" }}
      />
      {/* Darkens the photo so the heading and search stay readable whatever the picture. */}
      <div className="absolute inset-0 bg-navy-950/45" aria-hidden />
    </>
  );
}
