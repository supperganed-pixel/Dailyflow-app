import AsyncStorage from "@react-native-async-storage/async-storage";
import { itemSchema, migrateLegacy, type FlowItem } from "@workspace/flow-core";
import * as Crypto from "expo-crypto";

export type LocalState = {
  items: FlowItem[];
  dirty: string[];
  cursor?: number;
};
const key = (owner: string) => `dailyflow.v1.${owner}`;
export async function loadState(owner: string): Promise<LocalState> {
  const raw = await AsyncStorage.getItem(key(owner));
  if (!raw) {
    if (owner === "guest") {
      const legacy =
        (await AsyncStorage.getItem("@dailyflow/local-state-v2")) ??
        (await AsyncStorage.getItem("@dailyflow/local-state"));
      if (legacy) {
        const items = migrateLegacy(JSON.parse(legacy), Crypto.randomUUID);
        const next = { items, dirty: items.map((i) => i.id) };
        await saveState(owner, next);
        return next;
      }
    }
    return { items: [], dirty: [] };
  }
  const data = JSON.parse(raw);
  const items = itemSchema.array().parse(data.items);
  if (
    !Array.isArray(data.dirty) ||
    data.dirty.some((x: unknown) => typeof x !== "string")
  )
    throw new Error(
      "Saved data could not be read. Export or restore a backup before continuing.",
    );
  return {
    items,
    dirty: data.dirty,
    cursor: Number.isSafeInteger(data.cursor) ? data.cursor : 0,
  };
}
// Serialize writes so a slow earlier write cannot replace newer edits.
let writes = Promise.resolve();
export function saveState(owner: string, state: LocalState) {
  const data = JSON.stringify(state);
  const next = writes
    .catch(() => {})
    .then(() => AsyncStorage.setItem(key(owner), data));
  writes = next;
  return next;
}
export async function clearOwner(owner: string) {
  await writes.catch(() => {});
  await AsyncStorage.removeItem(key(owner));
  if (owner === "guest")
    await AsyncStorage.multiRemove([
      "@dailyflow/local-state-v2",
      "@dailyflow/local-state",
    ]);
}
export const preferences = {
  get: async (key: string) => AsyncStorage.getItem(`dailyflow.pref.${key}`),
  set: async (key: string, value: string) =>
    AsyncStorage.setItem(`dailyflow.pref.${key}`, value),
};
