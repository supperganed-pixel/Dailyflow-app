import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import * as FS from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { client, publishableKey, supabaseUrl } from "./supabase";
import { identity } from "./identity";
export const bucket = "dailyflow-files";
export const maxBytes = 20 * 1024 * 1024;
const types: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export type PrivateFile = {
  name: string;
  id: string;
  created_at: string;
  metadata?: { size?: number; mimetype?: string };
};

async function path(name: string) {
  const session = await identity();
  if (!name || /[\\/]/.test(name) || name === "." || name === "..")
    throw new Error("Invalid filename.");
  return `${session.user.id}/${name}`;
}
export async function listFiles(offset = 0) {
  const session = await identity();
  const { data, error } = await client()
    .storage.from(bucket)
    .list(session.user.id, {
      limit: 50,
      offset,
      sortBy: { column: "created_at", order: "desc" },
    });
  if (error) throw error;
  return (data ?? []).filter((f) => f.id) as PrivateFile[];
}
function signature(bytes: Uint8Array, type: string) {
  const prefix = (...values: number[]) =>
    values.every((v, i) => bytes[i] === v);
  if (type === "image/jpeg") return prefix(255, 216, 255);
  if (type === "image/png") return prefix(137, 80, 78, 71, 13, 10, 26, 10);
  if (type === "image/webp")
    return (
      prefix(82, 73, 70, 70) &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  if (type === "application/pdf") return prefix(37, 80, 68, 70, 45);
  if (type.includes("openxmlformats")) return prefix(80, 75, 3, 4);
  return !bytes.slice(0, 8192).includes(0);
}
export async function uploadFile(
  onProgress: (value: number) => void,
  signal: AbortSignal,
  compress: boolean,
) {
  const selected = await DocumentPicker.getDocumentAsync({
    type: Object.values(types),
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (selected.canceled) return false;
  const asset = selected.assets[0];
  const ext = asset.name.split(".").pop()?.toLowerCase() ?? "";
  let mime = types[ext];
  if (!mime)
    throw new Error("Choose a JPG, PNG, WebP, PDF, TXT, DOCX or XLSX file.");
  if (
    asset.mimeType &&
    asset.mimeType !== "application/octet-stream" &&
    asset.mimeType !== mime
  )
    throw new Error("The filename and file type do not match.");
  if ((asset.size ?? 0) > maxBytes)
    throw new Error("Files must be 20 MB or smaller.");
  let uri = asset.uri;
  let temp: string | undefined;
  try {
    let bytes =
      Platform.OS === "web"
        ? new Uint8Array(
            await (
              asset.file ?? (await (await fetch(uri)).blob())
            ).arrayBuffer(),
          )
        : await new File(uri).bytes();
    if (!bytes.length || bytes.length > maxBytes)
      throw new Error("Choose a non-empty file of 20 MB or smaller.");
    if (!signature(bytes, mime))
      throw new Error("This file does not match its declared type.");
    let name = asset.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-140);
    if (compress && mime.startsWith("image/")) {
      const image = await manipulateAsync(uri, [], {
        compress: 0.8,
        format: SaveFormat.JPEG,
      });
      temp = image.uri;
      const optimized =
        Platform.OS === "web"
          ? new Uint8Array(await (await fetch(image.uri)).arrayBuffer())
          : await new File(image.uri).bytes();
      if (optimized.length < bytes.length) {
        bytes = optimized;
        mime = "image/jpeg";
        name = name.replace(/\.[^.]+$/, ".jpg");
      }
    }
    if (signal.aborted) throw new Error("Upload cancelled.");
    const session = await identity();
    if (signal.aborted) throw new Error("Upload cancelled.");
    const objectPath = `${session.user.id}/${Crypto.randomUUID()}_${name}`;
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const abort = () => xhr.abort();
      signal.addEventListener("abort", abort, { once: true });
      const finish = () => signal.removeEventListener("abort", abort);
      xhr.open(
        "POST",
        `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
      );
      xhr.timeout = 120000;
      xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
      xhr.setRequestHeader("apikey", publishableKey);
      xhr.setRequestHeader("Content-Type", mime);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      };
      xhr.onload = () => {
        finish();
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve();
        } else
          reject(
            new Error(
              xhr.status === 413
                ? "File exceeds the server size limit."
                : "Upload failed. Please check your connection and try again.",
            ),
          );
      };
      xhr.onerror = () => {
        finish();
        reject(new Error("Upload failed. Check your connection."));
      };
      xhr.ontimeout = () => {
        finish();
        reject(new Error("Upload timed out. Please retry."));
      };
      xhr.onabort = () => {
        finish();
        reject(new Error("Upload cancelled."));
      };
      xhr.send(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
      );
    });
    return true;
  } finally {
    if (Platform.OS !== "web") {
      await FS.deleteAsync(asset.uri, { idempotent: true }).catch(() => {});
      if (temp)
        await FS.deleteAsync(temp, { idempotent: true }).catch(() => {});
    }
  }
}
export async function signedUrl(name: string, download = false) {
  const { data, error } = await client()
    .storage.from(bucket)
    .createSignedUrl(
      await path(name),
      60,
      download ? { download: displayFilename(name) } : undefined,
    );
  if (error) throw error;
  return data.signedUrl;
}
export function displayFilename(name: string) {
  return name.replace(/^[0-9a-f-]{36}_/i, "");
}
export async function removeFile(name: string) {
  const { error } = await client()
    .storage.from(bucket)
    .remove([await path(name)]);
  if (error) throw error;
}
export async function downloadFile(name: string) {
  const url = await signedUrl(name, true);
  if (Platform.OS === "web") {
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener noreferrer";
    a.download = displayFilename(name);
    a.click();
    return;
  }
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("File sharing is unavailable on this device.");
  const uri =
    FS.cacheDirectory + Crypto.randomUUID() + "_" + displayFilename(name);
  try {
    await FS.downloadAsync(url, uri);
    await Sharing.shareAsync(uri, { dialogTitle: "Save or open your file" });
  } finally {
    await FS.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}
