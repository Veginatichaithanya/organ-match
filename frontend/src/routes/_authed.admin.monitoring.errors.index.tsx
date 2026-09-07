import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import { Input } from "@/components/ui/input";
import { StatusBadge, fmtDateTime } from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/admin/monitoring/errors/")({
  head: () => ({
    meta: [{ title: "Error Logs Monitoring — OrganMatch Admin" }],
  }),
  component: AdminErrorLogsMonitoringPage,
});

export function AdminErrorLogsMonitoringPage() {
  const { user, ready } = useAuth();
  const [search, setSearch] = useState("");

  const { data: errLogs, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin", "monitoring", "errors"],
    queryFn: () => api.systemErrors(),
    enabled: ready && !!user,
  });

  const filtered = (errLogs?.items ?? []).filter((item) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      item.error_type.toLowerCase().includes(q) ||
      item.reason.toLowerCase().includes(q) ||
      (item.service && item.service.toLowerCase().includes(q)) ||
      (item.username && item.username.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <h1 className="text-2xl font-semibold text-gray-900">Application Error Logs</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            System exceptions, unauthorized request attempts, and operational error logs.
          </p>
        </div>

        <TelemetryRefreshButton
          label="Refresh Errors"
          onRefresh={() => refetch()}
          isFetching={isFetching}
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by error type, reason, user, service…"
            className="pl-9 bg-white"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Timestamp", "Service", "Error Type", "Reason / Detail", "Status Code", "User", "Resolution"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Loading error logs…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No matching application error logs recorded.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {fmtDateTime(item.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {item.service}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-semibold text-xs">
                        {item.error_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-sans max-w-xs truncate">
                      {item.reason}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="text-xs">
                        {item.status_code || 500}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {item.username || "System"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-sans">
                      <StatusBadge value={item.resolution_status} />
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
