import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { api, loadStoredToken, setAuthToken } from "../services/api";
import type { User } from "../types";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await loadStoredToken();
        if (stored) {
          setToken(stored);
          const me = await api.me();
          setUser(me);
        }
      } catch {
        await setAuthToken(null);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      login: async (email, password) => {
        const res = await api.login(email.trim().toLowerCase(), password);
        await setAuthToken(res.access_token);
        setToken(res.access_token);
        setUser(res.user);
      },
      logout: async () => {
        await setAuthToken(null);
        setToken(null);
        setUser(null);
      },
      refreshUser: async () => {
        const me = await api.me();
        setUser(me);
      },
    }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
