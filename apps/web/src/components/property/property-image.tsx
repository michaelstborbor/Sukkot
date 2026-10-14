import type { ImageDTO } from "@sukkot/shared";
import { cn } from "@/lib/utils";

/** Responsive image using the pre-generated 480/960/1600 WebP variants. Lazy by default. */
export function PropertyImage({ image, sizes, className, priority = false }: { image: ImageDTO | null; sizes: string; className?: string; priority?: boolean }) {
  if (!image) {
    return <div className={cn("flex items-center justify-center bg-navy-50 text-sm text-muted", className)}>No photo yet</div>;
  }
  const isSvg = image.url.endsWith(".svg");
  const srcSet = isSvg ? undefined : `${image.thumbUrl} 480w, ${image.url.replace(/-1600\.webp$/, "-960.webp")} 960w, ${image.url} 1600w`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={isSvg ? image.url : image.url.replace(/-1600\.webp$/, "-960.webp")}
      srcSet={srcSet}
      sizes={sizes}
      alt={image.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      width={image.width ?? 1600}
      height={image.height ?? 1200}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
