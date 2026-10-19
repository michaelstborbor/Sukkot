"use client";

import { useEffect, useRef, useState } from "react";
import type { ImageDTO } from "@sukkot/shared";
import { LogoMark } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

/** Shown when a listing has no photo, or its photo file cannot be loaded. */
function PhotoFallback({ className, label }: { className?: string; label: string }) {
  return (
    <div className={cn("flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-navy-50 to-emerald-50 text-sm text-muted", className)}>
      <LogoMark className="h-8 w-8 opacity-60" />
      <span>{label}</span>
    </div>
  );
}

/** Responsive image using the pre-generated 480/960/1600 WebP variants. Lazy by default. */
export function PropertyImage({ image, sizes, className, priority = false }: { image: ImageDTO | null; sizes: string; className?: string; priority?: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  // A photo that failed before the page became interactive never fires onError, so check once on mount.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (!image) return <PhotoFallback className={className} label="No photo yet" />;
  if (failed) {
    // The blurred preview is stored with the listing, so it can still stand in for a lost photo.
    return image.placeholder ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image.placeholder} alt={image.alt} className={cn("h-full w-full object-cover", className)} />
    ) : (
      <PhotoFallback className={className} label="Photo unavailable" />
    );
  }
  const isSvg = image.url.endsWith(".svg");
  const srcSet = isSvg ? undefined : `${image.thumbUrl} 480w, ${image.url.replace(/-1600\.webp$/, "-960.webp")} 960w, ${image.url} 1600w`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={isSvg ? image.url : image.url.replace(/-1600\.webp$/, "-960.webp")}
      srcSet={srcSet}
      sizes={sizes}
      alt={image.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      width={image.width ?? 1600}
      height={image.height ?? 1200}
      onError={() => setFailed(true)}
      // The blurred preview fills the space at once; the photo paints over it when it arrives.
      style={image.placeholder ? { backgroundImage: `url(${image.placeholder})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
