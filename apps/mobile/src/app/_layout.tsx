import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: colors.navy900,
            headerTitleStyle: { fontWeight: "700" },
            contentStyle: { backgroundColor: colors.canvas },
            headerBackButtonDisplayMode: "minimal",
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="filters" options={{ presentation: "modal", title: "Filters" }} />
          <Stack.Screen name="property/[slug]" options={{ title: "" }} />
          <Stack.Screen name="sign-in" options={{ presentation: "modal", title: "Sign in" }} />
          <Stack.Screen name="sign-up" options={{ presentation: "modal", title: "Create account" }} />
          <Stack.Screen name="enquire/[id]" options={{ presentation: "modal", title: "Send enquiry" }} />
          <Stack.Screen name="inspect/[id]" options={{ presentation: "modal", title: "Book a viewing" }} />
          <Stack.Screen name="offer/[id]" options={{ presentation: "modal", title: "Make an offer" }} />
          <Stack.Screen name="apply/[id]" options={{ presentation: "modal", title: "Apply to rent" }} />
          <Stack.Screen name="report/[id]" options={{ presentation: "modal", title: "Report listing" }} />
          <Stack.Screen name="conversation/[id]" options={{ title: "Conversation" }} />
          <Stack.Screen name="activity/inspections" options={{ title: "Viewings" }} />
          <Stack.Screen name="activity/offers" options={{ title: "Offers" }} />
          <Stack.Screen name="activity/applications" options={{ title: "Rental applications" }} />
          <Stack.Screen name="activity/payments" options={{ title: "Payments" }} />
          <Stack.Screen name="activity/notifications" options={{ title: "Notifications" }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
