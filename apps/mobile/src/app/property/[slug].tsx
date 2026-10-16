import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AVAILABILITY_LABELS,
  FURNISHING_LABELS,
  LISTING_PURPOSE_LABELS,
  NOTICES,
  SUPPORT_CONTACT,
  telLink,
  VERIFICATION_BADGES,
  listingEnquiry,
  whatsappLink,
  type Furnishing,
  type PropertyDetailDTO,
} from "@sukkot/shared";
import { absoluteUrl, api, API_URL, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { humanize, priceLabel } from "@/lib/format";
import { goSignedIn } from "@/lib/require-auth";
import { colors } from "@/lib/theme";
import { Badge, Button, Card, ErrorState, Loading, Notice, styles as ui } from "@/components/ui";
import { WhatsAppButton } from "@/components/whatsapp-button";

export default function PropertyScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [p, setP] = useState<PropertyDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api<PropertyDetailDTO>(`/properties/${encodeURIComponent(slug)}`, { query: { view: "1" } })
      .then((d) => {
        setP(d);
        setError(null);
      })
      .catch((e) => setError(errorMessage(e)));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user?.id]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!p) return <Loading />;

  const toggleSave = async () => {
    if (!user) return goSignedIn(user, "/sign-in");
    setSaving(true);
    try {
      await api("/favorites", { body: { propertyId: p.id, save: !p.saved } });
      setP({ ...p, saved: !p.saved });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const isOwnListing = user?.id === p.lister.id;
  const open = p.availability === "AVAILABLE" && p.listingStatus === "PUBLISHED";
  const canRent = p.purpose === "RENT" || p.purpose === "LEASE";
  const facts: [string, string][] = [
    ["Type", p.typeName],
    ...(p.bedrooms != null ? [["Bedrooms", String(p.bedrooms)] as [string, string]] : []),
    ...(p.bathrooms != null ? [["Bathrooms", String(p.bathrooms)] as [string, string]] : []),
    ...(p.floorArea ? [["Floor area", p.floorArea] as [string, string]] : []),
    ...(p.plotSize ? [["Plot size", p.plotSize] as [string, string]] : []),
    ...(p.furnishing ? [["Furnishing", FURNISHING_LABELS[p.furnishing as Furnishing] ?? humanize(p.furnishing)] as [string, string]] : []),
    ...(p.waterSupply ? [["Water", humanize(p.waterSupply)] as [string, string]] : []),
    ...(p.electricity ? [["Electricity", humanize(p.electricity)] as [string, string]] : []),
    ...(p.parkingSpaces != null ? [["Parking", String(p.parkingSpaces)] as [string, string]] : []),
    ["Reference", p.reference],
  ];
  const params = { id: p.id, title: p.title };
  const enquiryText = listingEnquiry(p, `${API_URL}/properties/${p.slug}`);

  return (
    <>
      <Stack.Screen
        options={{
          title: "",
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 16 }}>
              <Pressable onPress={() => Share.share({ message: `${p.title}\n${API_URL}/properties/${p.slug}` })} accessibilityLabel="Share listing" hitSlop={8}>
                <Ionicons name="share-outline" size={22} color={colors.navy900} />
              </Pressable>
              <Pressable onPress={toggleSave} disabled={saving} accessibilityLabel={p.saved ? "Remove from saved" : "Save listing"} hitSlop={8}>
                <Ionicons name={p.saved ? "heart" : "heart-outline"} size={22} color={p.saved ? colors.danger : colors.navy900} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        {p.images.length ? (
          <View>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / width))}>
              {p.images.map((img) => (
                <Image key={img.id} source={{ uri: absoluteUrl(img.url) }} style={{ width, height: width * 0.75 }} contentFit="cover" alt={img.alt} transition={150} />
              ))}
            </ScrollView>
            <View style={s.counter}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                {slide + 1} / {p.images.length}
              </Text>
            </View>
            {p.images[slide]?.illustrative ? (
              <View style={{ position: "absolute", left: 12, bottom: 12 }}>
                <Badge label="Illustrative image" tone="warning" />
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ padding: 16, gap: 16 }}>
          {p.isDemo ? <Notice tone="warning" title="Demo listing">{NOTICES.demoContent}</Notice> : null}
          <View style={{ gap: 6 }}>
            <View style={ui.chipRow}>
              <Badge label={LISTING_PURPOSE_LABELS[p.purpose]} tone="dark" />
              {p.availability !== "AVAILABLE" ? <Badge label={AVAILABILITY_LABELS[p.availability]} tone="warning" /> : null}
              {p.negotiable ? <Badge label="Negotiable" /> : null}
            </View>
            <Text style={s.price}>{priceLabel(p.price, p.rentalPeriod)}</Text>
            <Text style={ui.h1}>{p.title}</Text>
            <Text style={ui.muted}>
              <Ionicons name="location-outline" size={14} /> {p.locationLabel}
            </Text>
          </View>

          {!isOwnListing && open ? (
            <View style={{ gap: 8 }}>
              <Button title="Send enquiry" onPress={() => goSignedIn(user, { pathname: "/enquire/[id]", params })} icon={<Ionicons name="chatbubble-outline" size={18} color="#fff" />} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button style={{ flex: 1 }} variant="outline" title="Book a viewing" onPress={() => goSignedIn(user, { pathname: "/inspect/[id]", params })} />
                {p.purpose === "SALE" ? (
                  <Button style={{ flex: 1 }} variant="secondary" title="Make an offer" onPress={() => goSignedIn(user, { pathname: "/offer/[id]", params: { ...params, currency: p.price.currency } })} />
                ) : canRent ? (
                  <Button style={{ flex: 1 }} variant="secondary" title="Apply to rent" onPress={() => goSignedIn(user, { pathname: "/apply/[id]", params })} />
                ) : null}
              </View>
            </View>
          ) : null}
          {isOwnListing ? <Notice>This is your listing. Manage it from the web dashboard.</Notice> : null}

          <Card>
            <Text style={ui.h2}>Key facts</Text>
            {facts.map(([k, v]) => (
              <View key={k} style={s.factRow}>
                <Text style={ui.muted}>{k}</Text>
                <Text style={[ui.body, { fontWeight: "600", flexShrink: 1, textAlign: "right" }]}>{v}</Text>
              </View>
            ))}
          </Card>

          <Card>
            <Text style={ui.h2}>About this property</Text>
            <Text style={ui.body}>{p.description}</Text>
          </Card>

          {p.amenities.length ? (
            <Card>
              <Text style={ui.h2}>Amenities</Text>
              <View style={ui.chipRow}>
                {p.amenities.map((a) => (
                  <Badge key={a.id} label={a.name} />
                ))}
              </View>
            </Card>
          ) : null}

          <Card>
            <Text style={ui.h2}>Listed by</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {p.lister.avatarUrl ? (
                <Image source={{ uri: absoluteUrl(p.lister.avatarUrl) }} style={s.avatar} alt="" />
              ) : (
                <View style={[s.avatar, { alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ fontWeight: "700", color: colors.navy900 }}>{p.lister.name.charAt(0)}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[ui.body, { fontWeight: "700" }]}>{p.lister.name}</Text>
                <Text style={ui.muted}>
                  {p.lister.kind === "AGENT" ? `Agent${p.lister.agencyName ? ` · ${p.lister.agencyName}` : ""}` : "Owner"} · {humanize(p.listerCapacity)}
                </Text>
              </View>
            </View>
            <View style={ui.chipRow}>
              {p.lister.badges.length ? (
                p.lister.badges.map((b) => <Badge key={b} label={VERIFICATION_BADGES[b].label} tone="success" />)
              ) : (
                <Badge label="Not yet verified" tone="warning" />
              )}
              {p.lister.isDemo ? <Badge label="Demo account" tone="danger" /> : null}
            </View>
            {!isOwnListing ? (
              <View style={{ gap: 6 }}>
                <Text style={[ui.muted, { fontSize: 12 }]}>Call or chat with the Sukkot Salone team about this property</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button small style={{ flex: 1 }} variant="outline" title="Call" onPress={() => Linking.openURL(telLink(SUPPORT_CONTACT.phone))} />
                  <Button small style={{ flex: 1 }} variant="outline" title="WhatsApp" onPress={() => Linking.openURL(whatsappLink(SUPPORT_CONTACT.whatsapp, enquiryText))} />
                </View>
              </View>
            ) : null}
            <Text style={[ui.muted, { fontSize: 12 }]}>{NOTICES.verificationLimits}</Text>
          </Card>

          <Notice tone="warning" title="Stay safe">
            {NOTICES.inspectionSafety}
          </Notice>
          {p.purpose === "SALE" ? <Notice>{NOTICES.offerNotLegal}</Notice> : null}

          {!isOwnListing ? (
            <Button variant="ghost" title="Report this listing" onPress={() => goSignedIn(user, { pathname: "/report/[id]", params })} icon={<Ionicons name="flag-outline" size={16} color={colors.navy900} />} />
          ) : null}
        </View>
      </ScrollView>
      {!isOwnListing ? <WhatsAppButton message={enquiryText} /> : null}
    </>
  );
}

const s = StyleSheet.create({
  price: { fontSize: 24, fontWeight: "800", color: colors.navy900 },
  counter: { position: "absolute", right: 12, bottom: 12, backgroundColor: "rgba(6,18,36,0.7)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  factRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.navy100 },
});
