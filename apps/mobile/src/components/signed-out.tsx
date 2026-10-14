import { router } from "expo-router";
import { Button, EmptyState } from "./ui";

export function SignedOut({ title, body }: { title: string; body: string }) {
  return <EmptyState title={title} body={body} action={<Button title="Sign in" onPress={() => router.push("/sign-in")} style={{ marginTop: 8 }} />} />;
}
