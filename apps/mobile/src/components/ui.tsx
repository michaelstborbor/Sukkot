import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { colors, radius } from "@/lib/theme";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent";

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.navy900, fg: "#fff" },
  secondary: { bg: colors.emerald700, fg: "#fff" },
  accent: { bg: colors.gold500, fg: colors.navy950 },
  outline: { bg: colors.surface, fg: colors.navy900, border: colors.line },
  ghost: { bg: "transparent", fg: colors.navy900 },
  danger: { bg: colors.danger, fg: "#fff" },
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
  small,
  ...rest
}: { title: string; variant?: Variant; loading?: boolean; icon?: ReactNode; small?: boolean; style?: StyleProp<ViewStyle> } & Omit<PressableProps, "style" | "children">) {
  const v = VARIANTS[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: v.bg, borderColor: v.border ?? v.bg, opacity: off ? 0.6 : pressed ? 0.85 : 1 },
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : icon}
      <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: v.fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, error, hint, optional, children }: { label: string; error?: string; hint?: string; optional?: boolean; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={styles.optional}> (optional)</Text> : null}
      </Text>
      {children}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Input({ invalid, style, ...props }: TextInputProps & { invalid?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      style={[styles.input, props.multiline && { minHeight: 96, textAlignVertical: "top" }, invalid && { borderColor: colors.danger }, style]}
      {...props}
    />
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.navy900, borderColor: colors.navy900 }]}
    >
      <Text style={[styles.chipText, selected && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipGroup<T extends string>({ options, value, onChange }: { options: readonly { value: T; label: string }[]; value: T | undefined; onChange: (v: T | undefined) => void }) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={value === o.value} onPress={() => onChange(value === o.value ? undefined : o.value)} />
      ))}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "dark";
const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.navy50, fg: colors.navy700 },
  success: { bg: colors.emerald50, fg: colors.emerald700 },
  warning: { bg: colors.warning50, fg: colors.warning },
  danger: { bg: colors.danger50, fg: colors.danger },
  info: { bg: colors.navy100, fg: colors.navy900 },
  dark: { bg: colors.navy900, fg: "#fff" },
};

export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.badge, { backgroundColor: TONES[tone].bg }]}>
      <Text style={[styles.badgeText, { color: TONES[tone].fg }]}>{label}</Text>
    </View>
  );
}

export function Notice({ children, tone = "info", title }: { children: ReactNode; tone?: Tone; title?: string }) {
  return (
    <View style={[styles.notice, { backgroundColor: TONES[tone].bg }]} accessibilityRole="alert">
      {title ? <Text style={[styles.noticeTitle, { color: TONES[tone].fg }]}>{title}</Text> : null}
      <Text style={{ color: colors.ink, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.navy900} />
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={[styles.center, { gap: 8, padding: 24 }]}>
      <Text style={styles.h2}>{title}</Text>
      {body ? <Text style={[styles.muted, { textAlign: "center" }]}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <EmptyState title="Something went wrong" body={message} action={onRetry ? <Button title="Try again" variant="outline" onPress={onRetry} /> : undefined} />;
}

export function FormScreen({ children }: { children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.canvas }}>
      {children}
    </ScrollView>
  );
}

export const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonSmall: { minHeight: 40, paddingHorizontal: 12 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink },
  optional: { fontWeight: "400", color: colors.muted },
  hint: { fontSize: 13, color: colors.muted },
  error: { fontSize: 13, color: colors.danger },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, backgroundColor: colors.surface, color: colors.ink },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: "center" },
  chipText: { fontSize: 14, color: colors.ink, fontWeight: "500" },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 8 },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  notice: { borderRadius: radius.md, padding: 12, gap: 4 },
  noticeTitle: { fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  h1: { fontSize: 22, fontWeight: "700", color: colors.navy900 },
  h2: { fontSize: 18, fontWeight: "700", color: colors.navy900 },
  muted: { fontSize: 14, color: colors.muted },
  body: { fontSize: 15, color: colors.ink, lineHeight: 22 },
});
