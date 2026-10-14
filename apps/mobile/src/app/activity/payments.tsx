import { useState } from "react";
import { Alert, FlatList, RefreshControl, Text } from "react-native";
import { formatDateTime, NOTICES, PAYMENT_METHOD_LABELS, type PaymentDTO } from "@sukkot/shared";
import { api, errorMessage } from "@/lib/api";
import { humanize } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { StatusBadge } from "@/components/status";
import { Badge, Button, Card, EmptyState, ErrorState, Loading, Notice, styles as ui } from "@/components/ui";

export default function PaymentsScreen() {
  const { data, error, loading, refreshing, reload } = useApi<{ items: PaymentDTO[] }>("/payments");
  const [checking, setChecking] = useState<string | null>(null);
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  const check = async (id: string) => {
    setChecking(id);
    try {
      await api(`/payments/${id}/refresh`, { method: "POST", body: {} });
      await reload();
    } catch (e) {
      Alert.alert("Could not check status", errorMessage(e));
    } finally {
      setChecking(null);
    }
  };

  return (
    <FlatList
      data={data?.items ?? []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      ListHeaderComponent={
        <>
          <Notice>{NOTICES.paymentHonesty}</Notice>
        </>
      }
      ListEmptyComponent={<EmptyState title="No payments" />}
      renderItem={({ item: p }) => (
        <Card>
          <StatusBadge status={p.status} />
          <Text style={[ui.body, { fontWeight: "700" }]}>{p.amount.formatted}</Text>
          <Text style={ui.body}>
            {humanize(p.purpose)} · {PAYMENT_METHOD_LABELS[p.method]}
          </Text>
          <Text style={ui.muted}>
            {p.reference} · {formatDateTime(p.createdAt)}
          </Text>
          {p.providerVerified ? <Badge label="Confirmed by provider" tone="success" /> : p.status === "RECORDED" ? <Badge label="Recorded, not provider-verified" tone="warning" /> : null}
          {p.nextAction?.type === "USSD_PROMPT" && p.status === "PENDING" ? <Notice>{p.nextAction.message}</Notice> : null}
          {(p.status === "PENDING" || p.status === "CREATED") && p.method !== "MANUAL" && p.method !== "CASH" && p.method !== "BANK_TRANSFER" ? (
            <Button small variant="outline" title="Check status" loading={checking === p.id} onPress={() => check(p.id)} />
          ) : null}
        </Card>
      )}
    />
  );
}
