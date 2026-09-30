import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { getProfile, saveProfile } from "../services/profile";
import { Button, Field, useTheme } from "../ui";
export default function Profile() {
  const c = useTheme();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    void getProfile()
      .then((p) => {
        if (live) setName(p.display_name);
      })
      .catch(() => {
        if (live) setMessage("Profile could not load. Please reopen settings.");
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <View style={{ gap: 12 }}>
      <Field
        label="Display name"
        value={name}
        maxLength={80}
        onChangeText={setName}
      />
      <Button
        title={busy ? "Please wait…" : "Save profile"}
        disabled={busy}
        onPress={() => {
          setBusy(true);
          setMessage("");
          void saveProfile(name)
            .then(() => setMessage("Profile saved."))
            .catch(() =>
              setMessage("Could not save your profile. Please retry."),
            )
            .finally(() => setBusy(false));
        }}
      />
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={{ color: c.ink }}>
          {message}
        </Text>
      )}
    </View>
  );
}
