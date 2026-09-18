import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { PrivateUserView } from "@souk/shared";
import { fetchMe, login as apiLogin, logout as apiLogout, signup as apiSignup } from "../api/auth.js";
import { getToken } from "../api/client.js";

interface AuthState {
  user: PrivateUserView | null;
  status: "loading" | "signed-in" | "signed-out";
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PrivateUserView | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>("loading");

  useEffect(() => {
    if (!getToken()) {
      setStatus("signed-out");
      return;
    }
    fetchMe()
      .then((u) => {
        setUser(u);
        setStatus("signed-in");
      })
      .catch(() => {
        setUser(null);
        setStatus("signed-out");
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await apiLogin({ email, password });
    setUser(u);
    setStatus("signed-in");
  }, []);

  const signup = useCallback(async (email: string, username: string, password: string) => {
    const u = await apiSignup({ email, username, password });
    setUser(u);
    setStatus("signed-in");
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setStatus("signed-out");
  }, []);

  const refreshUser = useCallback(async () => {
    const u = await fetchMe();
    setUser(u);
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}
