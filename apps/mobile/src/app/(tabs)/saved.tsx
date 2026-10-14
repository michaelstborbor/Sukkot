import { FlatList, RefreshControl } from "react-native";
import type { PropertySummaryDTO } from "@sukkot/shared";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { PropertyCard } from "@/components/property-card";
import { SignedOut } from "@/components/signed-out";
import { EmptyState, ErrorState, Loading } from "@/components/ui";

export default function SavedScreen() {
  const { user } = useAuth();
  const { data, error, loading, refreshing, reload } = useApi<{ items: PropertySummaryDTO[] }>(user ? "/favorites" : null);
  if (!user) return <SignedOut title="Save properties you like" body="Sign in to keep a shortlist across your phone and the website." />;
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  return (
    <FlatList
      data={data?.items ?? []}
      keyExtractor={(i) => i.id}
      renderItem={({ item }) => <PropertyCard p={item} />}
      contentContainerStyle={{ padding: 16, gap: 16, flexGrow: 1 }}
      ListEmptyComponent={<EmptyState title="Nothing saved yet" body="Tap the heart on a listing to save it here." />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
    />
  );
}
