import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
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
import { StatusBadge, fmtDate, fmtDateTime } from "@/components/ui-kit";
import { DeleteConfirmationModal, DeleteRecordTarget } from "@/components/delete-confirmation-modal";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/coordinator/donors/")({
  head: () => ({
    meta: [{ title: "Hospital Donors — OrganMatch" }],
  }),
  component: CoordinatorDonorsPage,
});

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function CoordinatorDonorsPage() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [blood, setBlood] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<DeleteRecordTarget | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["donors"],
    queryFn: () => (api.donors ? api.donors({ pageSize: 100 }) : api.listDonors?.({ pageSize: 100 })),
    enabled: ready && !!user,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!deleteTarget) return;
      return api.deleteDonor(deleteTarget.id, reason);
    },
    onSuccess: () => {
      toast.success("Donor deleted successfully.");
      qc.invalidateQueries({ queryKey: ["donors"] });
    },
  });

  const rawItems = data?.items ?? [];
  const donors = rawItems.filter((d) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.donor_code && d.donor_code.toLowerCase().includes(q)) ||
      (d.id && d.id.toLowerCase().includes(q)) ||
      (d.hla && d.hla.toLowerCase().includes(q));

    const matchesBlood =
      blood === "all" || !blood || d.bloodGroup === blood || (d as any).blood_group === blood;
    return matchesSearch && matchesBlood;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Hospital Donors</h1>
          <p className="text-sm text-gray-500 mt-1">
            Registered organ donors under {user?.organization || "your hospital"} operational context.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TelemetryRefreshButton
            label="Refresh Donors"
            onRefresh={() => refetch()}
            isFetching={isFetching}
          />
          <Link to="/coordinator/donors/new">
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Register New Donor
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
            placeholder="Search code, name, HLA..."
            className="pl-9"
          />
        </div>
        <Select value={blood} onValueChange={setBlood}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Blood group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Blood Groups</SelectItem>
            {BLOOD_GROUPS.map((bg) => (
              <SelectItem key={bg} value={bg}>
                {bg}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center justify-between">
          <span>Failed to load donors: {error instanceof Error ? error.message : "Network error"}</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-7 text-xs bg-white text-red-700 border-red-200 hover:bg-red-50">
            Retry
          </Button>
        </div>
      )}

      {/* Donors Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Donor Code", "Name", "Age / Gender", "Blood Group", "Medical Status", "Status", "Registered", "Actions"].map((h) => (
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
                  Loading hospital donors…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-red-500">
                  Could not display donors due to a request error.
                </td>
              </tr>
            ) : donors.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                  No donors found.
                </td>
              </tr>
            ) : (
              donors.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900 whitespace-nowrap">
                    <Link to="/coordinator/donors/$donorId" params={{ donorId: d.id }} className="text-primary hover:underline font-semibold">
                      {d.donor_code || (d.id ? `DNR-${d.id.slice(0, 8)}` : "Not recorded")}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">
                    {d.name || "Not specified"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {d.age !== undefined && d.age !== null ? `${d.age} yrs` : "Not specified"} · {d.gender || "Not specified"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                    {d.bloodGroup || "Not recorded"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge value={d.medicalStatus || "Suitable"} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge value={d.availability || "Available"} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {fmtDate(d.registrationDate || d.createdAt)}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Link to="/coordinator/donors/$donorId" params={{ donorId: d.id }}>
                        <Button size="sm" variant="outline" className="h-8 text-xs">
                          View Dossier
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setDeleteTarget({
                            id: d.id,
                            type: "Donor",
                            code: d.donor_code || (d.id ? String(d.id).slice(0, 8) : "—"),
                            name: d.name || "Anonymous Donor",
                            extraInfo: `Blood Group: ${d.bloodGroup}, Age: ${d.age}`,
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

