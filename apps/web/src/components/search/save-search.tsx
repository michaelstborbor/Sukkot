"use client";

import { useState } from "react";
import { BellPlus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function SaveSearchButton({ query, defaultName }: { query: string; defaultName: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      loading={pending}
      onClick={async () => {
        setPending(true);
        try {
          await api("/saved-searches", { body: { name: defaultName, queryString: query } });
          toast.success("Search saved. We will notify you when a new listing matches it.");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not save search");
        } finally {
          setPending(false);
        }
      }}
    >
      <BellPlus className="h-4 w-4" /> Save search
    </Button>
  );
}
