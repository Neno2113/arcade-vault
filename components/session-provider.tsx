"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { SavedScore, SessionUser } from "@/lib/types";

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

type SessionContextValue = {
  user: SessionUser | null;
  login: (user: SessionUser | null) => void;
  logout: () => void;
  saveScore: (entry: Omit<SavedScore, "at">) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

// Respaldo en memoria por si localStorage está bloqueado.
let memoryUser: string | null = null;
const listeners = new Set<() => void>();

function readUser(): string | null {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return memoryUser;
  }
}

function writeUser(value: string | null) {
  memoryUser = value;
  try {
    if (value === null) localStorage.removeItem(USER_KEY);
    else localStorage.setItem(USER_KEY, value);
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === USER_KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function parseUser(raw: string | null): SessionUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.name === "string" ? { name: parsed.name } : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // En servidor y en la hidratación el snapshot es null (invitado).
  const raw = useSyncExternalStore(subscribe, readUser, () => null);
  const user = useMemo(() => parseUser(raw), [raw]);

  const login = useCallback((u: SessionUser | null) => {
    writeUser(u ? JSON.stringify(u) : null);
  }, []);

  const logout = useCallback(() => writeUser(null), []);

  const saveScore = useCallback((entry: Omit<SavedScore, "at">) => {
    try {
      const all: SavedScore[] = JSON.parse(
        localStorage.getItem(SCORES_KEY) || "[]",
      );
      all.push({ ...entry, at: Date.now() });
      localStorage.setItem(SCORES_KEY, JSON.stringify(all));
    } catch {}
  }, []);

  const value = useMemo(
    () => ({ user, login, logout, saveScore }),
    [user, login, logout, saveScore],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de SessionProvider");
  return ctx;
}
