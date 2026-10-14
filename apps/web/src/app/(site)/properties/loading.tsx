import { PropertyCardSkeleton } from "@/components/property/property-card";

export default function Loading() {
  return (
    <div className="container-page py-8" aria-busy="true" aria-label="Loading properties">
      <div className="skeleton mb-2 h-9 w-2/3 max-w-lg rounded" />
      <div className="skeleton mb-8 h-4 w-40 rounded" />
      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        <div className="skeleton hidden h-[600px] rounded-2xl lg:block" />
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <PropertyCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
