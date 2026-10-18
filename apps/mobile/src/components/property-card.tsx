import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AVAILABILITY_LABELS, formatDate, LISTING_PURPOSE_LABELS, type PropertySummaryDTO } from "@sukkot/shared";
import { absoluteUrl } from "@/lib/api";
import { priceLabel } from "@/lib/format";
import { colors, radius } from "@/lib/theme";
import { Badge } from "./ui";

export function PropertyCard({ p }: { p: PropertySummaryDTO }) {
  const facts = [
    p.bedrooms != null ? `${p.bedrooms} bed` : null,
    p.bathrooms != null ? `${p.bathrooms} bath` : null,
    p.floorArea ?? p.plotSize,
  ].filter(Boolean);
  return (
    <Link href={{ pathname: "/property/[slug]", params: { slug: p.slug } }} asChild>
      <Pressable style={({ pressed }) => [s.card, pressed && { opacity: 0.9 }]} accessibilityLabel={`${p.title}, ${priceLabel(p.price, p.rentalPeriod)}, ${p.locationLabel}`}>
        <View style={s.imageWrap}>
          {p.coverImage ? (
            <Image source={{ uri: absoluteUrl(p.coverImage.thumbUrl) }} style={s.image} contentFit="cover" alt={p.coverImage.alt} transition={150} />
          ) : (
            <View style={[s.image, s.noImage]}>
              <Ionicons name="image-outline" size={32} color={colors.muted} />
            </View>
          )}
          <View style={s.overlay}>
            <Badge label={LISTING_PURPOSE_LABELS[p.purpose]} tone="dark" />
            {p.featured ? <Badge label="Featured" tone="warning" /> : null}
            {p.isDemo ? <Badge label="Demo listing" tone="danger" /> : null}
          </View>
          {p.coverImage?.illustrative ? (
            <View style={s.illustrative}>
              <Badge label="Illustrative photo" tone="warning" />
            </View>
          ) : null}
        </View>
        <View style={s.body}>
          <Text style={s.price}>{priceLabel(p.price, p.rentalPeriod)}</Text>
          <Text style={s.title} numberOfLines={2}>
            {p.title}
          </Text>
          <Text style={s.muted} numberOfLines={1}>
            <Ionicons name="location-outline" size={13} /> {p.locationLabel}
          </Text>
          {facts.length ? <Text style={s.muted}>{facts.join(" · ")}</Text> : null}
          <View style={s.badges}>
            {p.availability !== "AVAILABLE" ? <Badge label={AVAILABILITY_LABELS[p.availability]} tone="warning" /> : null}
            {p.inspectedAt ? <Badge label={`Inspected ${formatDate(p.inspectedAt)}`} tone="success" /> : null}
            {p.listerVerified ? <Badge label="Verified lister" tone="success" /> : null}
            {p.documentsReviewed ? <Badge label="Documents reviewed" tone="info" /> : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: "hidden" },
  imageWrap: { aspectRatio: 4 / 3, backgroundColor: colors.navy50 },
  image: { width: "100%", height: "100%" },
  noImage: { alignItems: "center", justifyContent: "center" },
  overlay: { position: "absolute", top: 8, left: 8, flexDirection: "row", gap: 6 },
  illustrative: { position: "absolute", bottom: 8, left: 8 },
  body: { padding: 12, gap: 4 },
  price: { fontSize: 18, fontWeight: "700", color: colors.navy900 },
  title: { fontSize: 15, fontWeight: "600", color: colors.ink },
  muted: { fontSize: 13, color: colors.muted },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
});
