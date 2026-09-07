import type { Role } from "./permissions";
import { setAccessToken } from "@/services/http";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  hospital_id?: string | null;
  hospital_name?: string | null;
  organization: string;
  permissions: string[];
}

const SESSION_KEY = "sods.user_cache";

export function getCachedUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

// Alias for mock compatibility during transition
export const getSession = getCachedUser;

export function setCachedUser(user: SessionUser): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
}

export function clearSession(): void {
  setAccessToken(null);
  if (typeof window !== "undefined") {
    // Clear session storage
    window.sessionStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem("access_token");
    window.sessionStorage.removeItem("auth");
    window.sessionStorage.removeItem("user");

    // Clear any legacy or lingering local storage entries
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem("access_token");
    window.localStorage.removeItem("refresh_token");
    window.localStorage.removeItem("auth");
    window.localStorage.removeItem("user");
    window.localStorage.removeItem("currentUser");
    window.localStorage.removeItem("persistedAuth");
    window.localStorage.removeItem("sods_auth");
  }
}
