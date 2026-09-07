import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HardDrive, RefreshCw } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import { fmtDateTime } from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/admin/monitoring/database/")({
  head: () => ({
    meta: [{ title: "Database Tables Monitoring — OrganMatch Admin" }],
  }),
  component: AdminDatabaseTablesMonitoringPage,
});

export function AdminDatabaseTablesMonitoringPage() {
  const { user, ready } = useAuth();

  const { data: dbTables, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "monitoring", "database"],
    queryFn: () => api.systemDatabase(),
    enabled: ready && !!user,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <HardDrive className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-semibold text-gray-900">Database Tables Metadata</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Row counts and approximate storage utilization for all 16 application PostgreSQL tables.
          </p>
        </div>

        <TelemetryRefreshButton
          label="Refresh Table Metrics"
          onRefresh={() => refetch()}
          isFetching={isFetching}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Application Tables Registry</h2>
            <p className="text-xs text-gray-500">
              Total Database Footprint: <span className="font-mono font-semibold text-gray-800">{dbTables?.total_database_size_human || "—"}</span>
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Table Name", "Approx. Row Count", "Estimated Size", "Last Checked"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400">
                    Inspecting table row counts…
                  </td>
                </tr>
              ) : !dbTables?.tables || dbTables.tables.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400">
                    No database tables found.
                  </td>
                </tr>
              ) : (
                dbTables.tables.map((t) => (
                  <tr key={t.table_name} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900 whitespace-nowrap">
                      {t.table_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-700 whitespace-nowrap font-medium">
                      {t.approximate_row_count.toLocaleString()} rows
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                      {t.total_size_human}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">
                      {fmtDateTime(t.last_checked)}
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
