import { client } from "./supabase";
import { identity } from "./identity";
export type Profile = { id: string; display_name: string; created_at: string };
export async function getProfile(): Promise<Profile> {
  const { data, error } = await client()
    .from("profiles")
    .select("id,display_name,created_at")
    .single();
  if (error) throw error;
  return data;
}
export async function saveProfile(displayName: string) {
  if (displayName.trim().length > 80)
    throw new Error("Use a display name of up to 80 characters.");
  const { user } = await identity();
  if (!user) throw new Error("Please sign in again.");
  const { error } = await client()
    .from("profiles")
    .update({ display_name: displayName.trim() })
    .eq("id", user.id);
  if (error) throw error;
}
