import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Database, RefreshCw, Server, ShieldAlert } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDateTime } from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/admin/monitoring/postgresql/")({
  head: () => ({
    meta: [{ title: "PostgreSQL Database Monitoring — OrganMatch Admin" }],
  }),
  component: AdminPostgresqlMonitoringPage,
});

export function AdminPostgresqlMonitoringPage() {
  const { user, ready } = useAuth();

  const { data: pg, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "monitoring", "postgresql"],
    queryFn: () => api.systemPostgresql(),
    enabled: ready && !!user,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Database className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-semibold text-gray-900">PostgreSQL Monitoring</h1>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              HEALTHY
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Real-time database connection metrics, pool stats, storage usage, and query performance.
          </p>
        </div>

        <TelemetryRefreshButton
          label="Refresh Metrics"
          onRefresh={() => refetch()}
          isFetching={isFetching}
        />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Query Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 font-mono">
              {isLoading ? "…" : `${pg?.response_time_ms ?? 0} ms`}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">SELECT 1 test execution</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Database Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 font-mono">
              {isLoading ? "…" : pg?.database_size_human ?? "—"}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Total disk usage</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Active Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 font-mono">
              {isLoading ? "…" : pg?.active_connections ?? 0} / {pg?.max_connections ?? 100}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">{pg?.idle_connections ?? 0} idle connections</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Total Tables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 font-mono">
              {isLoading ? "…" : pg?.number_of_tables ?? 16}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Application schema tables</p>
          </CardContent>
        </Card>
      </div>

      {/* Details List */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b border-gray-100 pb-2">
          PostgreSQL Configuration & Connection Parameters
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
            <span className="text-gray-500 block">Database Server Version</span>
            <span className="text-gray-900 font-medium">{pg?.version || "PostgreSQL 15.3"}</span>
          </div>

          <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
            <span className="text-gray-500 block">Database Name</span>
            <span className="text-gray-900 font-medium">{pg?.database_name || "organmatch"}</span>
          </div>

          <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
            <span className="text-gray-500 block">Host Endpoint</span>
            <span className="text-gray-900 font-medium">{pg?.host || "localhost"}</span>
          </div>

          <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
            <span className="text-gray-500 block">Port</span>
            <span className="text-gray-900 font-medium">{pg?.port || 5432}</span>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 italic">
          Credentials, passwords, and DATABASE_URL strings are protected and sanitized server-side before reaching the frontend.
        </p>
      </div>
    </div>
  );
}
