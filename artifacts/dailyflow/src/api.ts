import {
  signOut,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from "firebase/auth";
import { authClient } from "./services/firebase";
import { clearIdentity } from "./services/identity";
import { syncResponseSchema, type FlowItem } from "@workspace/flow-core";
import { client } from "./services/supabase";
export async function syncItems(changes: FlowItem[], cursor: number) {
  const { data, error } = await client().rpc("sync_flow_items", { changes });
  if (error) throw error;
  const response = syncResponseSchema.parse(data);
  const items = new Map(response.items.map((i) => [i.id, i]));
  let nextCursor = cursor;
  for (let page = 0; page < 20; page++) {
    const { data: rows, error } = await client()
      .from("flow_items")
      .select("payload,version,change_seq")
      .gt("change_seq", nextCursor)
      .order("change_seq")
      .limit(500);
    if (error) throw error;
    for (const row of rows ?? []) {
      items.set(row.payload.id, { ...row.payload, version: row.version });
      nextCursor = Math.max(nextCursor, Number(row.change_seq));
    }
    if (!rows || rows.length < 500) break;
  }
  return { ...response, items: [...items.values()], cursor: nextCursor };
}
export async function logout() {
  await signOut(authClient());
  clearIdentity();
}
export async function deleteAccount(_token: string, password: string) {
  const user = authClient().currentUser;
  if (!user?.email) throw new Error("Please sign in again.");
  await reauthenticateWithCredential(
    user,
    EmailAuthProvider.credential(user.email, password),
  );
  const token = await user.getIdToken(true);
  const { error } = await client().functions.invoke("delete-firebase-account", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error)
    throw new Error(
      "Account cleanup could not finish. Confirm your password and retry.",
    );
  // Delete the Firebase identity only after private cloud data cleanup succeeds.
  await deleteUser(user);
  clearIdentity();
}
