import { handler } from "@/server/http";
import { getCatalog } from "@/server/services/catalog";
import { availableOnlineMethods } from "@/server/payments";

/** Reference data for clients (property types, amenities, locations, enabled payment methods). */
export const GET = handler(async () => {
  const { types, amenities, locations } = await getCatalog();
  return {
    types: types.map((t) => ({ id: t.id, name: t.name, slug: t.slug, category: t.category })),
    amenities: amenities.map((a) => ({ id: a.id, name: a.name, slug: a.slug, group: a.group })),
    locations,
    paymentMethods: await availableOnlineMethods(),
  };
});
