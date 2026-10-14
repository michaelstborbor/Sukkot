import { FlatList, RefreshControl, Text, View } from "react-native";
import { Link } from "expo-router";
import { formatDateTime, NOTICES, type OfferDTO } from "@sukkot/shared";
import { humanize } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { StatusBadge } from "@/components/status";
import { WorkflowActions } from "@/components/workflow-actions";
import { Card, EmptyState, ErrorState, Loading, Notice, styles as ui } from "@/components/ui";

export default function OffersScreen() {
  const { data, error, loading, refreshing, reload } = useApi<{ items: OfferDTO[] }>("/offers");
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  return (
    <FlatList
      data={data?.items ?? []}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      ListHeaderComponent={<Notice>{NOTICES.offerNotLegal}</Notice>}
      ListEmptyComponent={<EmptyState title="No offers" body="Make an offer from any listing for sale." />}
      renderItem={({ item: o }) => (
        <Card>
          <StatusBadge status={o.status} />
          <Link href={{ pathname: "/property/[slug]", params: { slug: o.property.slug } }} style={[ui.body, { fontWeight: "700" }]}>
            {o.property.title}
          </Link>
          <Text style={ui.body}>
            Current offer <Text style={{ fontWeight: "700" }}>{o.currentAmount.formatted}</Text> · asking {o.askingPrice.formatted}
          </Text>
          <Text style={ui.muted}>
            {o.myRole === "BUYER" ? "Your offer" : `From ${o.buyer.name}`} · {humanize(o.paymentArrangement)}
            {o.expiresAt ? ` · expires ${formatDateTime(o.expiresAt)}` : ""}
          </Text>
          <View style={{ gap: 4, marginVertical: 4 }}>
            {o.events.slice(-3).map((e) => (
              <Text key={e.id} style={[ui.muted, { fontSize: 13 }]}>
                {formatDateTime(e.createdAt)} · {e.actorName}: {humanize(e.type)}
                {e.amount ? ` ${e.amount.formatted}` : ""}
                {e.message ? ` – “${e.message}”` : ""}
              </Text>
            ))}
          </View>
          <WorkflowActions kind="offer" endpoint={`/offers/${o.id}`} actions={o.actions} currency={o.currentAmount.currency} onDone={reload} />
        </Card>
      )}
    />
  );
}
