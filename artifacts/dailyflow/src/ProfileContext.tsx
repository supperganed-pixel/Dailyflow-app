import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth/AuthProvider";
import { getProfile, saveProfile, type Profile } from "./services/profile";
type Changes = Pick<Profile, "display_name" | "bio" | "avatar">;
const Context = createContext<{ profile: Profile | null; loading: boolean; error: string; reload: () => void; save: (input: Changes) => Promise<void> }>({ profile: null, loading: true, error: "", reload: () => {}, save: async () => {} });
export const useProfile = () => useContext(Context);
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth(); const owner = session?.user.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const ownerRef = useRef(owner); ownerRef.current = owner;
  useEffect(() => {
    let live = true; setProfile(null); setError(""); setLoading(!!owner);
    if (owner) void getProfile().then((value) => { if (live && value.id === owner) setProfile(value); }).catch(() => { if (live) setError("Your profile could not load. Check your connection and try again."); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [owner, revision]);
  async function save(input: Changes) {
    if (!owner) throw new Error("Please sign in again.");
    const value = await saveProfile(input, owner);
    if (ownerRef.current === owner) setProfile(value);
  }
  return <Context.Provider value={{ profile: profile?.id === owner ? profile : null, loading, error, reload: () => setRevision((v) => v + 1), save }}>{children}</Context.Provider>;
}

