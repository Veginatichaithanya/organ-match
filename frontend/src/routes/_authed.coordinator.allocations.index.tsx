import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Info, Link2, Search } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, fmtDateTime } from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/coordinator/allocations/")({
  head: () => ({
    meta: [
      { title: "Allocations Status — OrganMatch Coordinator" },
      { name: "description", content: "Review status of organ allocations belonging to this hospital." },
    ],
  }),
  component: CoordinatorAllocationsPage,
});

const STATUSES = ["Pending Review", "Approved", "Rejected", "Completed"];

function CoordinatorAllocationsPage() {
  const { user, ready } = useAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["allocations", { statusFilter, search }],
    queryFn: () =>
      api.listAllocations({
        status: statusFilter === "all" ? "" : statusFilter,
        search,
        pageSize: 100,
      }),
    enabled: ready && !!user,
    placeholderData: keepPreviousData,
  });

  const allocations = data?.items ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Hospital Organ Allocations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor organ matches and official offers assigned to patients under {user?.organization || "your hospital"} scope.
        </p>
      </div>

      {/* Info Warning Alert */}
      <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800 flex gap-3">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Read-Only View:</span> Hospital coordinators can trace and monitor allocations but lack authority to sign off or record final allocation approvals (403 Forbidden is enforced by the backend on attempt).
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organ ID, recipient ID..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          Failed to retrieve hospital allocations.
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Allocation ID", "Organ Type", "Organ Ref", "Recipient Ref", "Match Score", "Status", "Blockchain Ledger TX", "Updated At"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                  Loading hospital allocations…
                </td>
              </tr>
            ) : allocations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                  No allocations found.
                </td>
              </tr>
            ) : (
              allocations.map((a) => {
                const aId = String(a.id || "");
                const orgId = String(a.organId || "");
                const recId = String(a.recipientId || "");
                const txId = String(a.blockchainTx || "");

                return (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900 whitespace-nowrap">
                      {aId ? `${aId.slice(0, 8)}…` : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                      {a.organType || "Organ"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                      {orgId ? `${orgId.slice(0, 8)}…` : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-primary hover:underline">
                      {recId ? (
                        <Link to="/coordinator/recipients/$recipientId" params={{ recipientId: recId }}>
                          {recId.slice(0, 8)}…
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-800 whitespace-nowrap">
                      {a.matchScore}%
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge value={a.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">
                      {txId ? (
                        <span className="flex items-center gap-1">
                          <Link2 className="h-3 w-3 text-green-600" />
                          {txId.slice(0, 12)}…
                        </span>
                      ) : (
                        "Not anchored"
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {fmtDateTime(a.createdAt || a.updatedAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
