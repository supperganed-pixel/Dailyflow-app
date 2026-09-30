import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
};
export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
const app = firebaseConfigured
  ? (getApps().find((app) => app.name === "dailyflow") ??
    initializeApp(firebaseConfig, "dailyflow"))
  : null;
// Web Auth persists sessions in IndexedDB/localStorage by default.
export const firebaseAuth = app ? getAuth(app) : null;
export function authClient() {
  if (!firebaseAuth)
    throw new Error(
      "Firebase Authentication has not been configured for this build.",
    );
  return firebaseAuth;
}
