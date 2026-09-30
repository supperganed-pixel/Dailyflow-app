import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
export const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").replace(
  /\/$/,
  "",
);
export const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
function validClientKey(key: string) {
  if (key.startsWith("sb_publishable_")) return true;
  try {
    return (
      JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
        .role === "anon"
    );
  } catch {
    return false;
  }
}
export const supabaseConfigured =
  /^https:\/\/[^/]+$/.test(supabaseUrl) && validClientKey(publishableKey);
import { firebaseAuth } from "./firebase";
export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, publishableKey, {
      accessToken: async () => {
        const user = firebaseAuth?.currentUser;
        return user?.emailVerified ? user.getIdToken() : null;
      },
      global: {
        fetch: async (input, init) => {
          const controller = new AbortController();
          const incoming = init?.signal;
          const abort = () => controller.abort();
          if (incoming?.aborted) abort();
          incoming?.addEventListener("abort", abort, { once: true });
          const timeout = setTimeout(abort, 30000);
          try {
            return await fetch(input, { ...init, signal: controller.signal });
          } finally {
            clearTimeout(timeout);
            incoming?.removeEventListener("abort", abort);
          }
        },
      },
    })
  : null;
export function client() {
  if (!supabase)
    throw new Error("Supabase has not been configured for this build.");
  return supabase;
}
