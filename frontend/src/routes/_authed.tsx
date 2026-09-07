import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { canAccessPath } from "@/lib/permissions";
import { AccessDenied, AppShell, FullScreenLoader } from "@/components/app-shell";

export const Route = createFileRoute("/_authed")({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user, ready } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // On SSR (Node environment) or while session restoration is in progress, show loader.
  // IMPORTANT: Do NOT redirect until ready=true — otherwise we bounce to /login before
  // the async restoreSession() has had a chance to rehydrate the user from token/cookie.
  if (typeof window === "undefined" || !ready) return <FullScreenLoader />;

  // Session restoration complete — no authenticated user found
  if (!user) return <Navigate to="/login" />;

  return (
    <AppShell>
      {canAccessPath(user.role, pathname) ? <Outlet /> : <AccessDenied path={pathname} />}
    </AppShell>
  );
}
