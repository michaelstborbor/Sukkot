import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { relativeTime, type ConversationSummaryDTO } from "@sukkot/shared";
import { absoluteUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { colors } from "@/lib/theme";
import { SignedOut } from "@/components/signed-out";
import { EmptyState, ErrorState, Loading, styles as ui } from "@/components/ui";

export default function MessagesScreen() {
  const { user, refresh } = useAuth();
  const { data, error, loading, refreshing, reload } = useApi<{ items: ConversationSummaryDTO[] }>(user ? "/conversations" : null);
  if (!user) return <SignedOut title="Your conversations" body="Sign in to message landlords, agents and buyers." />;
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  return (
    <FlatList
      data={data?.items ?? []}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ flexGrow: 1 }}
      ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line }} />}
      ListEmptyComponent={<EmptyState title="No conversations yet" body="Send an enquiry from a listing to start one." />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void reload();
            void refresh();
          }}
        />
      }
      renderItem={({ item: c }) => (
        <Link href={{ pathname: "/conversation/[id]", params: { id: c.id } }} asChild>
          <Pressable style={s.row} accessibilityLabel={`${c.otherParticipants.map((o) => o.name).join(", ")}: ${c.subject}${c.unread ? `, ${c.unread} unread` : ""}`}>
            {c.property?.coverUrl ? <Image source={{ uri: absoluteUrl(c.property.coverUrl) }} style={s.thumb} alt="" /> : <View style={s.thumb} />}
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <Text style={[ui.body, { fontWeight: c.unread ? "700" : "600", flex: 1 }]} numberOfLines={1}>
                  {c.otherParticipants.map((o) => o.name).join(", ") || "Conversation"}
                </Text>
                <Text style={[ui.muted, { fontSize: 12 }]}>{relativeTime(c.lastMessage?.at ?? c.updatedAt)}</Text>
              </View>
              <Text style={[ui.muted, { fontSize: 13 }]} numberOfLines={1}>
                {c.subject}
              </Text>
              {c.lastMessage ? (
                <Text style={[ui.body, { fontSize: 14, color: c.unread ? colors.ink : colors.muted }]} numberOfLines={1}>
                  {c.lastMessage.fromMe ? "You: " : ""}
                  {c.lastMessage.body}
                </Text>
              ) : null}
            </View>
            {c.unread ? <View style={s.dot} /> : null}
          </Pressable>
        </Link>
      )}
    />
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: colors.surface },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: colors.navy50 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.emerald600 },
});
