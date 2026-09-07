import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, fmtDateTime } from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/allocation/history/")({
  head: () => ({
    meta: [{ title: "Allocation History — Allocation Authority" }],
  }),
  component: AllocationHistoryPage,
});

function AllocationHistoryPage() {
  const { user, ready } = useAuth();

  const { data: history, isLoading, error } = useQuery({
    queryKey: ["allocation", "history"],
    queryFn: () => api.allocationHistory(),
    enabled: ready && !!user,
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Clock className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-semibold text-gray-900">Allocation History</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Read-only historical audit archive of all completed, approved, and rejected organ allocation decisions.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Allocation ID", "Organ", "Recipient", "Match Score", "Decision", "Approved / Rejected By", "Decision Date", "Rejection Reason", "Fabric Tx Hash", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-xs text-gray-400">
                    Loading allocation history…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-xs text-red-600">
                    Failed to load allocation history.
                  </td>
                </tr>
              ) : !history || history.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-xs text-gray-400">
                    No historical allocation decisions found.
                  </td>
                </tr>
              ) : (
                history.map((item: any) => {
                  const scorePct = Math.round(
                    (item.compatibility_score || 0) * (item.compatibility_score <= 1 ? 100 : 1)
                  );
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-900 whitespace-nowrap">
                        {item.id ? String(item.id).slice(0, 8) : "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-xs text-gray-900 whitespace-nowrap">
                        {item.organ_code || "—"} ({item.organ_type || "Organ"})
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-800 whitespace-nowrap">
                        {item.recipient_name || "Anonymous Recipient"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge className="bg-blue-600 text-white font-mono text-xs">
                          {scorePct}%
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={
                            item.decision === "APPROVED"
                              ? "bg-green-50 text-green-700 border-green-200 text-xs font-semibold"
                              : item.decision === "REJECTED"
                              ? "bg-red-50 text-red-700 border-red-200 text-xs font-semibold"
                              : "bg-amber-50 text-amber-700 border-amber-200 text-xs"
                          }
                        >
                          {item.decision}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        {item.approved_by || "System"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                        {item.updated_at ? fmtDateTime(item.updated_at) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">
                        {item.rejection_reason || "N/A"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-xs truncate">
                        {item.fabric_tx_id ? `${String(item.fabric_tx_id).slice(0, 12)}…` : "Not Anchored"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge value={item.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
