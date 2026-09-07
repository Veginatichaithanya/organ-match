import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, Eye } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge, fmtDateTime } from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/allocation/queue/")({
  head: () => ({
    meta: [{ title: "Allocation Queue — Allocation Authority" }],
  }),
  component: AllocationQueuePage,
});

function AllocationQueuePage() {
  const { user, ready } = useAuth();

  const { data: queue, isLoading, error } = useQuery({
    queryKey: ["allocation", "queue"],
    queryFn: () => api.allocationQueue(),
    enabled: ready && !!user,
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <ClipboardCheck className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-semibold text-gray-900">Allocation Review Queue</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Cases pending decision authority evaluation and final allocation authorization.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Allocation ID", "Organ Code / Type", "Recipient", "Match Score", "Medical Review", "Status", "Queued Date", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-gray-400">
                    Loading allocation queue…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-red-600">
                    Failed to load queue.
                  </td>
                </tr>
              ) : !queue || queue.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-gray-400">
                    No cases in allocation queue.
                  </td>
                </tr>
              ) : (
                queue.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-900 whitespace-nowrap">
                      {item.id ? String(item.id).slice(0, 8) : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-xs text-gray-900 whitespace-nowrap">
                      {item.organ_code} ({item.organ_type})
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-800 whitespace-nowrap">
                      {item.recipient_name} ({item.recipient_code})
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge className="bg-blue-600 text-white font-mono text-xs">
                        {Math.round((item.compatibility_score || 0) * (item.compatibility_score <= 1 ? 100 : 1))}%
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge value={item.medical_review || "APPROVED"} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge value={item.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                      {fmtDateTime(item.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to="/allocation/matches">
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-600 gap-1">
                          <Eye className="h-3.5 w-3.5" /> Review Case
                        </Button>
                      </Link>
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
