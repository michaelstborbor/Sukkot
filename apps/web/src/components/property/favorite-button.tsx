"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export function FavoriteButton({ propertyId, initial = false, className, withLabel = false }: { propertyId: string; initial?: boolean; className?: string; withLabel?: boolean }) {
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !saved;
    setSaved(next);
    start(async () => {
      try {
        await api("/favorites", { body: { propertyId, save: next } });
        toast.success(next ? "Saved to your favourites" : "Removed from favourites");
      } catch (err) {
        setSaved(!next);
        if (err instanceof ApiError && err.status === 401) {
          router.push(`/auth/sign-in?next=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        toast.error(err instanceof Error ? err.message : "Could not update favourites");
      }
    });
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? "Remove from favourites" : "Save to favourites"}
      title={saved ? "Remove from favourites" : "Save to favourites"}
      className={cn(
        "group/fav inline-flex items-center gap-2 rounded-full bg-white/95 p-2 text-navy-900 shadow-sm ring-1 ring-black/5 transition hover:scale-105 active:scale-95",
        withLabel && "px-4 py-2.5 text-sm font-semibold",
        className,
      )}
    >
      <Heart className={cn("h-5 w-5 transition-all duration-200", saved ? "scale-110 fill-red-500 text-red-500" : "group-hover/fav:text-red-500")} aria-hidden />
      {withLabel && (saved ? "Saved" : "Save")}
    </button>
  );
}
