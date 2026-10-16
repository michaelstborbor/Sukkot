import { Linking, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SUPPORT_CONTACT, whatsappLink } from "@sukkot/shared";

const GREETING = "Hello Sukkot Salone, I have a question.";

/**
 * A round "Chat on WhatsApp" button floating in the bottom-right corner.
 * `aboveTabBar` lifts it clear of the tab bar (49 pt plus the home-indicator inset, React Navigation's
 * default); `message` replaces the greeting typed into the chat.
 */
export function WhatsAppButton({ message, aboveTabBar = false }: { message?: string; aboveTabBar?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={() => Linking.openURL(whatsappLink(SUPPORT_CONTACT.whatsapp, message ?? GREETING))}
      accessibilityRole="link"
      accessibilityLabel="Chat with Sukkot Salone on WhatsApp"
      style={({ pressed }) => [s.fab, { bottom: insets.bottom + (aboveTabBar ? 49 : 0) + 16, opacity: pressed ? 0.85 : 1 }]}
    >
      <Ionicons name="logo-whatsapp" size={30} color="#fff" />
    </Pressable>
  );
}

const s = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#25D366",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
