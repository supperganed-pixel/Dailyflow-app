import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { onIdTokenChanged, reload, type User } from "firebase/auth";
import { firebaseAuth } from "../services/firebase";
import { clearIdentity, identity, type AppSession } from "../services/identity";

type AuthState = {
  session: AppSession | null;
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};
const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
  error: "",
  refresh: async () => {},
});
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const revision = useRef(0),
    live = useRef(true);
  const hydrate = useCallback(async (next: User | null) => {
    const current = ++revision.current;
    setUser(next);
    setError("");
    setSession((previous) =>
      previous?.user.firebaseUid === next?.uid ? previous : null,
    );
    if (!next?.emailVerified) {
      clearIdentity();
      setSession(null);
      setLoading(false);
      return;
    }
    try {
      const value = await identity(next);
      if (live.current && current === revision.current) setSession(value);
    } catch (e) {
      if (live.current && current === revision.current) {
        setSession(null);
        setError(
          e instanceof Error ? e.message : "Could not connect your account.",
        );
      }
    } finally {
      if (live.current && current === revision.current) setLoading(false);
    }
  }, []);
  const refresh = useCallback(async () => {
    const next = firebaseAuth?.currentUser;
    if (next) {
      await reload(next);
      await next.getIdToken(true);
    }
    await hydrate(next ?? null);
  }, [hydrate]);
  useEffect(() => {
    live.current = true;
    if (!firebaseAuth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onIdTokenChanged(
      firebaseAuth,
      (next) => {
        void hydrate(next);
      },
      () => {
        setError("Could not restore your sign-in. Please reopen the app.");
        setSession(null);
        setLoading(false);
      },
    );
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active")
        void refresh().catch(() =>
          setError("Could not refresh your account. Please retry."),
        );
    });
    return () => {
      live.current = false;
      revision.current++;
      unsubscribe();
      foreground.remove();
    };
  }, [hydrate, refresh]);
  return (
    <AuthContext.Provider value={{ session, user, loading, error, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
