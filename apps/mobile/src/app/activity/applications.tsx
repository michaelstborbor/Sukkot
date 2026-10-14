import { FlatList, RefreshControl, Text } from "react-native";
import { Link } from "expo-router";
import { formatDate, type ApplicationDTO } from "@sukkot/shared";
import { useApi } from "@/lib/use-api";
import { StatusBadge } from "@/components/status";
import { WorkflowActions } from "@/components/workflow-actions";
import { Card, EmptyState, ErrorState, Loading, styles as ui } from "@/components/ui";

export default function ApplicationsScreen() {
  const { data, error, loading, refreshing, reload } = useApi<{ items: ApplicationDTO[] }>("/applications");
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  return (
    <FlatList
      data={data?.items ?? []}
      keyExtractor={(a) => a.id}
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      ListEmptyComponent={<EmptyState title="No rental applications" body="Apply from any rental listing." />}
      renderItem={({ item: a }) => (
        <Card>
          <StatusBadge status={a.status} />
          <Link href={{ pathname: "/property/[slug]", params: { slug: a.property.slug } }} style={[ui.body, { fontWeight: "700" }]}>
            {a.property.title}
          </Link>
          <Text style={ui.muted}>{a.myRole === "APPLICANT" ? "Your application" : `From ${a.applicant.name}`}</Text>
          <Text style={ui.body}>
            Move in {formatDate(a.moveInDate)} · {a.leaseMonths} months · {a.occupants} {a.occupants === 1 ? "person" : "people"}
          </Text>
          {a.status === "OFFER_MADE" && a.myRole === "APPLICANT" ? <Text style={ui.body}>The landlord proposed terms. Review them on the website before accepting.</Text> : null}
          <WorkflowActions kind="application" endpoint={`/applications/${a.id}`} actions={a.actions} onDone={reload} />
        </Card>
      )}
    />
  );
}
