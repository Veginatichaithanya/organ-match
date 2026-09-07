import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Blocks, RefreshCw, ShieldAlert } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";

export const Route = createFileRoute("/_authed/admin/monitoring/docker/")({
  head: () => ({
    meta: [{ title: "Docker Services Monitoring — OrganMatch Admin" }],
  }),
  component: AdminDockerMonitoringPage,
});

export function AdminDockerMonitoringPage() {
  const { user, ready } = useAuth();

  const { data: dkr, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["admin", "monitoring", "docker"],
    queryFn: () => api.systemDocker(),
    enabled: ready && !!user,
    refetchInterval: 10000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const getStatusBadge = (status?: string) => {
    const s = (status || "NOT_AVAILABLE").toUpperCase();
    if (s === "HEALTHY" || s === "CONNECTED" || s === "AVAILABLE") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          HEALTHY
        </span>
      );
    }
    if (s === "DEGRADED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          DEGRADED
        </span>
      );
    }
    if (s === "OFFLINE" || s === "DOWN") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          OFFLINE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        NOT AVAILABLE
      </span>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-700 shrink-0">
              <Blocks className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Docker Services Monitoring</h1>
            {getStatusBadge(dkr?.status || dkr?.docker_status)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time container runtime discovery and service daemon telemetry.
          </p>
        </div>

        <TelemetryRefreshButton
          label="Refresh Containers"
          onRefresh={() => refetch()}
          isFetching={isFetching}
        />
      </div>

      {/* Metric Counters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Daemon Status</span>
          <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
            {dkr?.daemon_connected ? "CONNECTED" : "UNAVAILABLE"}
          </div>
          <span className="text-[11px] text-slate-500 truncate block mt-0.5">
            {dkr?.docker_version ? `Version: ${dkr.docker_version}` : "Socket unreachable"}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Running Containers</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
            {dkr?.running_containers ?? 0}
          </div>
          <span className="text-[11px] text-slate-500 block mt-0.5">Actively executing</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Stopped Containers</span>
          <div className="text-2xl font-bold text-amber-600 mt-1 font-mono">
            {dkr?.stopped_containers ?? 0}
          </div>
          <span className="text-[11px] text-slate-500 block mt-0.5">Exited / Inactive</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Discovered</span>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {dkr?.total_containers ?? (dkr?.containers?.length || 0)}
          </div>
          <span className="text-[11px] text-slate-500 block mt-0.5">Registered containers</span>
        </div>
      </div>

      {/* Status Notice */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-700">
        <ShieldAlert className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold block text-slate-900">Runtime Telemetry Details</span>
          <p className="text-slate-600 mt-0.5">
            {dkr?.message || "Checking Docker daemon status and container health..."}
          </p>
        </div>
      </div>

      {/* Container List Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Container Inventory</h3>
          <span className="text-[11px] font-mono text-slate-500">
            Last checked: {dkr?.last_checked ? new Date(dkr.last_checked).toLocaleTimeString() : "—"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Container Name", "Service", "Status", "Uptime", "Health Check", "Restarts"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">
                    Discovering Docker containers…
                  </td>
                </tr>
              ) : !dkr?.containers || dkr.containers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">
                    No active Docker container sockets detected.
                  </td>
                </tr>
              ) : (
                dkr.containers.map((c) => (
                  <tr key={c.container_name} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {c.container_name}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap font-mono">
                      {c.service_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                        c.status === "RUNNING"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {c.uptime || "N/A"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {c.health || "N/A"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {c.restart_count}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
