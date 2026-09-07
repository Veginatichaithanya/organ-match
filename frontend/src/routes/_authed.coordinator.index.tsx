import { createFileRoute, Link } from "@tanstack/react-router";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  CheckCircle2,
  Clock,
  HeartHandshake,
  Plus,
  RefreshCw,
  Shuffle,
  Users,
  Waves,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, fmtDateTime } from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/coordinator/")({
  head: () => ({
    meta: [
      { title: "Hospital Coordinator Dashboard — OrganMatch" },
      { name: "description", content: "Operational hospital donor and matching dashboard." },
    ],
  }),
  component: CoordinatorOverviewPage,
});

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: "blue" | "green" | "amber" | "purple" | "rose" | "teal";
  to?: string;
  subtitle?: string;
}

const COLOR_CLASSES: Record<StatCardProps["color"], string> = {
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  purple: "bg-purple-50 text-purple-700",
  rose: "bg-rose-50 text-rose-700",
  teal: "bg-teal-50 text-teal-700",
};

function StatCard({ title, value, icon: Icon, color, to, subtitle }: StatCardProps) {
  const card = (
    <div className="rounded-lg border border-gray-200 bg-white p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
      <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${COLOR_CLASSES[color]} flex-shrink-0`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-500 font-medium truncate">{title}</p>
        <p className="text-2xl font-semibold text-gray-900 leading-tight mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block">
        {card}
      </Link>
    );
  }
  return card;
}

function CoordinatorOverviewPage() {
  const { user, ready } = useAuth();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["coordinator", "overview"],
    queryFn: () => api.coordinatorOverview(),
    enabled: ready && !!user,
    refetchInterval: 30_000,
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">Hospital Coordinator Dashboard</h1>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
              <Building2 className="h-3 w-3 mr-1" />
              {data?.hospital_name || user?.organization || "Hospital Operations"}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Operational organ donation management, donor/recipient registries, and compatibility matching.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <TelemetryRefreshButton
            label="Refresh Dashboard"
            onRefresh={() => refetch()}
            isFetching={isFetching}
          />
          <Link to="/coordinator/donors/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Register Donor
            </Button>
          </Link>
          <Link to="/coordinator/recipients/new">
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1.5" />
              Register Recipient
            </Button>
          </Link>
          <Link to="/coordinator/matching">
            <Button size="sm" variant="secondary">
              <Shuffle className="h-4 w-4 mr-1.5" />
              Run Matching
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <p className="font-semibold">Failed to load hospital operations data.</p>
          <p className="text-xs text-red-600 mt-1 font-mono">
            {(error as any)?.response?.data?.detail || (error as any)?.message || "Unknown server error."}
          </p>
        </div>
      )}

      {/* Operational Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          title="Active Donors"
          value={isLoading ? "—" : (data?.active_donors ?? 0)}
          icon={HeartHandshake}
          color="blue"
          to="/coordinator/donors"
          subtitle="Hospital Donors"
        />
        <StatCard
          title="Available Organs"
          value={isLoading ? "—" : (data?.available_organs ?? 0)}
          icon={Waves}
          color="green"
          to="/coordinator/organs"
          subtitle="Ready for Match"
        />
        <StatCard
          title="Active Recipients"
          value={isLoading ? "—" : (data?.active_recipients ?? 0)}
          icon={Users}
          color="purple"
          to="/coordinator/recipients"
          subtitle="Waiting List"
        />
        <StatCard
          title="Pending Review"
          value={isLoading ? "—" : (data?.pending_medical_reviews ?? 0)}
          icon={Clock}
          color="amber"
          subtitle="Medical Clearance"
        />
        <StatCard
          title="Active Matches"
          value={isLoading ? "—" : (data?.active_matches ?? 0)}
          icon={Shuffle}
          color="teal"
          to="/coordinator/matching"
          subtitle="Candidate Pairs"
        />
        <StatCard
          title="Allocations"
          value={isLoading ? "—" : (data?.pending_allocations ?? 0)}
          icon={Activity}
          color="rose"
          to="/coordinator/allocations"
          subtitle="Pending Review"
        />
      </div>

      {/* Grid of Recent Operational Records */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Donors */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
              <HeartHandshake className="h-4 w-4 text-primary" />
              Recent Hospital Donors
            </h3>
            <Link to="/coordinator/donors" className="text-xs text-primary hover:underline">
              View All →
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {isLoading ? (
              <p className="text-xs text-gray-400 py-4 text-center">Loading donors…</p>
            ) : !data?.recent_donors || data.recent_donors.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No donors registered yet.</p>
            ) : (
              data.recent_donors.map((d) => (
                <div key={d.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-gray-900 font-mono">{d.code}</span>
                    <span className="text-gray-500 ml-2">{d.name} ({d.age}y, {d.blood_group})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={d.status} />
                    <span className="text-gray-400 font-mono">{fmtDateTime(d.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Organs */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
              <Waves className="h-4 w-4 text-primary" />
              Available &amp; Harvested Organs
            </h3>
            <Link to="/coordinator/organs" className="text-xs text-primary hover:underline">
              View All →
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {isLoading ? (
              <p className="text-xs text-gray-400 py-4 text-center">Loading organs…</p>
            ) : !data?.recent_organs || data.recent_organs.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No organs registered yet.</p>
            ) : (
              data.recent_organs.map((o) => (
                <div key={o.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-gray-900 font-mono">{o.code}</span>
                    <span className="text-gray-500 ml-2 font-semibold">{o.organ_type} ({o.blood_group})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={o.status} />
                    <Link to="/coordinator/matching">
                      <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2 text-primary">
                        Match
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
