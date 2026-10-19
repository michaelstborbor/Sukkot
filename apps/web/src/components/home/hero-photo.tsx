import type { HeroImageSettings } from "@/server/services/settings";
import { publicFileUrl } from "@/server/storage";

/** Bundled default: an illustrative hillside view at sunset, shown until an admin uploads a photo. */
const DEFAULT_HERO = {
  src: "/hero/salone-hillside-1280.webp",
  srcSet: [768, 1280, 1600].map((w) => `/hero/salone-hillside-${w}.webp ${w}w`).join(", "),
  alt: "Hillside homes above the sea at sunset",
  width: 1600,
  height: 912,
  placeholder:
    "data:image/webp;base64,UklGRpAAAABXRUJQVlA4IIQAAABwBACdASoYAA4APu1iqU2ppaOiMAgBMB2JbACdMoRwFf/qUAJbuixLqtxMMAD3cUQXEU9bLFxYHgPcm1dLK72pnAyhFbNDH1eJ2fuJCN6f08lbWPtgn0p7ON+GZ90u0z6YsLwyIxYs18W8EEQNPKBNPU4onHyONUwOBUqIPSafQTJAAAA=",
};

/**
 * The homepage background photo: the one uploaded in Admin → Site settings, or the bundled default.
 * The browser picks the smallest stored width that fills the screen (768 px on most phones, larger on
 * big and high-density screens). The blurred preview shows at once while it loads.
 */
export function HeroPhoto({ hero }: { hero: HeroImageSettings | null }) {
  const img = hero
    ? (() => {
        const url = (w: number) => publicFileUrl(`${hero.baseKey}-${w}.webp`);
        const fallback = hero.widths.find((w) => w >= 1280) ?? hero.widths[hero.widths.length - 1]!;
        return { src: url(fallback), srcSet: hero.widths.map((w) => `${url(w)} ${w}w`).join(", "), alt: hero.alt, width: hero.width, height: hero.height, placeholder: hero.placeholder };
      })()
    : DEFAULT_HERO;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.src}
        srcSet={img.srcSet}
        sizes="100vw"
        alt={img.alt}
        width={img.width}
        height={img.height}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        style={{ backgroundImage: `url(${img.placeholder})`, backgroundSize: "cover", backgroundPosition: "center" }}
      />
      {/* Darkens the left side (and the whole photo on phones) so the heading and search stay readable. */}
      <div className="bg-hero-fade absolute inset-0 -z-10" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-navy-950/35 sm:hidden" aria-hidden />
    </>
  );
}
