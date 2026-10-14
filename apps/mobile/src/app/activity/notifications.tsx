import { useEffect } from "react";
import { FlatList, RefreshControl, Text } from "react-native";
import { relativeTime, type NotificationDTO } from "@sukkot/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { colors } from "@/lib/theme";
import { Card, EmptyState, ErrorState, Loading, styles as ui } from "@/components/ui";

export default function NotificationsScreen() {
  const { refresh } = useAuth();
  const { data, error, loading, refreshing, reload } = useApi<{ items: NotificationDTO[] }>("/notifications");
  const unread = data?.items.filter((n) => !n.readAt).map((n) => n.id) ?? [];
  const unreadKey = unread.join(",");

  // Opening the list marks what is shown as read.
  useEffect(() => {
    if (!unreadKey) return;
    api("/notifications", { body: { ids: unreadKey.split(",") } })
      .then(refresh)
      .catch(() => undefined);
  }, [unreadKey, refresh]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  return (
    <FlatList
      data={data?.items ?? []}
      keyExtractor={(n) => n.id}
      contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      ListEmptyComponent={<EmptyState title="You're all caught up" />}
      renderItem={({ item: n }) => (
        <Card style={!n.readAt ? { borderColor: colors.emerald600 } : undefined}>
          <Text style={[ui.body, { fontWeight: "700" }]}>{n.title}</Text>
          <Text style={ui.body}>{n.body}</Text>
          <Text style={[ui.muted, { fontSize: 12 }]}>{relativeTime(n.createdAt)}</Text>
        </Card>
      )}
    />
  );
}
