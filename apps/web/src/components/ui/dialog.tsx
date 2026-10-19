"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible modal built on the native <dialog> element: focus trapping, Escape to close and
 * inert background come from the browser. On small screens it renders as a bottom sheet.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        "m-0 mt-auto w-full max-w-none rounded-t-2xl bg-surface p-0 shadow-[var(--shadow-pop)] backdrop:bg-navy-950/50 backdrop:backdrop-blur-[2px] open:animate-[fade-up_0.25s_ease-out]",
        "sm:m-auto sm:max-w-lg sm:rounded-2xl",
        className,
      )}
    >
      <div className="max-h-[88vh] overflow-y-auto p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="dialog-title" className="text-lg font-bold text-navy-900">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted transition hover:bg-navy-50 hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}
