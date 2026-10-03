import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, Text, View } from "react-native";
import { preferences } from "./storage";
import { Choice, Field, Label, useTheme, type Palette } from "./ui";

export const accents = {
  forest: ["#286650", "#B7D594", "#EAF0E8", "#2B4036"],
  coral: ["#A83B30", "#FFA99C", "#FFF0EC", "#382B32"],
  indigo: ["#4946B8", "#B4B5FF", "#EFEEFF", "#292D4A"],
  ocean: ["#006B73", "#80D8DD", "#E2F4F4", "#203D45"],
} as const;
type Options = { accent: keyof typeof accents; greeting: string; layout: "comfortable" | "compact"; depth: boolean };
const defaults: Options = { accent: "forest", greeting: "", layout: "comfortable", depth: false };
const Appearance = createContext({ ...defaults, ready: false, error: "", update: (_patch: Partial<Options>) => {} });
export const useAppearance = () => useContext(Appearance);
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const queue = useRef(Promise.resolve());
  const edited = useRef(false);
  useEffect(() => {
    let active = true;
    void preferences.get("appearance.v1").then((raw) => {
      if (!active || !raw) return;
      const saved = JSON.parse(raw);
      setValue({ accent: Object.hasOwn(accents, saved.accent) ? saved.accent : "forest", greeting: typeof saved.greeting === "string" ? saved.greeting.slice(0, 60) : "", layout: saved.layout === "compact" ? "compact" : "comfortable", depth: saved.depth === true });
    }).catch(() => { if (active) setError("Could not load appearance preferences."); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready || !edited.current) return;
    const timer = setTimeout(() => {
      queue.current = queue.current.catch(() => {}).then(() => preferences.set("appearance.v1", JSON.stringify(value))).then(() => setError("")).catch(() => setError("Could not save appearance preferences. Please try again."));
    }, 250);
    return () => clearTimeout(timer);
  }, [value, ready]);
  return <Appearance.Provider value={{ ...value, ready, error, update: (patch) => { if (!ready) return; edited.current = true; setValue((current) => ({ ...current, ...patch })); } }}>{children}</Appearance.Provider>;
}
export function accentPalette(base: Palette, accent: Options["accent"], dark: boolean): Palette {
  const colors = accents[accent];
  const background = dark && accent !== "forest" ? { bg: "#101827", surface: "#192335", ink: "#F1F3FA", muted: "#ADB8CA", line: "#344055" } : {};
  return { ...base, ...background, brand: colors[dark ? 1 : 0], soft: colors[dark ? 3 : 2], accent: colors[1] };
}
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (active) setReduced(v); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}
export function AnimatedToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const c = useTheme();
  const reduced = useReducedMotion();
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    const animation = Animated.timing(position, { toValue: value ? 1 : 0, duration: reduced ? 0 : 200, useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [value, reduced, position]);
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
    <Label>{label}</Label><View style={{ width: 56, height: 32, borderRadius: 20, backgroundColor: value ? c.brand : c.line, padding: 4 }}><Animated.View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.bg, transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, 24] }) }] }} /></View>
  </Pressable>;
}
export function AppearanceSettings() {
  const a = useAppearance(); const c = useTheme();
  return <View style={{ gap: 14 }}>
    <Label>Accent color</Label>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {Object.entries(accents).map(([name, colors]) => <Pressable key={name} disabled={!a.ready} accessibilityRole="button" accessibilityLabel={`${name} accent`} accessibilityState={{ selected: a.accent === name }} onPress={() => a.update({ accent: name as Options["accent"] })} style={{ minHeight: 48, padding: 10, borderRadius: 14, borderWidth: 2, borderColor: a.accent === name ? c.brand : c.line, flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors[0] }} /><Text style={{ color: c.ink, textTransform: "capitalize" }}>{name}{a.accent === name ? " ✓" : ""}</Text></Pressable>)}
    </View>
    <Field label="Your greeting (optional)" placeholder="Make room for what matters" value={a.greeting} editable={a.ready} maxLength={60} onChangeText={(greeting) => a.update({ greeting })} />
    <Label>Dashboard spacing</Label>
    <Choice options={["comfortable", "compact"]} value={a.layout} onChange={(layout) => a.update({ layout: layout as Options["layout"] })} />
    <AnimatedToggle label="Decorative depth accent" value={a.depth} onChange={(depth) => a.update({ depth })} />
    {!!a.error && <Text accessibilityRole="alert" style={{ color: c.danger }}>{a.error}</Text>}
  </View>;
}

