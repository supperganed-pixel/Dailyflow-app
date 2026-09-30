import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Icon, Theme, type Palette } from "../ui";

export const authColors: Palette = {
  bg: "#11150F",
  surface: "#1D2219",
  ink: "#F7F8EF",
  muted: "#BCC1B1",
  line: "#414837",
  brand: "#F4D36B",
  soft: "#2A3023",
  accent: "#F4D36B",
  danger: "#FFB1A5",
};
const colors = authColors;
const sparks = [
  [9, 19],
  [24, 69],
  [39, 31],
  [61, 84],
  [76, 20],
  [88, 63],
  [16, 90],
  [68, 47],
];

/** One shared animation keeps the scene inexpensive; motion preferences are respected. */
export function AuthScene({
  children,
  transitionKey,
}: {
  children: React.ReactNode;
  transitionKey: string;
}) {
  const [sceneWidth, setSceneWidth] = useState(0);
  const wide = sceneWidth >= 870;
  const [lit, setLit] = useState(true);
  const [reduced, setReduced] = useState(true);
  const [active, setActive] = useState(AppState.currentState === "active");
  const drift = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(1)).current;
  const native = Platform.OS !== "web";
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    const visibility = AppState.addEventListener("change", (value) =>
      setActive(value === "active"),
    );
    return () => {
      mounted = false;
      motion.remove();
      visibility.remove();
    };
  }, []);
  useEffect(() => {
    if (reduced || !active || !lit) {
      drift.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: native,
          isInteraction: false,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: native,
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [active, drift, lit, native, reduced]);
  useEffect(() => {
    entrance.setValue(reduced ? 1 : 0);
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native,
    });
    animation.start();
    return () => animation.stop();
  }, [transitionKey, entrance, native, reduced]);
  useEffect(() => {
    const animation = Animated.timing(glow, {
      toValue: lit ? 1 : 0,
      duration: reduced ? 0 : 400,
      useNativeDriver: native,
    });
    animation.start();
    return () => animation.stop();
  }, [lit, reduced, glow, native]);
  return (
    <Theme.Provider value={colors}>
      <View
        style={s.scene}
        onLayout={(event) => setSceneWidth(event.nativeEvent.layout.width)}
      >
        <View style={s.brand}>
          <View style={s.brandMark}>
            <Icon name="wind" color={colors.brand} size={22} />
          </View>
          <Text style={s.brandName}>
            DailyFlow<Text style={{ color: colors.brand }}>.</Text>
          </Text>
          <Text style={s.brandHint}>A LITTLE CLARITY, EVERY DAY</Text>
        </View>
        <View
          style={[
            s.layout,
            { flexDirection: wide ? "row" : "column", gap: wide ? 52 : 24 },
          ]}
        >
          <View style={[s.aside, { width: wide ? 330 : "100%" }]}>
            <View
              style={{
                height: wide ? 330 : 136,
                width: "100%",
                alignItems: "center",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: 300,
                  height: 325,
                  transform: [{ scale: wide ? 1 : 0.4 }],
                  marginTop: wide ? 0 : -95,
                }}
              >
                <View
                  pointerEvents="none"
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={StyleSheet.absoluteFill}
                >
                  <Animated.View style={[s.halo, { opacity: glow }]} />
                  <Animated.View style={[s.beam, { opacity: glow }]} />
                  <Animated.View style={[s.innerBeam, { opacity: glow }]} />
                  <View style={s.stem} />
                  <View style={s.base} />
                  <View style={s.shade} />
                  <Animated.View style={[s.bulb, { opacity: glow }]} />
                  <View style={s.cord} />
                  {sparks.map(([left, top], i) => (
                    <Animated.View
                      key={i}
                      style={[
                        s.spark,
                        {
                          left: `${left}%`,
                          top: `${top}%`,
                          opacity: lit
                            ? drift.interpolate({
                                inputRange: [0, 1],
                                outputRange: i % 2 ? [0.3, 0.8] : [0.75, 0.25],
                              })
                            : 0,
                          transform: [
                            {
                              translateY: drift.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, i % 2 ? -15 : 12],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  ))}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    lit ? "Turn decorative lamp off" : "Turn decorative lamp on"
                  }
                  accessibilityState={{ selected: lit }}
                  onPress={() => setLit((value) => !value)}
                  style={({ pressed }) => [
                    s.switch,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <View
                    style={[
                      s.pull,
                      { backgroundColor: lit ? colors.brand : colors.muted },
                    ]}
                  />
                </Pressable>
              </View>
            </View>
            {wide && (
              <>
                <Text style={s.eyebrow}>YOUR SPACE TO FOCUS</Text>
                <Text style={s.headline}>
                  A brighter start.{"\n"}A calmer day.
                </Text>
                <Text style={s.description}>
                  Bring your tasks, ideas and next steps into one quiet place.
                </Text>
              </>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => setLit((value) => !value)}
              accessibilityLabel={
                lit ? "Turn decorative lamp off" : "Turn decorative lamp on"
              }
              style={s.lampHint}
            >
              <Icon
                name={lit ? "sun" : "moon"}
                size={13}
                color={colors.brand}
              />
              <Text style={s.hintText}>
                {lit
                  ? "A little light for your next step"
                  : "Your quiet corner, lights low"}
              </Text>
            </Pressable>
          </View>
          <View
            style={[
              s.card,
              { padding: wide ? 36 : 24, width: wide ? 450 : "100%" },
            ]}
          >
            <View style={s.cardAccent} />
            <Animated.View
              style={{
                gap: 18,
                opacity: entrance,
                transform: [
                  {
                    translateY: entrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              }}
            >
              {children}
            </Animated.View>
          </View>
        </View>
        <View style={s.footer}>
          <Icon name="lock" size={12} color={colors.muted} />
          <Text style={s.footerText}>
            Your space. Your pace. Your DailyFlow.
          </Text>
        </View>
      </View>
    </Theme.Provider>
  );
}

export function AuthField({
  label,
  secureTextEntry,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false),
    [visible, setVisible] = useState(false);
  const icon = label.includes("mail")
    ? "mail"
    : secureTextEntry
      ? "lock"
      : "user";
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View
        style={[
          s.inputWrap,
          focused && { borderColor: colors.brand, backgroundColor: "#23291B" },
        ]}
      >
        <Icon
          name={icon}
          size={17}
          color={focused ? colors.brand : colors.muted}
        />
        <TextInput
          {...props}
          accessibilityLabel={label}
          placeholderTextColor="#8A9380"
          secureTextEntry={secureTextEntry && !visible}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[s.input, props.style]}
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            onPress={() => setVisible((value) => !value)}
            style={s.eye}
          >
            <Icon
              name={visible ? "eye-off" : "eye"}
              size={17}
              color={colors.muted}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  scene: { width: "100%", maxWidth: 980, alignSelf: "center" },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 32,
    flexWrap: "wrap",
  },
  brandMark: {
    padding: 9,
    backgroundColor: "#242B1B",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#454C2C",
  },
  brandName: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  brandHint: {
    color: "#9CA68F",
    fontSize: 9,
    letterSpacing: 1.7,
    marginLeft: "auto",
  },
  layout: { alignItems: "center", justifyContent: "center" },
  aside: { alignItems: "center" },
  halo: {
    position: "absolute",
    top: 36,
    left: 85,
    width: 130,
    height: 100,
    borderRadius: 65,
    backgroundColor: "#F4D36B12",
  },
  beam: {
    position: "absolute",
    top: 96,
    left: 15,
    width: 0,
    height: 0,
    borderLeftWidth: 135,
    borderRightWidth: 135,
    borderBottomWidth: 210,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#F4D36B14",
  },
  innerBeam: {
    position: "absolute",
    top: 96,
    left: 50,
    width: 0,
    height: 0,
    borderLeftWidth: 100,
    borderRightWidth: 100,
    borderBottomWidth: 208,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#F4D36B15",
  },
  shade: {
    position: "absolute",
    top: 67,
    left: 106,
    width: 88,
    height: 37,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: "#292D25",
    borderTopWidth: 2,
    borderTopColor: "#4D523E",
    borderBottomWidth: 3,
    borderBottomColor: "#11150F",
  },
  bulb: {
    position: "absolute",
    top: 103,
    left: 114,
    width: 72,
    height: 3,
    borderRadius: 4,
    backgroundColor: "#FFEAA2",
  },
  stem: {
    position: "absolute",
    top: 105,
    left: 148,
    width: 5,
    height: 187,
    backgroundColor: "#363C2A",
    borderLeftWidth: 1,
    borderLeftColor: "#A09A59",
  },
  base: {
    position: "absolute",
    top: 291,
    left: 116,
    width: 70,
    height: 9,
    borderRadius: 10,
    backgroundColor: "#393D2D",
    borderBottomWidth: 4,
    borderBottomColor: "#090D08",
  },
  cord: {
    position: "absolute",
    top: 105,
    left: 177,
    width: 1,
    height: 46,
    backgroundColor: "#B9AB73",
  },
  switch: {
    position: "absolute",
    top: 126,
    left: 155,
    width: 46,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  pull: { width: 7, height: 15, borderRadius: 5 },
  spark: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 3,
    backgroundColor: "#F6DE79",
  },
  eyebrow: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2.4,
    marginTop: 14,
  },
  headline: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 42,
    letterSpacing: -1,
    marginTop: 14,
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 23,
    textAlign: "center",
    maxWidth: 275,
    marginTop: 14,
  },
  lampHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 8,
    marginTop: 7,
  },
  hintText: { color: colors.muted, fontSize: 11 },
  card: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#42482E",
    backgroundColor: "#20251B",
    overflow: "hidden",
  },
  cardAccent: {
    position: "absolute",
    top: 0,
    left: "25%",
    right: "25%",
    height: 2,
    backgroundColor: "#F4D36B80",
  },
  footer: {
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
  },
  footerText: { color: colors.muted, fontSize: 11 },
  fieldLabel: { color: "#D8DDCC", fontSize: 12, fontWeight: "500" },
  inputWrap: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#414837",
    backgroundColor: "#141A11",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 4,
    gap: 10,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    paddingRight: 10,
    color: colors.ink,
    fontSize: 15,
  },
  eye: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
