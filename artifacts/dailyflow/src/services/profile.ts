import { client } from "./supabase";
import { identity } from "./identity";
export const avatarChoices = ["initials", "sun", "star", "coffee", "feather", "smile"] as const;
export type Avatar = typeof avatarChoices[number];
export type Profile = { id: string; display_name: string; bio: string; avatar: Avatar; created_at: string };
export async function getProfile(): Promise<Profile> {
  const { user } = await identity();
  if (!user) throw new Error("Please sign in again.");
  const { data, error } = await client()
    .from("profiles")
    .select("id,display_name,bio,avatar,created_at")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  return data;
}
export async function saveProfile(input: Pick<Profile, "display_name" | "bio" | "avatar">, expectedOwner: string) {
  const displayName = input.display_name.trim();
  const bio = input.bio.trim();
  if (!displayName || displayName.length > 80) throw new Error("Enter a display name of 1 to 80 characters.");
  if (bio.length > 240) throw new Error("Keep your bio within 240 characters.");
  if (!avatarChoices.includes(input.avatar)) throw new Error("Choose one of the available avatars.");
  const { user } = await identity();
  if (!user || user.id !== expectedOwner) throw new Error("Your account changed. Please reopen your profile.");
  const { data, error } = await client()
    .from("profiles")
    .update({ display_name: displayName, bio, avatar: input.avatar })
    .eq("id", user.id)
    .select("id,display_name,bio,avatar,created_at")
    .single();
  if (error) throw error;
  return data as Profile;
}

