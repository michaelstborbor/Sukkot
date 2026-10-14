import { useCallback, useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { Link, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDateTime, type MessageDTO } from "@sukkot/shared";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, radius } from "@/lib/theme";
import { Button, ErrorState, Input, Loading, Notice, styles as ui } from "@/components/ui";

interface Conversation {
  id: string;
  subject: string;
  property: { id: string; title: string; slug: string } | null;
  participants: { id: string; name: string }[];
  isParticipant: boolean;
  messages: MessageDTO[];
}

const POLL_MS = 8000;

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const [c, setC] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setC(await api<Conversation>(`/conversations/${id}`));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);

  // Poll while the screen is focused; reading marks messages as read, so refresh the unread badge on leave.
  useFocusEffect(
    useCallback(() => {
      void load();
      const t = setInterval(load, POLL_MS);
      return () => {
        clearInterval(t);
        void refresh();
      };
    }, [load, refresh]),
  );
  useEffect(() => setSendError(null), [body]);

  if (error && !c) return <ErrorState message={error} onRetry={load} />;
  if (!c) return <Loading />;
  const others = c.participants.filter((p) => p.id !== user?.id).map((p) => p.name).join(", ");

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      await api(`/conversations/${id}/messages`, { body: { body: text } });
      setBody("");
      await load();
    } catch (e) {
      setSendError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
      <Stack.Screen options={{ title: others || "Conversation" }} />
      <View style={s.header}>
        <Text style={[ui.body, { fontWeight: "600" }]} numberOfLines={1}>
          {c.subject}
        </Text>
        {c.property ? (
          <Link href={{ pathname: "/property/[slug]", params: { slug: c.property.slug } }} style={[ui.muted, { textDecorationLine: "underline" }]}>
            View listing
          </Link>
        ) : null}
      </View>
      <FlatList
        inverted
        data={[...c.messages].reverse()}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item: m }) => (
          <View style={[s.bubble, m.fromMe ? s.mine : s.theirs]}>
            {!m.fromMe ? <Text style={s.sender}>{m.senderName}</Text> : null}
            <Text style={{ color: m.fromMe ? "#fff" : colors.ink, fontSize: 15, lineHeight: 21 }}>{m.body}</Text>
            <Text style={[s.meta, m.fromMe && { color: colors.navy100 }]}>
              {formatDateTime(m.createdAt)}
              {m.fromMe && m.readByOthers ? " · Read" : ""}
            </Text>
          </View>
        )}
      />
      {c.isParticipant ? (
        <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {sendError ? <Notice tone="danger">{sendError}</Notice> : null}
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
            <Input value={body} onChangeText={setBody} placeholder="Write a message" multiline style={{ flex: 1, minHeight: 48, maxHeight: 120 }} maxLength={4000} accessibilityLabel="Message" />
            <Button title="Send" onPress={send} loading={sending} disabled={!body.trim()} />
          </View>
          <Text style={[ui.muted, { fontSize: 12 }]}>Never send money before viewing a property and checking its documents.</Text>
        </View>
      ) : (
        <Notice>You are viewing this conversation as staff.</Notice>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line, gap: 2 },
  bubble: { maxWidth: "85%", borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.navy900, borderBottomRightRadius: 4 },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 4 },
  sender: { fontSize: 12, fontWeight: "700", color: colors.emerald700 },
  meta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  composer: { padding: 12, gap: 6, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.line },
});
