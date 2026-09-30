import { useEffect, useState } from "react";
import { View, Text, Linking } from "react-native";
import { Button, Label, useTheme } from "../ui";
import { Skeleton, FadeIn } from "../components/Loading";
import {
  currentVersion,
  getReleases,
  isNewer,
  releaseRepo,
  type Release,
} from "../services/releases";
export default function Releases() {
  const c = useTheme();
  const [rows, setRows] = useState<Release[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  async function load(force = false) {
    setBusy(true);
    setError("");
    try {
      const result = await getReleases(force);
      setRows(result.releases);
      setStale(result.stale);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Downloads could not load.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setError("Could not open this download. Please try again.");
    }
  };
  return (
    <FadeIn>
      <View style={{ gap: 18 }}>
        <Label>Installed version {currentVersion}</Label>
        <Label muted>
          Android APKs and release notes are published on GitHub. Your installed
          app is updated only when you choose to install a download.
        </Label>
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: c.danger }}>
            {error}
          </Text>
        )}
        {stale && (
          <Label muted>
            Showing saved release information. Reconnect to check for updates.
          </Label>
        )}
        <Button
          title={busy ? "Checking…" : "Check for updates"}
          icon="refresh-cw"
          disabled={busy}
          onPress={() => void load(true)}
        />
        {busy ? (
          <Skeleton />
        ) : !rows.length ? (
          <Label>No releases have been published yet.</Label>
        ) : (
          rows.map((r, index) => (
            <View
              key={r.id}
              style={{
                padding: 22,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: 18,
                backgroundColor: c.surface,
                gap: 14,
              }}
            >
              <Text
                accessibilityRole="header"
                style={{ fontSize: 22, color: c.ink, fontWeight: "600" }}
              >
                {r.name}
                {r.prerelease ? " · Preview" : ""}
              </Text>
              <Label small muted>
                {r.tag_name} ·{" "}
                {Number.isNaN(Date.parse(r.published_at))
                  ? "Date unavailable"
                  : new Date(r.published_at).toLocaleDateString()}{" "}
                ·{" "}
                {r.assets
                  .reduce((sum, a) => sum + a.download_count, 0)
                  .toLocaleString()}{" "}
                APK downloads
              </Label>
              {index === 0 && !r.prerelease && isNewer(r.tag_name, currentVersion) && (
                <Label>A newer version is available.</Label>
              )}
              <Text selectable style={{ color: c.ink, lineHeight: 23 }}>
                {r.body}
              </Text>
              {r.assets.map((a, i) => (
                <Button
                  key={a.id}
                  title={`${index === 0 && i === 0 ? "Download Latest Version" : a.name} · ${(a.size / 1048576).toFixed(1)} MB`}
                  icon="download"
                  primary={index === 0 && i === 0}
                  onPress={() => void open(a.browser_download_url)}
                />
              ))}
              {!r.assets.length && (
                <Label muted>
                  The Android download has not been attached to this release.
                </Label>
              )}
              <Button
                title="View release on GitHub"
                onPress={() => void open(r.html_url)}
              />
            </View>
          ))
        )}
        <Button
          title="Open downloads repository"
          onPress={() =>
            void open(`https://github.com/${releaseRepo}/releases`)
          }
        />
      </View>
    </FadeIn>
  );
}
