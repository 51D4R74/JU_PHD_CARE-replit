import { useSyncExternalStore } from "react";

interface AuthUser {
  readonly id: string;
  readonly username: string;
  readonly name: string;
  readonly role: string;
  readonly department: string | null;
}

let currentUser: AuthUser | null = null;
const listeners = new Set<() => void>();
const AUTH_STORAGE_KEY = "lumina_user";
const LEGACY_AUTH_STORAGE_KEY = "juphd_user";

const stored = globalThis.window === undefined
  ? null
  : localStorage.getItem(AUTH_STORAGE_KEY) ?? localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
if (stored) {
  try { currentUser = JSON.parse(stored); } catch (e: unknown) { console.warn("Corrupt auth state:", e); }
}

function emit() {
  listeners.forEach((l) => l());
}

function setUser(u: AuthUser | null) {
  currentUser = u;
  if (u) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u));
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  }
  emit();
}

async function logout() {
  setUser(null);
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch (e: unknown) { console.warn("Logout cleanup failed:", e); }
}

/** Validate the server session and sync client state. */
async function validateSession(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (res.ok) {
      const user: AuthUser = await res.json();
      setUser(user);
      return user;
    }
  } catch (e: unknown) { console.warn("Session validation failed:", e); }
  // Session gone → clear client state
  setUser(null);
  return null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot() {
  return currentUser;
}

export function useAuth() {
  const authUser = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    user: authUser,
    setUser,
    logout,
    validateSession,
    isAuthenticated: !!authUser,
    isRH: authUser?.role === "rh",
  };
}
