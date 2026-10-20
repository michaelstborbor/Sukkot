import { FlatList, Linking, RefreshControl, Text } from "react-native";
import { Link } from "expo-router";
import { formatDateTime, formatMoney, type InspectionDTO } from "@sukkot/shared";
import { API_URL } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { StatusBadge } from "@/components/status";
import { WorkflowActions } from "@/components/workflow-actions";
import { Card, EmptyState, ErrorState, Loading, styles as ui } from "@/components/ui";

export default function InspectionsScreen() {
  const { data, error, loading, refreshing, reload } = useApi<{ items: InspectionDTO[] }>("/inspections");
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  return (
    <FlatList
      data={data?.items ?? []}
      keyExtractor={(i) => i.id}
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      ListEmptyComponent={<EmptyState title="No viewings yet" body="Book a viewing from any listing." />}
      renderItem={({ item: i }) => (
        <Card>
          <StatusBadge status={i.status} />
          <Link href={{ pathname: "/property/[slug]", params: { slug: i.property.slug } }} style={[ui.body, { fontWeight: "700" }]}>
            {i.property.title}
          </Link>
          <Text style={ui.body}>{formatDateTime(i.scheduledAt)} (Freetown time)</Text>
          {i.status === "RESCHEDULE_PROPOSED" && i.proposedAt ? <Text style={ui.body}>New time proposed: {formatDateTime(i.proposedAt)}</Text> : null}
          <Text style={ui.muted}>{i.myRole === "REQUESTER" ? "You requested this viewing" : `Requested by ${i.requester.name}`}</Text>
          {i.notes ? <Text style={ui.muted}>“{i.notes}”</Text> : null}
          {i.myRole === "REQUESTER" && i.fee && !i.fee.paid && ["REQUESTED", "RESCHEDULE_PROPOSED", "CONFIRMED"].includes(i.status) ? (
            <Text style={[ui.body, { fontWeight: "700" }]} onPress={() => Linking.openURL(`${API_URL}/dashboard/inspections`)}>
              Pay the {formatMoney(BigInt(i.fee.amountMinor), i.fee.currency)} booking fee on the website to send this request →
            </Text>
          ) : null}
          <WorkflowActions kind="inspection" endpoint={`/inspections/${i.id}`} actions={i.actions} onDone={reload} />
        </Card>
      )}
    />
  );
}
