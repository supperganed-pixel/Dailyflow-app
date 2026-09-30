import React, { createContext, useContext } from "react";
import {
  Text,
  View,
  Pressable,
  TextInput,
  StyleSheet,
  type TextInputProps,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
export const light = {
  bg: "#F6F5F0",
  surface: "#FFFFFF",
  ink: "#203A36",
  muted: "#66756F",
  line: "#E3E7DF",
  brand: "#286650",
  soft: "#EAF0E8",
  accent: "#DCEAAF",
  danger: "#A53D35",
};
export const dark = {
  bg: "#14211F",
  surface: "#1D2D29",
  ink: "#E7EEE6",
  muted: "#ADBBB2",
  line: "#35453F",
  brand: "#B7D594",
  soft: "#2B4036",
  accent: "#DCEAAF",
  danger: "#FFABA1",
};
export type Palette = typeof light;
export const Theme = createContext<Palette>(light);
export const useTheme = () => useContext(Theme);
export function Label({
  children,
  small = false,
  muted = false,
}: {
  children: React.ReactNode;
  small?: boolean;
  muted?: boolean;
}) {
  const c = useTheme();
  return (
    <Text
      style={{
        fontSize: small ? 12 : 15,
        lineHeight: small ? 18 : 23,
        color: muted ? c.muted : c.ink,
      }}
    >
      {children}
    </Text>
  );
}
export function Icon({
  name,
  size = 20,
  color,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  size?: number;
  color?: string;
}) {
  const c = useTheme();
  return <Feather name={name} size={size} color={color ?? c.ink} />;
}
export function Button({
  title,
  onPress,
  icon,
  primary = false,
  danger = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>["name"];
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: primary ? c.brand : c.soft,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        danger && {
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.danger,
        },
      ]}
    >
      {icon && (
        <Icon
          name={icon}
          size={16}
          color={primary ? c.bg : danger ? c.danger : c.ink}
        />
      )}
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: primary ? c.bg : danger ? c.danger : c.ink,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Label small>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...props}
        style={[
          s.field,
          { borderColor: c.line, color: c.ink, backgroundColor: c.surface },
          props.multiline && { minHeight: 100, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Choice({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const c = useTheme();
  return (
    <View style={s.wrap}>
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="button"
          accessibilityState={{ selected: option === value }}
          onPress={() => onChange(option)}
          style={[
            s.chip,
            { backgroundColor: option === value ? c.brand : c.soft },
          ]}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              textTransform: "capitalize",
              color: option === value ? c.bg : c.ink,
            }}
          >
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export const s = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    minHeight: 44,
    paddingHorizontal: 15,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    minHeight: 48,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    justifyContent: "center",
  },
});
