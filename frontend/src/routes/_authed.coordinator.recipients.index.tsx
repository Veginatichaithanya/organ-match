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
import { StatusBadge } from "@/components/ui-kit";
import { DeleteConfirmationModal, DeleteRecordTarget } from "@/components/delete-confirmation-modal";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/coordinator/recipients/")({
  head: () => ({
    meta: [{ title: "Hospital Recipients — OrganMatch" }],
  }),
  component: CoordinatorRecipientsPage,
});

const ORGAN_TYPES = ["Heart", "Lungs", "Kidney", "Pancreas"];
const URGENCIES = ["Critical", "High", "Moderate", "Stable"];

function CoordinatorRecipientsPage() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [organType, setOrganType] = useState("all");
  const [urgency, setUrgency] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<DeleteRecordTarget | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["recipients"],
    queryFn: () => (api.recipients ? api.recipients({ pageSize: 100 }) : api.listRecipients?.({ pageSize: 100 })),
    enabled: ready && !!user,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!deleteTarget) return;
      return api.deleteRecipient(deleteTarget.id, reason);
    },
    onSuccess: () => {
      toast.success("Recipient deleted successfully.");
      qc.invalidateQueries({ queryKey: ["recipients"] });
      setDeleteTarget(null);
    },
  });

  const rawItems = data?.items ?? [];
  const recipients = rawItems.filter((r) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.recipient_code && r.recipient_code.toLowerCase().includes(q)) ||
      (r.recipientCode && r.recipientCode.toLowerCase().includes(q)) ||
      (r.id && r.id.toLowerCase().includes(q)) ||
      (r.hla && r.hla.toLowerCase().includes(q));

    const matchesOrgan =
      organType === "all" ||
      !organType ||
      (r.requiredOrgan && r.requiredOrgan.toLowerCase() === organType.toLowerCase()) ||
      (r.required_organ && r.required_organ.toLowerCase() === organType.toLowerCase());

    const matchesUrgency =
      urgency === "all" ||
      !urgency ||
      (r.urgency && r.urgency.toLowerCase() === urgency.toLowerCase());

    return matchesSearch && matchesOrgan && matchesUrgency;
  });

  return (
    <div className="px-6 py-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Hospital Recipients Waiting List</h1>
          <p className="text-sm text-gray-500 mt-1">
            Registered patients waiting for compatible organ matches at {user?.organization || "your hospital"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TelemetryRefreshButton
            label="Refresh Recipients"
            onRefresh={() => refetch()}
            isFetching={isFetching}
          />
          <Link to="/coordinator/recipients/new">
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Register New Recipient
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
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
        <Select value={organType} onValueChange={setOrganType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Required Organ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Organs</SelectItem>
            {ORGAN_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={urgency} onValueChange={setUrgency}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Urgency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Urgencies</SelectItem>
            {URGENCIES.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center justify-between">
          <span>Failed to load recipients: {error instanceof Error ? error.message : "Network error"}</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-7 text-xs bg-white text-red-700 border-red-200 hover:bg-red-50">
            Retry
          </Button>
        </div>
      )}

      {/* Recipients Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Scroll wrapper — only THIS scrolls horizontally, not the full page */}
        <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: "1100px" }}>
          <colgroup>
            <col style={{ width: "160px", minWidth: "160px" }} />
            <col style={{ width: "190px", minWidth: "190px" }} />
            <col style={{ width: "150px", minWidth: "150px" }} />
            <col style={{ width: "120px", minWidth: "120px" }} />
            <col style={{ width: "150px", minWidth: "150px" }} />
            <col style={{ width: "130px", minWidth: "130px" }} />
            <col style={{ width: "120px", minWidth: "120px" }} />
            <col style={{ width: "120px", minWidth: "120px" }} />
            <col style={{ width: "110px", minWidth: "110px" }} />
          </colgroup>
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Recipient Code", "Name", "Age / Gender", "Blood Group", "Required Organ", "Urgency", "Priority", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">
                  Loading hospital waiting list…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-red-500">
                  Could not display recipients due to a request error.
                </td>
              </tr>
            ) : recipients.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">
                  No recipients on waiting list.
                </td>
              </tr>
            ) : (
              recipients.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900 whitespace-nowrap">
                    <Link to="/coordinator/recipients/$recipientId" params={{ recipientId: r.id }} className="text-primary hover:underline">
                      {r.recipientCode || r.recipient_code || (r.id ? r.id.slice(0, 8) : "—")}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                    {r.name || "Anonymous Patient"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {r.age} yrs · {r.gender}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                    {r.bloodGroup}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {r.requiredOrgan || r.required_organ}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge value={r.urgency} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge value={r.priority} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge value={r.matchStatus || "Waiting"} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      <Link to="/coordinator/recipients/$recipientId" params={{ recipientId: r.id }}>
                        <Button size="sm" variant="outline" className="h-8 text-xs">
                          View
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setDeleteTarget({
                            id: r.id,
                            type: "Recipient",
                            code: r.recipientCode || r.recipient_code || (r.id ? String(r.id).slice(0, 8) : "—"),
                            name: r.name || "Anonymous Patient",
                            extraInfo: `Organ: ${r.requiredOrgan || r.required_organ}, Blood Group: ${r.bloodGroup}`,
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
        </div>{/* end scroll wrapper */}
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
