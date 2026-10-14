"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import type { ImageDTO } from "@sukkot/shared";
import { cn } from "@/lib/utils";
import { PropertyImage } from "./property-image";

export function Gallery({ images, title }: { images: ImageDTO[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState(false);
  const touch = useRef<number | null>(null);
  const n = images.length;
  const go = useCallback((d: number) => setIndex((i) => (i + d + n) % n), [n]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [full, go]);

  if (!n) return <div className="flex aspect-[16/9] items-center justify-center rounded-2xl bg-navy-50 text-muted">No photos yet</div>;
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => (touch.current = e.touches[0]!.clientX),
    onTouchEnd: (e: React.TouchEvent) => {
      if (touch.current === null) return;
      const dx = e.changedTouches[0]!.clientX - touch.current;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      touch.current = null;
    },
  };
  const illustrative = images[index]?.illustrative;

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-navy-50" {...swipe}>
        <button type="button" onClick={() => setFull(true)} className="group block aspect-[16/10] w-full sm:aspect-[16/9]" aria-label="Open full-screen gallery">
          <PropertyImage key={images[index]!.id} image={images[index]!} sizes="(min-width: 1024px) 66vw, 100vw" priority className="animate-[fade-in_0.3s]" />
          <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-navy-950/70 px-3 py-1.5 text-xs font-semibold text-white">
            <Expand className="h-3.5 w-3.5" aria-hidden /> {index + 1} / {n}
          </span>
        </button>
        {illustrative && <span className="absolute top-3 left-3 rounded-full bg-gold-500 px-2.5 py-1 text-xs font-bold text-navy-950">Illustrative image, not a photo</span>}
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow transition hover:scale-105" aria-label="Previous photo"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => go(1)} className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow transition hover:scale-105" aria-label="Next photo"><ChevronRight className="h-5 w-5" /></button>
          </>
        )}
      </div>
      {n > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button type="button" onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === index} className={cn("block h-16 w-24 overflow-hidden rounded-lg ring-2 transition", i === index ? "ring-emerald-600" : "ring-transparent opacity-75 hover:opacity-100")}>
                <PropertyImage image={{ ...img, url: img.thumbUrl }} sizes="96px" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {full && (
        <div role="dialog" aria-modal="true" aria-label={`${title} photos`} className="fixed inset-0 z-50 flex animate-[fade-in_0.2s] flex-col bg-navy-950/97" {...swipe}>
          <div className="flex items-center justify-between p-4 text-white">
            <span className="text-sm">{index + 1} / {n}</span>
            <button type="button" onClick={() => setFull(false)} className="rounded-full p-2 hover:bg-white/10" aria-label="Close gallery" autoFocus><X className="h-6 w-6" /></button>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-2 pb-6 sm:px-16">
            <PropertyImage key={`f-${images[index]!.id}`} image={images[index]!} sizes="100vw" className="max-h-full w-auto animate-[fade-in_0.25s] object-contain" />
            {n > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} className="absolute left-2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:left-4" aria-label="Previous photo"><ChevronLeft className="h-6 w-6" /></button>
                <button type="button" onClick={() => go(1)} className="absolute right-2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:right-4" aria-label="Next photo"><ChevronRight className="h-6 w-6" /></button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
