import { getApps, initializeApp } from "firebase/app";
import { initializeAuth, getAuth } from "firebase/auth";
// Metro selects Firebase's React Native export; the default web declarations omit this API.
// @ts-expect-error Firebase exposes this function in its React Native entry point.
import { getReactNativePersistence } from "firebase/auth";
import { secureStorage } from "./secureStorage";

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
};
export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
const existingApp = getApps().find((app) => app.name === "dailyflow");
const app = firebaseConfigured
  ? (existingApp ?? initializeApp(firebaseConfig, "dailyflow"))
  : null;
// Firebase storage keys contain ':'; SecureStore only accepts alphanumeric, '.', '-', '_'.
const key = (value: string) =>
  `firebase.${Array.from(value)
    .map((c) => c.charCodeAt(0).toString(16))
    .join("-")}`;
export const firebaseAuth = app
  ? existingApp
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence({
          getItem: (value: string) => secureStorage.getItem(key(value)),
          setItem: (value: string, data: string) =>
            secureStorage.setItem(key(value), data),
          removeItem: (value: string) => secureStorage.removeItem(key(value)),
        }),
      })
  : null;
export function authClient() {
  if (!firebaseAuth)
    throw new Error(
      "Firebase Authentication has not been configured for this build.",
    );
  return firebaseAuth;
}
