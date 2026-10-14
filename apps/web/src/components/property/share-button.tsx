"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ShareButton({ title, path }: { title: string; path: string }) {
  return (
    <Button
      variant="outline"
      onClick={async () => {
        const url = `${window.location.origin}${path}`;
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
          } catch {
            /* user cancelled */
          }
          return;
        }
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }}
    >
      <Share2 className="h-4 w-4" /> Share
    </Button>
  );
}
