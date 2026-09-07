import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Building2,
  CheckCircle2,
  Edit2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  ShieldCheck,
  ShieldOff,
  Users,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import type { AdminHospitalDetail } from "@/services/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, fmtDateTime } from "@/components/ui-kit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authed/admin/hospitals/")({
  head: () => ({
    meta: [{ title: "Hospital Management — OrganMatch Admin" }],
  }),
  component: AdminHospitalsPage,
});

// ─── Create / Edit Hospital Modal ─────────────────────────────────────────────

function HospitalFormModal({
  open,
  hospital,
  onClose,
}: {
  open: boolean;
  hospital: AdminHospitalDetail | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEditing = !!hospital;

  const [form, setForm] = useState({
    name: hospital?.name ?? "",
    code: hospital?.code ?? "",
    location: hospital?.location ?? "",
    contact_email: hospital?.contact_email ?? "",
    contact_phone: hospital?.contact_phone ?? "",
    address: hospital?.address ?? "",
  });
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: () => api.adminCreateHospital(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "hospitals"] });
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Failed to create hospital."),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.adminUpdateHospital(hospital!.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "hospitals"] });
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Failed to update hospital."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Hospital" : "Register New Hospital"}</DialogTitle>
            <DialogDescription>
              {isEditing ? "Update registered facility details." : "Add a new participating transplant center or hospital."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-3">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Hospital Name *</label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Apollo Hospitals"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Code</label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="APO-01"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Location / City *</label>
              <Input
                required
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Chennai, India"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Contact Email</label>
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                  placeholder="organmatch@apollo.org"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Contact Phone</label>
                <Input
                  value={form.contact_phone}
                  onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                  placeholder="+91 44 2829 0200"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Full Address</label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="21 Greams Lane, Thousand Lights"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !form.name || !form.location}>
              {isPending ? "Saving…" : isEditing ? "Save Changes" : "Create Hospital"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status Toggle Modal ───────────────────────────────────────────────────────

function HospitalStatusModal({
  hospital,
  targetStatus,
  onClose,
}: {
  hospital: AdminHospitalDetail | null;
  targetStatus: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.adminSetHospitalStatus(hospital!.id, targetStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "hospitals"] });
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Status change failed."),
  });

  const isDeactivate = targetStatus !== "Active";

  return (
    <Dialog open={!!hospital} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isDeactivate ? "Deactivate" : "Activate"} Hospital</DialogTitle>
          <DialogDescription>
            {isDeactivate
              ? `Deactivating ${hospital?.name} will suspend its network integration.`
              : `Activating ${hospital?.name} will restore all operations.`}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={isDeactivate ? "destructive" : "default"}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Updating…" : isDeactivate ? "Deactivate Hospital" : "Activate Hospital"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

function AdminHospitalsPage() {
  const { user, ready } = useAuth();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editHospital, setEditHospital] = useState<AdminHospitalDetail | null>(null);
  const [statusModal, setStatusModal] = useState<{ hospital: AdminHospitalDetail; target: string } | null>(null);

  const { data: hospitals, isLoading, error } = useQuery({
    queryKey: ["admin", "hospitals"],
    queryFn: () => api.adminListHospitals(),
    enabled: ready && !!user,
  });

  const filtered = (hospitals ?? []).filter((h) => {
    const q = search.toLowerCase();
    return (
      !q ||
      h.name.toLowerCase().includes(q) ||
      (h.code ?? "").toLowerCase().includes(q) ||
      h.location.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Hospital Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Register and configure verified transplant centers and regional hospitals.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Register Hospital
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search hospitals by name, code, or city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          Failed to load hospital network.
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Hospital Name", "Code", "Location", "Contact Details", "Users", "Status", "Registered", "Actions"].map(
                (h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                  Loading hospitals…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                  No hospitals registered.
                </td>
              </tr>
            ) : (
              filtered.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      {h.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{h.code ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-xs">
                      <MapPin className="h-3.5 w-3.5 text-gray-400" />
                      {h.location}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                    <div>{h.contact_email ?? "—"}</div>
                    {h.contact_phone && <div className="text-gray-400">{h.contact_phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-xs">
                      <Users className="h-3.5 w-3.5 text-gray-400" />
                      {h.user_count} staff
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge value={h.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                    {fmtDateTime(h.created_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setEditHospital(h)}>
                          <Edit2 className="h-4 w-4 mr-2" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {h.status === "Active" ? (
                          <DropdownMenuItem
                            onClick={() => setStatusModal({ hospital: h, target: "Suspended" })}
                            className="text-red-600"
                          >
                            <ShieldOff className="h-4 w-4 mr-2" /> Deactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => setStatusModal({ hospital: h, target: "Active" })}>
                            <ShieldCheck className="h-4 w-4 mr-2" /> Activate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {(showCreate || editHospital) && (
        <HospitalFormModal
          open={showCreate || !!editHospital}
          hospital={editHospital}
          onClose={() => {
            setShowCreate(false);
            setEditHospital(null);
          }}
        />
      )}

      <HospitalStatusModal
        hospital={statusModal?.hospital ?? null}
        targetStatus={statusModal?.target ?? "Active"}
        onClose={() => setStatusModal(null)}
      />
    </div>
  );
}
