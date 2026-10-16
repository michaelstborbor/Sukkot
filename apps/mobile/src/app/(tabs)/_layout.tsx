import type { ColorValue } from "react-native";
import { View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";
import { WhatsAppButton } from "@/components/whatsapp-button";

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

export default function TabsLayout() {
  const { user } = useAuth();
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.navy900,
          tabBarInactiveTintColor: colors.muted,
          headerTintColor: colors.navy900,
          headerTitleStyle: { fontWeight: "700" },
          sceneStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Explore", headerTitle: "Sukkot Salone", tabBarIcon: icon("search") }} />
        <Tabs.Screen name="saved" options={{ title: "Saved", tabBarIcon: icon("heart-outline") }} />
        <Tabs.Screen
          name="messages"
          options={{ title: "Messages", tabBarIcon: icon("chatbubbles-outline"), tabBarBadge: user?.unreadMessages ? user.unreadMessages : undefined }}
        />
        <Tabs.Screen
          name="account"
          options={{ title: "Account", tabBarIcon: icon("person-circle-outline"), tabBarBadge: user?.unreadNotifications ? user.unreadNotifications : undefined }}
        />
      </Tabs>
      <WhatsAppButton aboveTabBar />
    </View>
  );
}
