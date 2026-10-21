import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { Link, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/lib/auth";
import { API_URL, ApiError, errorMessage } from "@/lib/api";
import { colors } from "@/lib/theme";
import { HouseMark } from "@/components/house-mark";
import { Button, ChipGroup, Field, FormScreen, Input, Notice, styles as ui } from "@/components/ui";

const ACCOUNT_TYPES = [
  { value: "USER", label: "Looking for property" },
  { value: "OWNER", label: "Property owner" },
  { value: "AGENT", label: "Agent" },
] as const;

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [v, setV] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [accountType, setAccountType] = useState<"USER" | "OWNER" | "AGENT">("USER");
  const [accept, setAccept] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (k: keyof typeof v) => (t: string) => setV((p) => ({ ...p, [k]: t }));

  const submit = async () => {
    setPending(true);
    setError(null);
    setFields({});
    try {
      await signUp({ ...v, email: v.email.trim(), phone: v.phone || undefined, accountType, acceptTerms: accept });
      router.back();
    } catch (e) {
      if (e instanceof ApiError) setFields(e.fields);
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <FormScreen>
      <View style={{ alignItems: "center", paddingTop: 8 }}>
        <HouseMark size={72} build />
      </View>
      <Text style={ui.h1}>Create your account</Text>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Field label="I am" error={fields.accountType}>
        <ChipGroup options={ACCOUNT_TYPES} value={accountType} onChange={(t) => setAccountType(t ?? "USER")} />
      </Field>
      <Field label="Full name" error={fields.fullName}>
        <Input value={v.fullName} onChangeText={set("fullName")} autoComplete="name" />
      </Field>
      <Field label="Email" error={fields.email}>
        <Input value={v.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      </Field>
      <Field label="Phone number" optional error={fields.phone}>
        <Input value={v.phone} onChangeText={set("phone")} keyboardType="phone-pad" placeholder="076 123 456" />
      </Field>
      <Field label="Password" hint="At least 10 characters, with letters and numbers" error={fields.password}>
        <Input value={v.password} onChangeText={set("password")} secureTextEntry autoComplete="new-password" />
      </Field>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Switch value={accept} onValueChange={setAccept} trackColor={{ true: colors.emerald600 }} accessibilityLabel="I am 18 or over and accept the terms and privacy policy" />
        <Text style={[ui.body, { flex: 1 }]}>
          I am 18 or over and accept the{" "}
          <Text style={{ fontWeight: "700", textDecorationLine: "underline" }} onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/terms`)}>
            terms
          </Text>{" "}
          and{" "}
          <Text style={{ fontWeight: "700", textDecorationLine: "underline" }} onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/privacy`)}>
            privacy policy
          </Text>
        </Text>
      </View>
      {fields.acceptTerms ? <Text style={ui.error}>{fields.acceptTerms}</Text> : null}
      <Button title="Create account" loading={pending} onPress={submit} />
      <Text style={[ui.muted, { textAlign: "center" }]}>
        Already registered?{" "}
        <Link href="/sign-in" replace style={{ fontWeight: "700" }}>
          Sign in
        </Link>
      </Text>
    </FormScreen>
  );
}
