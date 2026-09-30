import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
// Native sessions exceed some keychain value limits. Commit a manifest only
// after every chunk is stored, retaining the old generation on failure.
export const secureStorage = {
  async getItem(key: string) {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    const { generation, count } = JSON.parse(raw);
    if (!Number.isInteger(count) || count < 1 || count > 128) return null;
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(`${key}.${generation}.${i}`),
      ),
    );
    return chunks.every((v) => v !== null) ? chunks.join("") : null;
  },
  async setItem(key: string, value: string) {
    const previous = await SecureStore.getItemAsync(key);
    const generation = Crypto.randomUUID();
    const chunks = value.match(/[\s\S]{1,500}/g) ?? [""];
    if (chunks.length > 128)
      throw new Error("Session is too large to store securely.");
    try {
      for (let i = 0; i < chunks.length; i++)
        await SecureStore.setItemAsync(`${key}.${generation}.${i}`, chunks[i], {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
      await SecureStore.setItemAsync(
        key,
        JSON.stringify({ generation, count: chunks.length }),
      );
    } catch (error) {
      await Promise.all(
        chunks.map((_, i) =>
          SecureStore.deleteItemAsync(`${key}.${generation}.${i}`).catch(
            () => {},
          ),
        ),
      );
      throw error;
    }
    if (previous) {
      const old = JSON.parse(previous);
      await Promise.all(
        Array.from({ length: Math.min(old.count, 128) }, (_, i) =>
          SecureStore.deleteItemAsync(`${key}.${old.generation}.${i}`).catch(
            () => {},
          ),
        ),
      );
    }
  },
  async removeItem(key: string) {
    const previous = await SecureStore.getItemAsync(key);
    await SecureStore.deleteItemAsync(key);
    if (previous) {
      const old = JSON.parse(previous);
      await Promise.all(
        Array.from({ length: Math.min(old.count, 128) }, (_, i) =>
          SecureStore.deleteItemAsync(`${key}.${old.generation}.${i}`),
        ),
      );
    }
  },
};
