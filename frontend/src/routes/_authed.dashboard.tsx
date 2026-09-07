import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, HeartHandshake, ShieldAlert, Shuffle, Users, Waves } from "lucide-react";
import { api, ApiError } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { canAccessPath, ROLE_LABELS } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ErrorState,
  fmtDateTime,
  LoadingState,
  PageHeader,
  StatCard,
  StatusBadge,
  TableShell,
  Td,
  Th,
  THead,
  TRow,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — OrganMatch" },
      {
        name: "description",
        content:
          "Network-wide overview of donors, recipients, matches, allocations, and security posture.",
      },
      { property: "og:title", content: "Dashboard — OrganMatch" },
      {
        property: "og:description",
        content:
          "Network-wide overview of donors, recipients, matches, allocations, and security posture.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, ready, logout } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.dashboard(),
    enabled: typeof window !== "undefined" && ready && !!user,
    staleTime: 10000,
    retry: (failureCount, err) => {
      if (err instanceof ApiError && err.status === 401) return false;
      return failureCount < 2;
    },
  });

  useEffect(() => {
    if (typeof window !== "undefined" && error instanceof ApiError && error.status === 401) {
      logout();
      navigate({ to: "/login" });
    }
  }, [error, logout, navigate]);

  if (isLoading) return <LoadingState label="Loading dashboard metrics…" />;
  if (error || !data)
    return (
      <ErrorState message={error instanceof Error ? error.message : "Failed to load dashboard."} />
    );

  const { stats } = data;
  const role = user!.role;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user!.name.split(" ")[0]}`}
        description="Live overview of the donation network, allocation metrics, and security posture."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1 text-xs font-medium">
              {ROLE_LABELS[role]}
            </Badge>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {user!.organization}
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Donors"
          value={stats.donors}
          icon={HeartHandshake}
          onClick={() => navigate({ to: "/donors" })}
        />
        <StatCard
          label="Recipients"
          value={stats.recipients}
          icon={Users}
          onClick={() => navigate({ to: "/recipients" })}
        />
        <StatCard
          label="Available organs"
          value={stats.availableOrgans}
          icon={Waves}
          onClick={() => navigate({ to: "/organs" })}
        />
        <StatCard
          label="Pending matches"
          value={stats.pendingMatches}
          icon={Shuffle}
          onClick={() => navigate({ to: "/matching" })}
        />
        <StatCard
          label="Allocations"
          value={stats.allocations}
          icon={ClipboardCheck}
          onClick={() => navigate({ to: "/allocations" })}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {canAccessPath(role, "/matching") && (
          <Card className="shadow-none">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base font-medium">Recent matches</CardTitle>
              <Link to="/matching" className="text-xs font-medium text-primary hover:underline">
                Run matching engine →
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <TableShell>
                <THead>
                  <Th>Donor</Th>
                  <Th>Organ</Th>
                  <Th>Top recipient</Th>
                  <Th>Score</Th>
                  <Th>Status</Th>
                </THead>
                <tbody>
                  {(!data.recentMatches || data.recentMatches.length === 0) ? (
                    <TRow>
                      <Td colSpan={5} className="text-center text-xs text-muted-foreground py-6">
                        No recent match proposals found.
                      </Td>
                    </TRow>
                  ) : (
                    (data.recentMatches || []).slice(0, 5).map((m, i) => (
                      <TRow key={i}>
                        <Td className="font-mono text-xs">{m.donorId || "—"}</Td>
                        <Td>{m.organType || "Organ"}</Td>
                        <Td className="font-mono text-xs">{m.topRecipient || "—"}</Td>
                        <Td className="font-semibold">{m.matchScore}</Td>
                        <Td>
                          <StatusBadge value={m.status} />
                        </Td>
                      </TRow>
                    ))
                  )}
                </tbody>
              </TableShell>
            </CardContent>
          </Card>
        )}

        {canAccessPath(role, "/allocations") && (
          <Card className="shadow-none">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base font-medium">Recent allocations</CardTitle>
              <Link to="/allocations" className="text-xs font-medium text-primary hover:underline">
                View all allocations →
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <TableShell>
                <THead>
                  <Th>ID</Th>
                  <Th>Organ</Th>
                  <Th>Score</Th>
                  <Th>Status</Th>
                  <Th>When</Th>
                </THead>
                <tbody>
                  {(!data.recentAllocations || data.recentAllocations.length === 0) ? (
                    <TRow>
                      <Td colSpan={5} className="text-center text-xs text-muted-foreground py-6">
                        No allocation records found.
                      </Td>
                    </TRow>
                  ) : (
                    (data.recentAllocations || []).slice(0, 5).map((a) => (
                      <TRow key={a.id}>
                        <Td className="font-mono text-xs">{a.id ? String(a.id).slice(0, 8) : "—"}</Td>
                        <Td>{a.organType || "Organ"}</Td>
                        <Td className="font-semibold">{a.matchScore}</Td>
                        <Td>
                          <StatusBadge value={a.status} />
                        </Td>
                        <Td className="text-muted-foreground">{a.timestamp ? fmtDateTime(a.timestamp) : "—"}</Td>
                      </TRow>
                    ))
                  )}
                </tbody>
              </TableShell>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
