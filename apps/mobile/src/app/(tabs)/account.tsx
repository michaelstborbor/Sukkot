import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { GENERAL_ENQUIRY, NOTICES, SUPPORT_CONTACT, telLink, VERIFICATION_BADGES, whatsappLink } from "@sukkot/shared";
import { absoluteUrl, API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";
import { SignedOut } from "@/components/signed-out";
import { Badge, Button, Card, Loading, styles as ui } from "@/components/ui";

type IconName = keyof typeof Ionicons.glyphMap;

export default function AccountScreen() {
  const { user, ready, signOut } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <SignedOut title="Your Sukkot Salone account" body="Sign in to message listers, book viewings, make offers and track applications." />;
  const lister = user.roles.some((r) => r === "OWNER" || r === "AGENT");

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {user.avatarUrl ? <Image source={{ uri: absoluteUrl(user.avatarUrl) }} style={s.avatar} alt="" /> : <View style={s.avatar} />}
          <View style={{ flex: 1 }}>
            <Text style={ui.h2}>{user.fullName}</Text>
            <Text style={ui.muted}>{user.email}</Text>
          </View>
        </View>
        <View style={ui.chipRow}>
          {user.badges.length ? user.badges.map((b) => <Badge key={b} label={VERIFICATION_BADGES[b].label} tone="success" />) : <Badge label="Not verified yet" tone="warning" />}
        </View>
      </Card>

      <Card style={{ padding: 0, gap: 0 }}>
        <Row icon="notifications-outline" label="Notifications" count={user.unreadNotifications} href="/activity/notifications" />
        <Row icon="calendar-outline" label="Viewings" href="/activity/inspections" />
        <Row icon="document-text-outline" label="Rental applications" href="/activity/applications" />
        <Row icon="pricetag-outline" label="Offers" href="/activity/offers" />
        <Row icon="card-outline" label="Payments" href="/activity/payments" last />
      </Card>

      <Card style={{ padding: 0, gap: 0 }}>
        {lister ? <WebRow icon="home-outline" label="Manage my listings" path="/dashboard/properties" /> : <WebRow icon="add-circle-outline" label="List a property" path="/list-your-property" />}
        <WebRow icon="shield-checkmark-outline" label="Get verified" path="/dashboard/verification" />
        <WebRow icon="settings-outline" label="Profile and privacy settings" path="/dashboard/settings" />
        <WebRow icon="help-circle-outline" label="Help and safety" path="/safety" last />
      </Card>

      <Card style={{ padding: 0, gap: 0 }}>
        <ContactRow icon="logo-whatsapp" label="Chat with us on WhatsApp" detail={SUPPORT_CONTACT.phone} url={whatsappLink(SUPPORT_CONTACT.whatsapp, GENERAL_ENQUIRY)} />
        <ContactRow icon="call-outline" label="Call us" detail={SUPPORT_CONTACT.phone} url={telLink(SUPPORT_CONTACT.phone)} last />
      </Card>

      <Text style={[ui.muted, { fontSize: 12 }]}>{NOTICES.noEscrow}</Text>
      <Button title="Sign out" variant="outline" onPress={signOut} />
    </ScrollView>
  );
}

function Row({ icon, label, href, count, last }: { icon: IconName; label: string; href: Href; count?: number; last?: boolean }) {
  return (
    <Pressable style={[s.row, !last && s.border]} onPress={() => router.push(href)} accessibilityRole="button" accessibilityLabel={count ? `${label}, ${count} unread` : label}>
      <Ionicons name={icon} size={20} color={colors.navy900} />
      <Text style={[ui.body, { flex: 1 }]}>{label}</Text>
      {count ? <Badge label={String(count)} tone="dark" /> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function WebRow({ icon, label, path, last }: { icon: IconName; label: string; path: string; last?: boolean }) {
  return (
    <Pressable style={[s.row, !last && s.border]} onPress={() => WebBrowser.openBrowserAsync(`${API_URL}${path}`)} accessibilityRole="link" accessibilityHint="Opens the Sukkot Salone website">
      <Ionicons name={icon} size={20} color={colors.navy900} />
      <Text style={[ui.body, { flex: 1 }]}>{label}</Text>
      <Ionicons name="open-outline" size={16} color={colors.muted} />
    </Pressable>
  );
}

function ContactRow({ icon, label, detail, url, last }: { icon: IconName; label: string; detail: string; url: string; last?: boolean }) {
  return (
    <Pressable style={[s.row, !last && s.border]} onPress={() => Linking.openURL(url)} accessibilityRole="link" accessibilityLabel={`${label}, ${detail}`}>
      <Ionicons name={icon} size={20} color={colors.navy900} />
      <Text style={[ui.body, { flex: 1 }]}>{label}</Text>
      <Text style={ui.muted}>{detail}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.navy100 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, minHeight: 56 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
});
