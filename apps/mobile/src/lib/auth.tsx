import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthResponseDTO, MeDTO } from "@sukkot/shared";
import { api, loadToken, saveToken, setUnauthorizedHandler } from "./api";

interface AuthState {
  user: MeDTO | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { fullName: string; email: string; phone?: string; password: string; accountType: "USER" | "OWNER" | "AGENT"; acceptTerms: boolean }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeDTO | null>(null);
  const [ready, setReady] = useState(false);

  const clear = useCallback(async () => {
    await saveToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setUser(await api<MeDTO>("/me"));
    } catch {
      /* 401 is handled by the unauthorized handler; network errors keep the cached user */
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void clear());
    (async () => {
      if (await loadToken()) await refresh();
      setReady(true);
    })();
    return () => setUnauthorizedHandler(null);
  }, [clear, refresh]);

  const accept = useCallback(async (res: AuthResponseDTO) => {
    if (!res.token) throw new Error("The server did not return a session for this app.");
    await saveToken(res.token);
    setUser(res.user);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      refresh,
      signIn: async (email, password) => accept(await api<AuthResponseDTO>("/auth/login", { body: { email, password } })),
      signUp: async (input) => accept(await api<AuthResponseDTO>("/auth/register", { body: input })),
      signOut: async () => {
        await api("/auth/logout", { method: "POST", body: {} }).catch(() => undefined);
        await clear();
      },
    }),
    [user, ready, refresh, accept, clear],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
