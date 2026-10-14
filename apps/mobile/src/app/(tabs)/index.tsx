import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  activeFilterCount,
  LISTING_PURPOSE_LABELS,
  LISTING_PURPOSES,
  parseSearchParams,
  serializeSearchParams,
  type Paginated,
  type PropertySummaryDTO,
  type SearchFilters,
} from "@sukkot/shared";
import { api, errorMessage } from "@/lib/api";
import { colors, radius } from "@/lib/theme";
import { PropertyCard } from "@/components/property-card";
import { Chip, EmptyState, ErrorState, Input, Loading, styles as ui } from "@/components/ui";

export default function ExploreScreen() {
  const params = useLocalSearchParams<Record<string, string>>();
  const filters = parseSearchParams(params as Record<string, string>);
  const qs = serializeSearchParams({ ...filters, page: undefined });
  const [q, setQ] = useState(filters.q ?? "");
  const [items, setItems] = useState<PropertySummaryDTO[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "more" | "refreshing">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextPage: number, mode: "loading" | "more" | "refreshing") => {
      setState(mode);
      try {
        const res = await api<Paginated<PropertySummaryDTO>>(`/properties?${qs}${qs ? "&" : ""}page=${nextPage}`);
        setItems((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items.filter((i) => !prev.some((p) => p.id === i.id))]));
        setPage(res.page);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setError(null);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setState("ready");
      }
    },
    [qs],
  );

  useEffect(() => {
    void load(1, "loading");
  }, [load]);

  const update = (patch: Partial<SearchFilters>) => {
    const next = serializeSearchParams({ ...filters, ...patch, page: undefined });
    // setParams merges, so clear keys that are no longer set.
    const cleared: Record<string, string | undefined> = Object.fromEntries(Object.keys(params).map((k) => [k, undefined]));
    router.setParams({ ...cleared, ...Object.fromEntries(new URLSearchParams(next)) });
  };
  const count = activeFilterCount(filters);

  return (
    <View style={{ flex: 1 }}>
      <View style={s.header}>
        <View style={s.searchRow}>
          <Input
            value={q}
            onChangeText={setQ}
            placeholder="Area, street or keyword"
            returnKeyType="search"
            onSubmitEditing={() => update({ q: q.trim() || undefined })}
            style={{ flex: 1 }}
            accessibilityLabel="Search listings"
          />
          <Pressable
            style={s.filterBtn}
            accessibilityRole="button"
            accessibilityLabel={`Filters${count ? `, ${count} active` : ""}`}
            onPress={() => router.push({ pathname: "/filters", params: { qs } })}
          >
            <Ionicons name="options-outline" size={20} color={colors.navy900} />
            {count ? <Text style={s.filterCount}>{count}</Text> : null}
          </Pressable>
        </View>
        <View style={ui.chipRow}>
          {LISTING_PURPOSES.map((p) => (
            <Chip key={p} label={LISTING_PURPOSE_LABELS[p]} selected={filters.purpose === p} onPress={() => update({ purpose: filters.purpose === p ? undefined : p })} />
          ))}
        </View>
      </View>
      {state === "loading" ? (
        <Loading />
      ) : error && !items.length ? (
        <ErrorState message={error} onRetry={() => load(1, "loading")} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <PropertyCard p={item} />}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          ListHeaderComponent={<Text style={ui.muted}>{total === 1 ? "1 property" : `${total.toLocaleString("en-GB")} properties`}</Text>}
          ListEmptyComponent={<EmptyState title="No properties match" body="Try removing a filter or searching a wider area." />}
          ListFooterComponent={state === "more" ? <ActivityIndicator color={colors.navy900} /> : null}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (state === "ready" && page < totalPages) void load(page + 1, "more");
          }}
          refreshControl={<RefreshControl refreshing={state === "refreshing"} onRefresh={() => load(1, "refreshing")} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { padding: 16, paddingBottom: 8, gap: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line },
  searchRow: { flexDirection: "row", gap: 8 },
  filterBtn: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  filterCount: { position: "absolute", top: 4, right: 4, backgroundColor: colors.gold500, borderRadius: 8, minWidth: 16, textAlign: "center", fontSize: 11, fontWeight: "700", color: colors.navy950 },
});
