import { useEffect, useRef, useState } from "react";
import { View, Text, Switch, Linking } from "react-native";
import { Button, Label, useTheme } from "../ui";
import { Skeleton, FadeIn } from "../components/Loading";
import {
  listFiles,
  uploadFile,
  removeFile,
  signedUrl,
  downloadFile,
  displayFilename,
  type PrivateFile,
} from "../services/files";
export default function Files() {
  const c = useTheme();
  const [rows, setRows] = useState<PrivateFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [more, setMore] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [compress, setCompress] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const live = useRef(true);
  async function load(append = false) {
    setLoading(true);
    try {
      const result = await listFiles(append ? rows.length : 0);
      if (live.current) {
        setRows((old) => (append ? [...old, ...result] : result));
        setMore(result.length === 50);
      }
    } catch (e) {
      if (live.current)
        setError(e instanceof Error ? e.message : "Could not load files.");
    } finally {
      if (live.current) setLoading(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      abort.current?.abort();
    };
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      if (live.current)
        setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      if (live.current) {
        setBusy(false);
        setProgress(null);
      }
    }
  }
  return (
    <FadeIn>
      <View style={{ gap: 18 }}>
        <Label muted>
          Private to your account. Up to 20 MB per file: JPG, PNG, WebP, PDF,
          TXT, DOCX and XLSX.
        </Label>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <Label>Compress images as JPEG</Label>
          <Switch
            accessibilityLabel="Compress uploaded images as JPEG"
            value={compress}
            onValueChange={setCompress}
            disabled={busy}
          />
        </View>
        {compress && (
          <Label small muted>
            Compression can remove transparency and metadata. Keep it off to
            preserve the original.
          </Label>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Button
            title={busy ? "Please wait…" : "Upload file"}
            primary
            icon="upload"
            disabled={busy || loading}
            onPress={() =>
              void run(async () => {
                abort.current = new AbortController();
                setProgress(0);
                const done = await uploadFile(
                  (p) => {
                    if (live.current) setProgress(p);
                  },
                  abort.current.signal,
                  compress,
                );
                if (done && live.current) {
                  setMessage("File uploaded.");
                  await load();
                }
              })
            }
          />
          <Button
            title="Refresh files"
            disabled={busy || loading}
            onPress={() => void load()}
          />
        </View>
        {progress !== null && (
          <View style={{ gap: 10 }}>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: progress }}
              accessibilityLabel="File upload"
              style={{
                height: 8,
                backgroundColor: c.line,
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: 8,
                  width: `${progress}%`,
                  backgroundColor: c.brand,
                }}
              />
            </View>
            <Label>{progress}% uploaded</Label>
            <Button
              title="Cancel upload"
              onPress={() => abort.current?.abort()}
            />
          </View>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: c.danger }}>
            {error}
          </Text>
        )}
        {!!message && (
          <Text accessibilityLiveRegion="polite" style={{ color: c.ink }}>
            {message}
          </Text>
        )}
        {loading && !rows.length ? (
          <Skeleton />
        ) : !rows.length ? (
          <Label>Your files will appear here after your first upload.</Label>
        ) : (
          rows.map((file) => (
            <View
              key={file.id}
              style={{
                gap: 12,
                padding: 20,
                borderRadius: 16,
                borderColor: c.line,
                borderWidth: 1,
                backgroundColor: c.surface,
              }}
            >
              <Text style={{ color: c.ink, fontSize: 17, fontWeight: "600" }}>
                {displayFilename(file.name)}
              </Text>
              <Label small muted>
                {((file.metadata?.size ?? 0) / 1048576).toFixed(2)} MB ·{" "}
                {new Date(file.created_at).toLocaleDateString()}
              </Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <Button
                  title="View"
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      await Linking.openURL(await signedUrl(file.name));
                    })
                  }
                />
                <Button
                  title="Download"
                  icon="download"
                  disabled={busy}
                  onPress={() => void run(() => downloadFile(file.name))}
                />
                <Button
                  title="Delete"
                  danger
                  disabled={busy}
                  onPress={() => setConfirm(file.name)}
                />
              </View>
              {confirm === file.name && (
                <View style={{ gap: 10 }}>
                  <Label>Permanently delete this file?</Label>
                  <Button
                    title="Delete permanently"
                    danger
                    disabled={busy}
                    onPress={() =>
                      void run(async () => {
                        await removeFile(file.name);
                        setRows((old) => old.filter((f) => f.id !== file.id));
                        setConfirm(null);
                        setMessage("File deleted.");
                      })
                    }
                  />
                  <Button
                    title="Keep file"
                    disabled={busy}
                    onPress={() => setConfirm(null)}
                  />
                </View>
              )}
            </View>
          ))
        )}
        {more && (
          <Button
            title={loading ? "Loading…" : "Load more files"}
            disabled={loading || busy}
            onPress={() => void load(true)}
          />
        )}
      </View>
    </FadeIn>
  );
}
