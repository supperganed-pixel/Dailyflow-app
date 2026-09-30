import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, View } from "react-native";
import { useTheme, Label } from "../ui";
export function Loading({ label = "Loading…" }: { label?: string }) {
  const c = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{ gap: 12, padding: 20 }}
    >
      <Label muted>{label}</Label>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            height: 72,
            borderRadius: 16,
            backgroundColor: c.soft,
            opacity: 1 - i * 0.16,
          }}
        />
      ))}
    </View>
  );
}
export const Skeleton = Loading;
export function FadeIn({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!live || reduced) return;
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      live = false;
      opacity.stopAnimation();
    };
  }, []);
  return <Animated.View style={{ opacity, gap: 18 }}>{children}</Animated.View>;
}
