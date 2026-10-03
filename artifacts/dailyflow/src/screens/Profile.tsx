import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { avatarChoices, type Avatar } from "../services/profile";
import { useProfile } from "../ProfileContext";
import { useAuth } from "../auth/AuthProvider";
import { Button, Field, Icon, Label, useTheme, s } from "../ui";
export default function Profile() {
  const c = useTheme(); const { profile, loading, error, reload, save } = useProfile();
  const { user } = useAuth();
  const [name, setName] = useState(""); const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<Avatar>("initials");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { if (profile) { setName(profile.display_name); setBio(profile.bio); setAvatar(profile.avatar); } }, [profile]);
  if (loading) return <View style={{ padding: 24, gap: 10 }}><ActivityIndicator color={c.brand} /><Label>Loading your profile…</Label></View>;
  if (!profile) return <View style={{ gap: 12 }}><Label>{error || "Sign in to view your profile."}</Label><Button title="Try again" onPress={reload} /></View>;
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "DF";
  return <View style={{ gap: 16 }}>
    <View style={{ padding: 22, borderRadius: 20, backgroundColor: c.soft, alignItems: "center", gap: 10 }}>
      <View accessibilityLabel="Profile avatar" style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", borderColor: c.brand, borderWidth: 2 }}>{avatar === "initials" ? <Text style={{ color: c.brand, fontSize: 25, fontWeight: "700" }}>{initials}</Text> : <Icon name={avatar} color={c.brand} size={32} />}</View>
      <Text accessibilityRole="header" style={{ color: c.ink, fontSize: 22, fontWeight: "600" }}>{name.trim() || "Your profile"}</Text>
      <Text selectable style={{ color: c.muted }}>{user?.email}</Text>
      <Label small muted>{user?.emailVerified ? "Verified email" : "Email not verified"} · Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</Label>
    </View>
    <Label>Choose your avatar</Label>
    <View style={s.wrap}>{avatarChoices.map((choice) => <Pressable key={choice} disabled={busy} accessibilityRole="button" accessibilityLabel={`${choice} avatar`} accessibilityState={{ selected: choice === avatar }} onPress={() => setAvatar(choice)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.soft, borderWidth: 2, borderColor: avatar === choice ? c.brand : c.line, alignItems: "center", justifyContent: "center" }}>{choice === "initials" ? <Text style={{ color: c.ink, fontWeight: "600" }}>{initials}</Text> : <Icon name={choice} />}</Pressable>)}</View>
    <Field label="Display name" value={name} maxLength={80} editable={!busy} onChangeText={setName} autoCapitalize="words" />
    <Field label="About you (optional)" placeholder="A little about you or what you're working toward" value={bio} maxLength={240} editable={!busy} onChangeText={setBio} multiline />
    <Label small muted>{bio.length}/240 · Your profile is private to your account.</Label>
    <Button title={busy ? "Saving…" : "Save profile"} primary disabled={busy || !name.trim()} onPress={() => { setBusy(true); setMessage(""); void save({ display_name: name, bio, avatar }).then(() => setMessage("Profile saved.")).catch((e) => setMessage(e instanceof Error ? e.message : "Could not save. Please retry.")).finally(() => setBusy(false)); }} />
    {!!message && <Text accessibilityLiveRegion="polite" style={{ color: c.ink }}>{message}</Text>}
  </View>;
}

