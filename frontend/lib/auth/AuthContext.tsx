"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import * as authApi from "../api/auth";
import type { AuthResult, AuthUser } from "../api/auth";

const STORAGE_KEY = "cp_auth";

type StoredAuth = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  signup: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function persist(result: AuthResult) {
  const stored: StoredAuth = {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const stored: StoredAuth = JSON.parse(raw);
        setUser(stored.user);
        setAccessToken(stored.accessToken);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const result = await authApi.login(email, password);
    persist(result);
    setUser(result.user);
    setAccessToken(result.accessToken);
    return result.user;
  }

  async function signup(email: string, password: string) {
    const result = await authApi.signup(email, password);
    persist(result);
    setUser(result.user);
    setAccessToken(result.accessToken);
    return result.user;
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setAccessToken(null);
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
