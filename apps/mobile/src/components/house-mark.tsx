import { useEffect } from "react";
import Svg, { Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

// Lengths of the two stroked paths in the 40-unit logo grid, for the draw-on effect.
const WALLS = 40;
const ROOF = 31.3;
const draw = Easing.bezier(0.55, 0, 0.3, 1);

/**
 * The logo mark. With `build`, it is drawn in front of the person, matching the website: the walls,
 * then the gold roof, then the door opens with a warm light. It ends exactly on the static logo,
 * and appears finished straight away when the phone asks for reduced motion.
 */
export function HouseMark({ size, build = false, tile = true, onBuilt }: { size: number; build?: boolean; tile?: boolean; onBuilt?: () => void }) {
  const reduced = useReducedMotion();
  const animate = build && !reduced;
  const walls = useSharedValue(animate ? 1 : 0);
  const roof = useSharedValue(animate ? 1 : 0);
  const door = useSharedValue(animate ? 0 : 1);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      onBuilt?.();
      return;
    }
    walls.value = withDelay(150, withTiming(0, { duration: 450, easing: draw }));
    roof.value = withDelay(550, withTiming(0, { duration: 400, easing: draw }));
    door.value = withDelay(900, withTiming(1, { duration: 350, easing: Easing.out(Easing.back(2)) }));
    glow.value = withDelay(950, withSequence(withTiming(1, { duration: 350 }), withTiming(0, { duration: 900 })));
    const done = setTimeout(() => onBuilt?.(), 1300);
    return () => clearTimeout(done);
    // Runs once per mount: the animation is a one-off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  const wallsProps = useAnimatedProps(() => ({ strokeDashoffset: walls.value * WALLS }));
  const roofProps = useAnimatedProps(() => ({ strokeDashoffset: roof.value * ROOF }));
  // The door grows up from the threshold (y = 30).
  const doorProps = useAnimatedProps(() => ({ transform: `matrix(1 0 0 ${door.value} 0 ${30 * (1 - door.value)})` }));
  const glowProps = useAnimatedProps(() => ({ opacity: glow.value }));

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <RadialGradient id="glow">
          <Stop offset="0" stopColor="#F6CF7A" stopOpacity="0.9" />
          <Stop offset="0.45" stopColor="#E0AE4E" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#C8962E" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {tile ? <Rect width="40" height="40" rx="11" fill="#0B1F3A" /> : null}
      <AnimatedEllipse cx="20" cy="26" rx="11" ry="10" fill="url(#glow)" animatedProps={glowProps} />
      <AnimatedPath d="M12 18v12h16V18" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinejoin="round" strokeDasharray={WALLS} animatedProps={wallsProps} />
      <AnimatedPath d="M8 19 20 9l12 10" fill="none" stroke="#C8962E" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ROOF} animatedProps={roofProps} />
      <AnimatedG animatedProps={doorProps}>
        <Path d="M18 30v-6a2 2 0 0 1 4 0v6" fill="#0F766E" />
      </AnimatedG>
    </Svg>
  );
}
