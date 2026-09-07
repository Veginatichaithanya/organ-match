import * as React from "react";
import { clearSession, getCachedUser, setCachedUser, type SessionUser } from "./auth";
import { hasPermission, type PermissionAction, type Role } from "./permissions";
import { setAccessToken, getAccessToken, http } from "@/services/http";

export interface AuthContextValue {
  user: SessionUser | null;
  /** True once session restoration check has completed. */
  ready: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<SessionUser | null>;
  can: (action: PermissionAction) => boolean;
  role: Role | null;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

function buildSessionUser(u: {
  id: string;
  username: string;
  email: string;
  role: Role;
  hospital_id?: string | null;
  hospital_name?: string | null;
  permissions: string[];
}): SessionUser {
  return {
    id: u.id,
    name: u.username,
    email: u.email,
    role: u.role,
    hospital_id: u.hospital_id ?? null,
    hospital_name: u.hospital_name ?? null,
    organization: u.hospital_name || "National Organ Registry",
    permissions: u.permissions || [],
  };
}

type MeResponse = {
  user: {
    id: string;
    username: string;
    email: string;
    role: Role;
    hospital_id?: string | null;
    hospital_name?: string | null;
    permissions: string[];
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Only initialize cached user if an active access token exists in sessionStorage
  const [user, setUser] = React.useState<SessionUser | null>(() => {
    if (typeof window !== "undefined" && getAccessToken()) {
      return getCachedUser();
    }
    return null;
  });

  const [ready, setReady] = React.useState<boolean>(() => {
    // If running in browser and no active session token exists, mark ready immediately as unauthenticated guest
    if (typeof window !== "undefined" && !getAccessToken()) {
      return true;
    }
    return false;
  });

  const restoreSession = React.useCallback(async (): Promise<SessionUser | null> => {
    if (typeof window === "undefined") {
      setReady(true);
      return null;
    }

    const token = getAccessToken();

    // Only validate or restore if an active session token exists in current session storage
    if (token) {
      try {
        const meRes = await http.get<MeResponse>("/auth/me");
        const sessionUser = buildSessionUser(meRes.data.user);
        setCachedUser(sessionUser);
        setUser(sessionUser);
        setReady(true);
        return sessionUser;
      } catch (err: any) {
        // Access token expired during active session — attempt refresh within active session
        try {
          const refreshRes = await http.post<{ access_token: string }>("/auth/refresh");
          setAccessToken(refreshRes.data.access_token);

          const meRes = await http.get<MeResponse>("/auth/me");
          const sessionUser = buildSessionUser(meRes.data.user);
          setCachedUser(sessionUser);
          setUser(sessionUser);
          setReady(true);
          return sessionUser;
        } catch {
          // Token expired and cannot refresh — reset to guest
          clearSession();
          setUser(null);
          setReady(true);
          return null;
        }
      }
    }

    // No session token present: do NOT automatically restore from background cookies
    clearSession();
    setUser(null);
    setReady(true);
    return null;
  }, []);

  React.useEffect(() => {
    // Restore session on mount only when not yet ready (i.e., a token/cookie may exist that needs validation).
    // If ready=true on mount, the user was already a guest (no token) — no restoration needed.
    if (!ready) {
      restoreSession();
    }
  }, [restoreSession]);

  const login = React.useCallback(async (usernameOrEmail: string, password: string) => {
    const res = await http.post<{
      access_token: string;
      expires_in: number;
      user: {
        id: string;
        username: string;
        email: string;
        role: Role;
        hospital_id?: string | null;
        hospital_name?: string | null;
        permissions: string[];
      };
    }>("/auth/login", {
      username_or_email: usernameOrEmail,
      password,
    });

    setAccessToken(res.data.access_token);
    const sessionUser = buildSessionUser(res.data.user);
    setCachedUser(sessionUser);
    setUser(sessionUser);
    setReady(true);
    return sessionUser;
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await http.post("/auth/logout");
    } catch {
      // ignore network errors on logout
    } finally {
      clearSession();
      setUser(null);
      setReady(true);
    }
  }, []);

  const can = React.useCallback(
    (action: PermissionAction) => (user ? hasPermission(user.role, action) : false),
    [user],
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      login,
      logout,
      refreshSession: restoreSession,
      can,
      role: user?.role ?? null,
    }),
    [user, ready, login, logout, restoreSession, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
