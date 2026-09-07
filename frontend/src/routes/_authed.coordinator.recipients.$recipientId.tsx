import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Pencil, ShieldCheck, Trash2, Activity, Heart, UserRound, MapPin, CheckCircle2 } from "lucide-react";
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
import { RecipientRegistrationForm } from "@/components/recipient-registration-form";
import { DeleteConfirmationModal, DeleteRecordTarget } from "@/components/delete-confirmation-modal";

export const Route = createFileRoute("/_authed/coordinator/recipients/$recipientId")({
  head: () => ({
    meta: [
      { title: "Recipient Dossier — OrganMatch Coordinator" },
    ],
  }),
  component: CoordinatorRecipientDetailPage,
});

function CoordinatorRecipientDetailPage() {
  const { recipientId } = Route.useParams();
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteRecordTarget | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["recipient", recipientId],
    queryFn: () => api.getRecipient(recipientId),
    enabled: ready && !!user,
  });

  const updateMutation = useMutation({
    mutationFn: (values: any) =>
      api.updateRecipient(recipientId, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipient", recipientId] });
      qc.invalidateQueries({ queryKey: ["recipients"] });
      qc.invalidateQueries({ queryKey: ["coordinator", "recipients"] });
      qc.invalidateQueries({ queryKey: ["coordinator", "overview"] });
      setEditOpen(false);
      toast.success("Recipient record updated.");
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? "Update failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (reason: string) => {
      return api.deleteRecipient(recipientId, reason);
    },
    onSuccess: () => {
      toast.success("Recipient deleted successfully.");
      qc.invalidateQueries({ queryKey: ["recipients"] });
      navigate({ to: "/coordinator/recipients" });
    },
  });

  if (isLoading) return <LoadingState label="Loading recipient dossier…" />;
  if (error || !data)
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <ErrorState
          message={error instanceof Error ? error.message : "Recipient record not accessible under your hospital context."}
          action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>}
        />
      </div>
    );

  const r = (data as any)?.recipient || data;
  if (!r) return <ErrorState message="Recipient record not found." />;

  const md = r.medicalDetails || {};
  const historyList = data.history || r.history || [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/coordinator/recipients"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Hospital Recipients
        </Link>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
            <Pencil className="h-4 w-4" /> Edit Recipient / Update Urgency
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              setDeleteTarget({
                id: r.id,
                type: "Recipient",
                code: r.recipient_code || r.recipientCode || (r.id ? String(r.id).slice(0, 8) : "—"),
                name: r.name || "Anonymous Patient",
                extraInfo: `Organ: ${r.requiredOrgan || r.required_organ}, Blood Group: ${r.bloodGroup}`,
              })
            }
            className="bg-rose-600 hover:bg-rose-700 gap-1.5"
          >
            <Trash2 className="h-4 w-4" /> Delete Recipient
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Dossier Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Card */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  {r.name || "Anonymous Patient"}
                </CardTitle>
                <p className="text-xs font-mono text-gray-500 mt-1">
                  Recipient Code: <span className="font-semibold text-blue-700">{r.recipient_code || r.recipientCode || `REC-${r.id ? String(r.id).slice(0, 8) : "—"}`}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge value={r.urgency} />
                <StatusBadge value={r.priority} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-gray-100 text-sm">
                <DetailRow label="Hospital Facility" value={r.hospital || "Not assigned"} />
                <DetailRow label="Assigned Hospital" value={r.hospital || "Not assigned"} />
                <DetailRow label="Age / Gender" value={`${r.age} years · ${r.gender || "Not specified"}`} />
                <DetailRow label="Blood Group" value={<span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{r.bloodGroup || "Not recorded"}</span>} />
                <DetailRow label="Required Organ" value={<span className="font-semibold text-gray-900">{r.requiredOrgan}</span>} />
                <DetailRow label="Clinical Condition" value={r.medicalCondition || "Not documented."} />
                <DetailRow label="Medical Suitability" value={<StatusBadge value={r.medicalSuitability} />} />
                <DetailRow label="HLA Antigens" value={<code className="font-mono text-xs bg-gray-50 px-2 py-1 rounded">{r.hla && r.hla !== "None specified" ? r.hla : "Not specified"}</code>} />
                <DetailRow label="Waiting Status" value={<StatusBadge value={r.matchStatus || "Waiting"} />} />
                <DetailRow label="Registered At" value={fmtDateTime(r.createdAt)} />
                <DetailRow label="Last Modified" value={`${fmtDateTime(r.lastEditedAt)} by ${r.lastEditedBy}`} />
              </div>
            </CardContent>
          </Card>

          {/* Medical Information Detail Card */}
          {(md.primaryDiagnosis || md.diseaseStage || md.height || md.weight || md.bloodPressure || md.comorbidConditions || md.allergies || md.currentMedications) && (
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="pb-3 border-b border-gray-100">
                <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-600" />
                  <span>Clinical &amp; Medical Assessment Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="divide-y divide-gray-100 text-sm">
                  {md.primaryDiagnosis && <DetailRow label="Primary Diagnosis" value={md.primaryDiagnosis} />}
                  {md.diagnosisDetails && <DetailRow label="Diagnosis Details" value={md.diagnosisDetails} />}
                  {md.dateOfDiagnosis && <DetailRow label="Date of Diagnosis" value={md.dateOfDiagnosis} />}
                  {md.diseaseStage && <DetailRow label="Disease Stage" value={md.diseaseStage} />}
                  {(md.height || md.weight || md.bmi) && (
                    <DetailRow
                      label="Vitals (Height / Weight / BMI)"
                      value={`${md.height ? md.height + " cm" : "—"} / ${md.weight ? md.weight + " kg" : "—"} / ${md.bmi ? md.bmi + " kg/m²" : "—"}`}
                    />
                  )}
                  {md.bloodPressure && <DetailRow label="Blood Pressure" value={`${md.bloodPressure} mmHg`} />}
                  {md.diabetes !== undefined && <DetailRow label="Diabetes" value={md.diabetes === "Yes" || md.diabetes === true ? "Yes" : "No"} />}
                  {md.hypertension !== undefined && <DetailRow label="Hypertension" value={md.hypertension === "Yes" || md.hypertension === true ? "Yes" : "No"} />}
                  {md.smokingStatus && <DetailRow label="Smoking Status" value={md.smokingStatus} />}
                  {Array.isArray(md.comorbidConditions) && md.comorbidConditions.length > 0 && (
                    <DetailRow label="Comorbid Conditions" value={md.comorbidConditions.join(", ")} />
                  )}
                  {md.allergies && <DetailRow label="Allergies" value={md.allergies} />}
                  {md.currentMedications && <DetailRow label="Current Medications" value={md.currentMedications} />}
                  {md.additionalNotes && <DetailRow label="Additional Clinical Notes" value={md.additionalNotes} />}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Patient Contact & Demographics Card */}
          {(r.contactNumber || r.residentialAddress || r.city || r.state || r.pincode) && (
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="pb-3 border-b border-gray-100">
                <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-blue-600" />
                  <span>Contact &amp; Residential Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="divide-y divide-gray-100 text-sm">
                  {r.contactNumber && <DetailRow label="Contact Number" value={<span className="font-mono">{r.contactNumber}</span>} />}
                  {r.residentialAddress && <DetailRow label="Residential Address" value={r.residentialAddress} />}
                  {(r.city || r.state || r.pincode) && (
                    <DetailRow label="City / State / Pincode" value={[r.city, r.state, r.pincode].filter(Boolean).join(" / ")} />
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Change History & Version Timeline */}
        <div>
          <Card className="shadow-sm border-gray-200 sticky top-6">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Cryptographic Audit &amp; Version History</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HistoryTimeline entries={historyList} />
            </CardContent>
          </Card>
        </div>
      </div>


      {/* Edit Modal with complete 3-step Recipient Registration Form */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 rounded-2xl">
          <RecipientRegistrationForm
            initial={r}
            mode="edit"
            submitLabel="Save Changes"
            submitting={updateMutation.isPending}
            hospitalName={r.hospital || user?.organization || "Assigned Hospital"}
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


