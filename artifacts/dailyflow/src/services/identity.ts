import type { User } from "firebase/auth";
import { authClient } from "./firebase";
import { client } from "./supabase";

export type AppSession = {
  user: { id: string; firebaseUid: string; email: string };
  access_token: string;
};
let cached: { uid: string; owner: string } | null = null;
export function clearIdentity() {
  cached = null;
}
export async function identity(
  user: User | null = authClient().currentUser,
): Promise<AppSession> {
  if (!user?.emailVerified)
    throw new Error("Verify your email before accessing your workspace.");
  const token = await user.getIdToken();
  let owner = cached?.uid === user.uid ? cached.owner : "";
  if (!owner) {
    const { data, error } = await client().rpc("ensure_firebase_profile", {
      display_name: user.displayName ?? "",
    });
    if (error || typeof data !== "string")
      throw new Error(
        "Could not connect your private workspace. Please retry. The app owner may need to finish the Firebase integration.",
      );
    owner = data;
    if (authClient().currentUser?.uid !== user.uid)
      throw new Error("Your account changed. Please try again.");
    cached = { uid: user.uid, owner };
  }
  if (authClient().currentUser?.uid !== user.uid)
    throw new Error("Please sign in again.");
  return {
    user: { id: owner, firebaseUid: user.uid, email: user.email ?? "" },
    access_token: token,
  };
}
