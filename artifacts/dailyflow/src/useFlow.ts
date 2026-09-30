import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Crypto from "expo-crypto";
import { itemSchema, reconcileSync, type FlowItem } from "@workspace/flow-core";
import { loadState, saveState, clearOwner, type LocalState } from "./storage";
import { syncItems, logout } from "./api";
import { useAuth } from "./auth/AuthProvider";
export function useFlow() {
  const auth = useAuth();
  const [data, setData] = useState<LocalState>({
    items: [],
    dirty: [],
    cursor: 0,
  });
  const state = useRef(data);
  const [loadedOwner, setLoadedOwner] = useState("");
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(
    "Connecting to your private workspace…",
  );
  const lock = useRef(false);
  const epoch = useRef(0);
  const owner = useRef("");
  const userId = auth.session?.user.id ?? "";
  const publish = useCallback((next: LocalState) => {
    if (!owner.current) return;
    state.current = next;
    setData(next);
    void saveState(owner.current, next).catch(() =>
      setError(
        "Your latest changes could not be saved to this device. Export a backup before closing.",
      ),
    );
  }, []);
  useEffect(() => {
    const generation = ++epoch.current;
    owner.current = userId;
    setLoadedOwner("");
    state.current = { items: [], dirty: [], cursor: 0 };
    setData(state.current);
    setError("");
    if (!userId) return;
    void loadState(userId)
      .then((next) => {
        if (generation !== epoch.current) return;
        state.current = next;
        setData(next);
        setLoadedOwner(userId);
      })
      .catch(() =>
        setError(
          "Could not read saved data. It has not been overwritten. Please reopen the app.",
        ),
      );
  }, [userId]);
  const ready = !auth.loading && (!userId || loadedOwner === userId);
  const put = useCallback(
    (item: FlowItem) => {
      if (!owner.current) throw new Error("Please sign in.");
      const valid = itemSchema.parse(item);
      publish({
        ...state.current,
        items: [...state.current.items.filter((i) => i.id !== item.id), valid],
        dirty: [...new Set([...state.current.dirty, item.id])],
      });
    },
    [publish],
  );
  const update = useCallback(
    (id: string, patch: Partial<FlowItem>) => {
      const item = state.current.items.find((i) => i.id === id);
      if (item)
        put({
          ...item,
          ...patch,
          id,
          version: item.version,
          updatedAt: new Date(
            Math.max(Date.now(), Date.parse(item.updatedAt) + 1),
          ).toISOString(),
        });
    },
    [put],
  );
  async function sync() {
    if (!userId || !ready || lock.current) return;
    lock.current = true;
    setSyncing(true);
    const generation = epoch.current;
    const sent = state.current.items
      .filter((i) => state.current.dirty.includes(i.id))
      .slice(0, 500);
    try {
      const remote = await syncItems(sent, state.current.cursor ?? 0);
      if (generation !== epoch.current) return;
      const merged = new Map(state.current.items.map((i) => [i.id, i]));
      for (const item of remote.items) merged.set(item.id, item);
      const next = reconcileSync(
        state.current.items,
        sent,
        { items: [...merged.values()], conflicts: remote.conflicts },
        Crypto.randomUUID,
        state.current.dirty,
      );
      if (sent.length || remote.cursor !== (state.current.cursor ?? 0))
        publish({ ...next, cursor: remote.cursor });
      setSyncMessage(
        remote.conflicts.length
          ? "Changes overlapped. Both versions were kept; review the local copy."
          : `Synced at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      );
    } catch (e) {
      if (generation === epoch.current)
        setSyncMessage(
          e instanceof Error
            ? e.message
            : "Offline. Your changes are queued for sync.",
        );
    } finally {
      lock.current = false;
      setSyncing(false);
    }
  }
  const syncRef = useRef(sync);
  syncRef.current = sync;
  useEffect(() => {
    if (!ready || !userId) return;
    void syncRef.current();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void syncRef.current();
    }, 60000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void syncRef.current();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [ready, userId]);
  useEffect(() => {
    if (!ready || !userId || !data.dirty.length) return;
    const timer = setTimeout(() => void syncRef.current(), 2500);
    return () => clearTimeout(timer);
  }, [data, ready, userId]);
  async function disconnect(deleted = false) {
    const id = owner.current;
    if (!deleted && state.current.dirty.length)
      throw new Error("Sync your pending changes before signing out.");
    if (!deleted) await logout();
    if (id) await clearOwner(id);
  }
  function importItems(items: FlowItem[]) {
    const additions = items
      .filter((i) => !i.deletedAt)
      .map((i) => ({
        ...i,
        id: Crypto.randomUUID(),
        version: 0,
        source: "import" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    publish({
      ...state.current,
      items: [...state.current.items, ...additions],
      dirty: [...state.current.dirty, ...additions.map((i) => i.id)],
    });
  }
  async function importLegacy() {
    const old = await loadState("guest");
    if (!old.items.length)
      throw new Error("There are no device-only items to import.");
    importItems(old.items);
  }
  return {
    items: data.items,
    pending: data.dirty.length,
    ready,
    error,
    setError,
    session: auth.session,
    syncing,
    syncMessage,
    put,
    update,
    sync,
    disconnect,
    importItems,
    importLegacy,
    clearLocal: () => clearOwner("guest"),
  };
}
