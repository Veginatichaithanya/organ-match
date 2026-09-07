import { createFileRoute, Link } from "@tanstack/react-router";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, Shuffle, Trash2, Waves } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, fmtDate } from "@/components/ui-kit";
import { DeleteConfirmationModal, DeleteRecordTarget } from "@/components/delete-confirmation-modal";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/coordinator/organs/")({
  head: () => ({
    meta: [{ title: "Hospital Organs — OrganMatch" }],
  }),
  component: CoordinatorOrgansPage,
});

const ORGAN_TYPES = ["Heart", "Lungs", "Kidney", "Pancreas"];
const STATUSES = ["Available", "Under Review", "Matched", "Allocated", "Unavailable"];

function CoordinatorOrgansPage() {
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [organType, setOrganType] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<DeleteRecordTarget | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["organs"],
    queryFn: () => (api.organs ? api.organs({ pageSize: 100 }) : api.listOrgans?.({ pageSize: 100 })),
    enabled: ready && !!user,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!deleteTarget) return;
      return api.deleteOrgan(deleteTarget.id, reason);
    },
    onSuccess: () => {
      toast.success("Organ deleted successfully.");
      qc.invalidateQueries({ queryKey: ["organs"] });
      setDeleteTarget(null);
    },
  });

  const rawItems = data?.items ?? [];
  const organs = rawItems.filter((o) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (o.organCode && o.organCode.toLowerCase().includes(q)) ||
      (o.organ_code && o.organ_code.toLowerCase().includes(q)) ||
      (o.id && o.id.toLowerCase().includes(q)) ||
      (o.donorRef && o.donorRef.toLowerCase().includes(q));

    const matchesType =
      organType === "all" ||
      !organType ||
      o.organType?.toLowerCase() === organType.toLowerCase() ||
      (o as any).organ_type?.toLowerCase() === organType.toLowerCase();

    const matchesStatus =
      statusFilter === "all" ||
      !statusFilter ||
      o.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Hospital Organs Available</h1>
          <p className="text-sm text-gray-500 mt-1">
            Viable organ records harvested from donors under {user?.organization || "your hospital"} custody.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TelemetryRefreshButton
            label="Refresh Organs"
            onRefresh={() => refetch()}
            isFetching={isFetching}
          />
          <Link to="/coordinator/organs/new">
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Register New Organ
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organ code, donor ID..."
            className="pl-9"
          />
        </div>
        <Select value={organType} onValueChange={setOrganType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Organ type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Organs</SelectItem>
            {ORGAN_TYPES.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
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
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center justify-between">
          <span>Failed to load organs: {error instanceof Error ? error.message : "Network error"}</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-7 text-xs bg-white text-red-700 border-red-200 hover:bg-red-50">
            Retry
          </Button>
        </div>
      )}

      {/* Organs Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Organ Code", "Type", "Donor Ref", "Blood Group", "Status", "Availability", "Harvested Date", "Action"].map((h) => (
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
                  Loading hospital organs…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-red-500">
                  Could not display organs due to a request error.
                </td>
              </tr>
            ) : organs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                  No organs registered.
                </td>
              </tr>
            ) : (
              organs.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900 whitespace-nowrap">
                    {o.organCode || o.organ_code || (o.id ? o.id.slice(0, 8) : "—")}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Waves className="h-4 w-4 text-primary" />
                      {o.organType || o.organ_type}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                    {o.donorRef || (o.donorId ? o.donorId.slice(0, 8) : "—")}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                    {o.bloodGroup}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge value={o.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge value={o.availability} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {fmtDate(o.harvestedAt || o.createdAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Link to="/coordinator/matching">
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                          <Shuffle className="h-3.5 w-3.5" /> Match
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setDeleteTarget({
                            id: o.id,
                            type: "Organ",
                            code: o.organCode || o.organ_code || (o.id ? String(o.id).slice(0, 8) : "—"),
                            name: `${o.organType || o.organ_type || 'Organ'} (${o.bloodGroup || 'Blood Group'})`,
                            extraInfo: `Donor Ref: ${o.donorRef || o.donorId || '—'}, Status: ${o.status}`,
                          })
                        }
                        className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        target={deleteTarget}
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async (reason) => {
          await deleteMutation.mutateAsync(reason);
        }}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
