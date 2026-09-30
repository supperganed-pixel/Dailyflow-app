import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { backupSchema, type FlowItem } from "@workspace/flow-core";
export async function exportBackup(items: FlowItem[]) {
  const json = JSON.stringify(
    { format: "dailyflow", version: 1, items },
    null,
    2,
  );
  const name = `dailyflow-${new Date().toISOString().slice(0, 10)}.json`;
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const file = FileSystem.cacheDirectory + name;
  await FileSystem.writeAsStringAsync(file, json);
  try {
    await Sharing.shareAsync(file, {
      mimeType: "application/json",
      dialogTitle: "Save your DailyFlow backup",
    });
  } finally {
    await FileSystem.deleteAsync(file, { idempotent: true });
  }
}
export async function readBackup(): Promise<FlowItem[] | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.size ?? 0) > 15_000_000)
    throw new Error("Choose a backup smaller than 15 MB.");
  const text =
    Platform.OS === "web"
      ? await (await fetch(asset.uri)).text()
      : await FileSystem.readAsStringAsync(asset.uri);
  if (text.length > 15_000_000)
    throw new Error("Choose a backup smaller than 15 MB.");
  return backupSchema.parse(JSON.parse(text)).items;
}
