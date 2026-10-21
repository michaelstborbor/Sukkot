import { useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import Animated, { Easing, interpolateColor, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { colors } from "@/lib/theme";
import { HouseMark } from "./house-mark";

// Keep the native splash (plain navy) up until this screen is ready to draw over it.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Size of the house in the middle of the screen, in points. */
export const SPLASH_MARK = 160;
const NAVY = "#0B1F3A";
// Door in the 40-unit logo grid: x 18–22, y 24–30.
const DOOR_W = (4 / 40) * SPLASH_MARK;
const DOOR_H = (6 / 40) * SPLASH_MARK;
const DOOR_TOP = (24 / 40) * SPLASH_MARK - SPLASH_MARK / 2;

/**
 * Takes over from the plain navy native splash: the house builds itself (walls, roof, door), the name
 * rises under it, then the door opens wide and the app appears through it. The door waits for both
 * the house and `ready` (the saved session is loaded). About two seconds in all; with reduced motion
 * the finished logo shows briefly and fades.
 */
export function StartupIntro({ ready }: { ready: boolean }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [gone, setGone] = useState(false);
  const [built, setBuilt] = useState(false);
  const word = useSharedValue(0);
  const door = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (built) word.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built]);

  useEffect(() => {
    if (!ready || !built) return;
    const finish = () => setGone(true);
    if (reduced) {
      fade.value = withDelay(600, withTiming(0, { duration: 250 }, (ok) => ok && runOnJS(finish)()));
      return;
    }
    door.value = withDelay(650, withTiming(1, { duration: 600, easing: Easing.in(Easing.cubic) }));
    fade.value = withDelay(1150, withTiming(0, { duration: 200 }, (ok) => ok && runOnJS(finish)()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, built, reduced]);

  // Enough growth for the doorway to cover the whole screen from its spot in the middle.
  const grow = (Math.hypot(width, height) * 2.2) / DOOR_W;
  const doorStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + door.value * grow }],
    backgroundColor: interpolateColor(door.value, [0, 0.12, 1], ["#0F766E", "#F6CF7A", colors.canvas]),
    opacity: door.value > 0 ? 1 : 0,
  }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value * (1 - door.value), transform: [{ translateY: (1 - word.value) * 12 }] }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (gone) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.root, rootStyle]} pointerEvents="none" accessibilityLabel="Sukkot Salone is starting">
      <StatusBar style="light" />
      <HouseMark size={SPLASH_MARK} tile={false} build onBuilt={() => setBuilt(true)} />
      <Animated.Text style={[s.word, wordStyle]}>
        Sukkot <Animated.Text style={{ color: "#C8962E" }}>Salone</Animated.Text>
      </Animated.Text>
      <Animated.View style={[s.door, { top: height / 2 + DOOR_TOP, left: width / 2 - DOOR_W / 2, width: DOOR_W, height: DOOR_H, borderTopLeftRadius: DOOR_W / 2, borderTopRightRadius: DOOR_W / 2 }, doorStyle]} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  // elevation keeps it above the native screen views on Android, where zIndex alone is not enough.
  root: { backgroundColor: NAVY, alignItems: "center", justifyContent: "center", zIndex: 100, elevation: 100 },
  word: { position: "absolute", top: "50%", marginTop: SPLASH_MARK / 2 + 8, fontSize: 28, fontWeight: "700", letterSpacing: -0.4, color: "#fff" },
  door: { position: "absolute" },
});
