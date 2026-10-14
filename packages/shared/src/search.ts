import { z } from "zod";
import {
  CURRENCIES,
  ELECTRICITY,
  FURNISHING,
  LISTING_PURPOSES,
  PROPERTY_CATEGORIES,
  SORT_OPTIONS,
  WATER_SUPPLY,
} from "./enums";

/**
 * Search filters as they appear in the URL (`/properties?purpose=RENT&district=western-area-urban`).
 * Parsing is lenient: unknown or malformed values are dropped rather than failing the page,
 * so a shared link always renders.
 */
const csv = <T extends string>(values: readonly T[]) =>
  z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(",")).map((s) => s.trim()).filter(Boolean))
    .transform((arr) => arr.filter((s): s is T => (values as readonly string[]).includes(s)));

const slugList = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(",")).map((s) => s.trim().toLowerCase()).filter((s) => /^[a-z0-9-]{1,80}$/.test(s)));

const posNumber = z.coerce.number().finite().nonnegative();
const posInt = z.coerce.number().int().nonnegative().max(1000);
const bool = z.union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")]).transform((v) => v === "1" || v === "true");

export const searchFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  purpose: z.enum(LISTING_PURPOSES).optional(),
  category: z.enum(PROPERTY_CATEGORIES).optional(),
  type: slugList.optional(),
  province: z.string().max(80).optional(),
  district: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  locality: z.string().max(80).optional(),
  minPrice: posNumber.optional(),
  maxPrice: posNumber.optional(),
  currency: z.enum(CURRENCIES).optional(),
  beds: posInt.optional(),
  baths: posInt.optional(),
  minArea: posNumber.optional(),
  maxArea: posNumber.optional(),
  minPlot: posNumber.optional(),
  maxPlot: posNumber.optional(),
  furnishing: csv(FURNISHING).optional(),
  amenities: slugList.optional(),
  water: csv(WATER_SUPPLY).optional(),
  power: csv(ELECTRICITY).optional(),
  parking: bool.optional(),
  verified: bool.optional(),
  listedBy: z.enum(["OWNER", "AGENT"]).optional(),
  listedWithin: z.coerce.number().int().refine((n) => [1, 3, 7, 14, 30, 90].includes(n)).optional(),
  availableOnly: bool.optional(),
  sort: z.enum(SORT_OPTIONS).optional(),
  view: z.enum(["grid", "list", "map"]).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
  perPage: z.coerce.number().int().min(6).max(48).optional(),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;

export const DEFAULT_PER_PAGE = 12;

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function toRecord(params: RawParams): Record<string, string | string[]> {
  if (params instanceof URLSearchParams) {
    const out: Record<string, string | string[]> = {};
    for (const key of new Set(params.keys())) {
      const all = params.getAll(key);
      out[key] = all.length > 1 ? all : all[0]!;
    }
    return out;
  }
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") out[k] = v;
  return out;
}

/** Parse URL params into filters, dropping invalid keys individually. */
export function parseSearchParams(params: RawParams): SearchFilters {
  const raw = toRecord(params);
  const shape = searchFiltersSchema.shape;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    const value = raw[key];
    if (value === undefined) continue;
    const single = Array.isArray(value) && !["type", "amenities", "furnishing", "water", "power"].includes(key) ? value[0] : value;
    const parsed = (shape[key] as z.ZodTypeAny).safeParse(single);
    if (parsed.success && parsed.data !== undefined) {
      if (Array.isArray(parsed.data) && parsed.data.length === 0) continue;
      result[key] = parsed.data;
    }
  }
  const filters = result as SearchFilters;
  if (filters.minPrice !== undefined && filters.maxPrice !== undefined && filters.minPrice > filters.maxPrice) {
    [filters.minPrice, filters.maxPrice] = [filters.maxPrice, filters.minPrice];
  }
  return filters;
}

/** Serialise filters back to a stable query string (sorted keys, defaults omitted). */
export function serializeSearchParams(filters: Partial<SearchFilters>): string {
  const params = new URLSearchParams();
  const keys = Object.keys(filters).sort() as (keyof SearchFilters)[];
  for (const key of keys) {
    const value = filters[key];
    if (value === undefined || value === null || value === "") continue;
    if (key === "page" && value === 1) continue;
    if (key === "sort" && value === "relevant") continue;
    if (key === "view" && value === "grid") continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
    } else if (typeof value === "boolean") {
      if (value) params.set(key, "1");
    } else {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

/** Count of filters the user has actively set (for the "Filters (3)" button). */
export function activeFilterCount(filters: SearchFilters): number {
  const ignored = new Set(["sort", "view", "page", "perPage", "q", "purpose"]);
  return Object.entries(filters).filter(([k, v]) => !ignored.has(k) && v !== undefined && !(Array.isArray(v) && !v.length))
    .length;
}
