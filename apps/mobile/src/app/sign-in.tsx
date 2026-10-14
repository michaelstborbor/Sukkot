import { useState } from "react";
import { Text } from "react-native";
import { Link, router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { ApiError, errorMessage } from "@/lib/api";
import { Button, Field, FormScreen, Input, Notice, styles as ui } from "@/components/ui";

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async () => {
    setPending(true);
    setError(null);
    setFields({});
    try {
      await signIn(email.trim(), password);
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
      <Text style={ui.h1}>Welcome back</Text>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Field label="Email" error={fields.email}>
        <Input value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      </Field>
      <Field label="Password" error={fields.password}>
        <Input value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
      </Field>
      <Button title="Sign in" loading={pending} onPress={submit} />
      <Text style={[ui.muted, { textAlign: "center" }]}>
        New to Sukkot Salone?{" "}
        <Link href="/sign-up" replace style={{ fontWeight: "700" }}>
          Create an account
        </Link>
      </Text>
      <Text style={[ui.muted, { textAlign: "center", fontSize: 12 }]}>Forgotten your password? Reset it on the Sukkot Salone website.</Text>
    </FormScreen>
  );
}
