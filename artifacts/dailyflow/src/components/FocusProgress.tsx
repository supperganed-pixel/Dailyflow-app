import React, { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useReducedMotion } from "../appearance";
import { Label, useTheme } from "../ui";

export function FocusProgress({ completed, total, day }: { completed: number; total: number; day: string }) {
  const c = useTheme(); const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;
  const previous = useRef({ completed, total, day });
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: total ? completed / total : 0, duration: reduced ? 0 : 450, useNativeDriver: false });
    animation.start(); return () => animation.stop();
  }, [completed, total, reduced, progress]);
  useEffect(() => {
    const old = previous.current; previous.current = { completed, total, day };
    setCelebrating(false);
    if (old.day !== day || !total || completed !== total || completed <= old.completed) return;
    setCelebrating(true);
    const animation = Animated.timing(sparkle, { toValue: 1, duration: reduced ? 0 : 800, useNativeDriver: true });
    sparkle.setValue(0); animation.start();
    const timer = setTimeout(() => setCelebrating(false), 2800);
    return () => { animation.stop(); clearTimeout(timer); };
  }, [completed, total, day, reduced, sparkle]);
  return <View style={{ gap: 10, paddingTop: 6 }}>
    <View accessibilityRole="progressbar" accessibilityLabel="Daily Focus progress" accessibilityValue={{ min: 0, max: total || 3, now: completed, text: `${completed} of ${total} Focus tasks done` }}>
      <Text style={{ color: c.brand, fontSize: 23, fontWeight: "700" }}>{completed} of {total} Focus tasks done</Text>
      <View style={{ height: 9, borderRadius: 9, backgroundColor: c.line, overflow: "hidden", marginTop: 12 }}><Animated.View style={{ backgroundColor: c.brand, height: 9, borderRadius: 9, width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} /></View>
    </View>
    {total === 0 && <Label small muted>Add up to three tasks to start your daily progress.</Label>}
    {total > 0 && completed === total && <Text accessibilityLiveRegion="polite" style={{ color: c.ink }}>All your Focus tasks are done. Enjoy a little breathing room.</Text>}
    {celebrating && <Animated.Text accessible={false} style={{ color: c.brand, fontSize: 26, letterSpacing: 12, opacity: sparkle.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }), transform: [{ translateY: sparkle.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>✦  ✓  ✧</Animated.Text>}
  </View>;
}

