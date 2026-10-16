"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitCompareArrows, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const KEY = "ss_compare";
const MAX = 4;
const EVENT = "ss-compare-change";

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function write(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(EVENT));
}

function useCompare() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return ids;
}

export function CompareToggle({ propertyId, className }: { propertyId: string; className?: string }) {
  const ids = useCompare();
  const active = ids.includes(propertyId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const cur = read();
        if (cur.includes(propertyId)) return write(cur.filter((i) => i !== propertyId));
        if (cur.length >= MAX) return toast.info(`You can compare up to ${MAX} properties`);
        write([...cur, propertyId]);
      }}
      aria-pressed={active}
      title={active ? "Remove from comparison" : "Add to comparison"}
      aria-label={active ? "Remove from comparison" : "Add to comparison"}
      className={cn("inline-flex items-center rounded-full bg-white/95 p-2 text-navy-900 shadow-sm ring-1 ring-black/5 transition hover:scale-105 active:scale-95", active && "bg-emerald-700 text-white", className)}
    >
      <GitCompareArrows className="h-5 w-5" aria-hidden />
    </button>
  );
}

export function CompareBar() {
  const ids = useCompare();
  if (ids.length === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-20 z-30 sm:bottom-4 flex justify-center px-4">
      <div className="flex animate-[fade-up_0.25s_ease-out] items-center gap-3 rounded-full bg-navy-900 py-2 pr-2 pl-5 text-sm text-white shadow-[var(--shadow-pop)]">
        <span>
          {ids.length} selected to compare
        </span>
        <Link href={`/compare?ids=${ids.join(",")}`} className="rounded-full bg-gold-500 px-4 py-2 font-semibold text-navy-950 hover:bg-gold-100">
          Compare
        </Link>
        <button type="button" onClick={() => write([])} className="rounded-full p-1.5 hover:bg-white/10" aria-label="Clear comparison">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
