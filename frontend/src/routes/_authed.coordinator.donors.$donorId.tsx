import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Pencil, Plus, ShieldCheck, Trash2, Waves } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DetailRow,
  ErrorState,
  fmtDateTime,
  HistoryTimeline,
  LoadingState,
  StatusBadge,
} from "@/components/ui-kit";
import { DonorRegistrationForm } from "@/components/donor-registration-form";
import { DeleteConfirmationModal, DeleteRecordTarget } from "@/components/delete-confirmation-modal";

export const Route = createFileRoute("/_authed/coordinator/donors/$donorId")({
  head: () => ({
    meta: [
      { title: "Donor Dossier — OrganMatch Coordinator" },
    ],
  }),
  component: CoordinatorDonorDetailPage,
});

function CoordinatorDonorDetailPage() {
  const { donorId } = Route.useParams();
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteRecordTarget | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["donor", donorId],
    queryFn: () => api.getDonor(donorId),
    enabled: ready && !!user,
  });

  const updateMutation = useMutation({
    mutationFn: (values: Parameters<typeof api.updateDonor>[1]) => api.updateDonor(donorId, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["donor", donorId] });
      qc.invalidateQueries({ queryKey: ["donors"] });
      setEditOpen(false);
      toast.success("Donor record updated.");
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? "Update failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (reason: string) => {
      return api.deleteDonor(donorId, reason);
    },
    onSuccess: () => {
      toast.success("Donor deleted successfully.");
      qc.invalidateQueries({ queryKey: ["donors"] });
      navigate({ to: "/coordinator/donors" });
    },
  });

  if (isLoading) return <LoadingState label="Loading donor dossier…" />;
  if (error || !data)
    return <ErrorState message={error instanceof Error ? error.message : "Donor record not accessible under your hospital context."} />;

  const d = (data as any)?.donor || data;
  if (!d) return <ErrorState message="Donor record not found." />;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <Link
          to="/coordinator/donors"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Hospital Donors
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/coordinator/organs/new">
            <Button size="sm" variant="outline">
              <Waves className="h-4 w-4 mr-1.5" /> Harvest &amp; Register Organ
            </Button>
          </Link>
          <Button size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1.5" /> Edit Donor
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              setDeleteTarget({
                id: d.id,
                type: "Donor",
                code: d.donor_code || d.id.slice(0, 8),
                name: d.name || "Anonymous Donor",
                extraInfo: `Blood Group: ${d.bloodGroup}, Age: ${d.age}`,
              })
            }
            className="bg-rose-600 hover:bg-rose-700"
          >
            <Trash2 className="h-4 w-4 mr-1.5" /> Delete Donor
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Donor Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                  {d.name ? d.name.slice(0, 2).toUpperCase() : "DN"}
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-gray-900">
                    {d.name || "Anonymous Donor"}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {d.donor_code || "DNR-RECORD"}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">ID: {d.id}</span>
                  </div>
                </div>
              </div>
              <StatusBadge value={d.availability || "Available"} />
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-gray-100 text-sm">
                <DetailRow label="Hospital Facility" value={d.hospital || "Hospital Facility"} />
                <DetailRow
                  label="Date of Birth"
                  value={
                    d.dateOfBirth
                      ? new Date(d.dateOfBirth).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "Not provided"
                  }
                />
                <DetailRow label="Age / Gender" value={`${d.age ? `${d.age} years` : "Age not specified"} · ${d.gender || "Not specified"}`} />
                <DetailRow label="Blood Group" value={d.bloodGroup || "Not provided"} />
                <DetailRow
                  label="Registration Date"
                  value={
                    d.registrationDate || d.createdAt
                      ? new Date(d.registrationDate || d.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "Not recorded"
                  }
                />
                <DetailRow
                  label="Registration Time"
                  value={
                    d.createdAt
                      ? `${new Date(d.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })} IST`
                      : "Not recorded"
                  }
                />
                <DetailRow
                  label="Last Modified"
                  value={
                    d.lastEditedAt
                      ? `${new Date(d.lastEditedAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })} · ${new Date(d.lastEditedAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })} IST by ${d.lastEditedBy || "Authorized User"} (${d.lastEditedRole || "Staff"})`
                      : "Not recorded"
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Donation Preferences Card */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold tracking-wide uppercase text-gray-700">
                Donation Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const pref = d.donationPreferences || {};
                const organs = Array.isArray(pref.organs) ? pref.organs : [];
                const tissues = Array.isArray(pref.tissues) ? pref.tissues : [];
                const otherOrg = pref.other_organs;
                const otherTis = pref.other_tissues;
                const hasPref = organs.length > 0 || tissues.length > 0 || otherOrg || otherTis;

                if (!hasPref) {
                  return <p className="text-sm text-gray-500 italic">No specific donation preferences recorded.</p>;
                }

                return (
                  <div className="space-y-4">
                    {organs.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 block mb-2">Pledged Organs</span>
                        <div className="flex flex-wrap gap-2">
                          {organs.map((org: string) => (
                            <span
                              key={org}
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm"
                            >
                              ● {org}
                              {org.toLowerCase().includes("other") && otherOrg ? ` (${otherOrg})` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {tissues.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 block mb-2">Pledged Tissues</span>
                        <div className="flex flex-wrap gap-2">
                          {tissues.map((tis: string) => (
                            <span
                              key={tis}
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200 shadow-sm"
                            >
                              ◈ {tis}
                              {tis.toLowerCase().includes("other") && otherTis ? ` (${otherTis})` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Change History & Version Timeline */}
        <Card className="shadow-sm border-gray-200 h-fit">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              Cryptographic Audit &amp; Version History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HistoryTimeline entries={d.history} />
          </CardContent>
        </Card>
      </div>

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 bg-slate-50/50">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold text-slate-900">
              Edit Donor Dossier
            </DialogTitle>
            <p className="text-xs text-slate-500 font-medium">
              Update donor registration information, contact details, and organ donation preferences.
            </p>
          </DialogHeader>
          <DonorRegistrationForm
            mode="edit"
            initial={d}
            submitLabel="Save Changes"
            submitting={updateMutation.isPending}
            onSubmit={(vals) => updateMutation.mutate(vals)}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

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

