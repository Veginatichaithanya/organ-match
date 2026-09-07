import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Terminal } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import { StatusBadge, fmtDateTime } from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/admin/monitoring/api-activity/")({
  head: () => ({
    meta: [{ title: "API Activity Monitoring — OrganMatch Admin" }],
  }),
  component: AdminApiActivityMonitoringPage,
});

export function AdminApiActivityMonitoringPage() {
  const { user, ready } = useAuth();

  const { data: act, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin", "monitoring", "api-activity"],
    queryFn: () => api.systemApiActivity(),
    enabled: ready && !!user,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Terminal className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-semibold text-gray-900">Live API Activity Stream</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Real-time audit log stream of API method dispatches, endpoints, response latency, and acting roles.
          </p>
        </div>

        <TelemetryRefreshButton
          label="Refresh Log Stream"
          onRefresh={() => refetch()}
          isFetching={isFetching}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Timestamp", "Method", "Endpoint", "Status Code", "Response Time", "User", "Role", "Request ID"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Loading API activity stream…
                  </td>
                </tr>
              ) : !act?.items || act.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No recent API activity logged.
                  </td>
                </tr>
              ) : (
                act.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {fmtDateTime(item.timestamp)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={
                          item.method === "GET"
                            ? "bg-blue-50 text-blue-700 border-blue-200 font-bold"
                            : item.method === "POST"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold"
                            : item.method === "PUT"
                            ? "bg-amber-50 text-amber-700 border-amber-200 font-bold"
                            : "bg-red-50 text-red-700 border-red-200 font-bold"
                        }
                      >
                        {item.method}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">
                      {item.endpoint}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={
                          item.status_code >= 200 && item.status_code < 300
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }
                      >
                        {item.status_code}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {item.response_time_ms ? `${item.response_time_ms} ms` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap font-medium">
                      {item.username}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px]">
                        {item.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {item.request_id || "—"}
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
