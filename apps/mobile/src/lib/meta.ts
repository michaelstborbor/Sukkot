import { useEffect, useState } from "react";
import type { PaymentMethod, PropertyCategory } from "@sukkot/shared";
import { api } from "./api";

export interface Meta {
  types: { id: string; name: string; slug: string; category: PropertyCategory }[];
  amenities: { id: string; name: string; slug: string; group: string }[];
  locations: { id: string; name: string; slug: string; level: string; parentId: string | null; isCity?: boolean }[];
  paymentMethods: PaymentMethod[];
}

let cached: Meta | null = null;
let inflight: Promise<Meta> | null = null;

/** Reference data (types, locations, payment methods), fetched once per app session. */
export function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(cached);
  useEffect(() => {
    if (cached) return;
    inflight ??= api<Meta>("/meta").then((m) => (cached = m));
    inflight.then(setMeta).catch(() => {
      inflight = null;
    });
  }, []);
  return meta;
}
