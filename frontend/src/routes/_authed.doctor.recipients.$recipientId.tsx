import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Clock,
  FileText,
  ShieldAlert,
  Stethoscope,
  Users,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, fmtDateTime } from "@/components/ui-kit";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/doctor/recipients/$recipientId")({
  head: () => ({
    meta: [{ title: "Recipient Clinical Assessment — Doctor Console" }],
  }),
  component: DoctorRecipientDetailPage,
});

function DoctorRecipientDetailPage() {
  const { recipientId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, ready } = useAuth();

  const [suitability, setSuitability] = useState<string>("APPROVED");
  const [riskLevel, setRiskLevel] = useState<string>("LOW");
  const [clinicalNotes, setClinicalNotes] = useState<string>("");
  const [recommendation, setRecommendation] = useState<string>("");

  const { data: recipient, isLoading, error } = useQuery({
    queryKey: ["doctor", "recipients", recipientId],
    queryFn: () => api.doctorGetRecipient(recipientId),
    enabled: ready && !!user && !!recipientId,
  });

  const { data: assessments } = useQuery({
    queryKey: ["doctor", "assessments", "Recipient", recipientId],
    queryFn: () => api.doctorListAssessments({ entity_type: "Recipient", entity_id: recipientId }),
    enabled: ready && !!user && !!recipientId,
  });

  const submitAssessment = useMutation({
    mutationFn: async () => {
      return api.doctorCreateAssessment({
        entity_type: "Recipient",
        entity_id: recipientId,
        suitability,
        risk_level: riskLevel,
        clinical_notes: clinicalNotes,
        recommendation,
      });
    },
    onSuccess: () => {
      toast.success("Clinical assessment submitted successfully.");
      queryClient.invalidateQueries({ queryKey: ["doctor"] });
      setClinicalNotes("");
      setRecommendation("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit clinical assessment.");
    },
  });

  if (isLoading) {
    return (
      <div className="p-12 text-center text-sm text-gray-500">
        Loading recipient medical file…
      </div>
    );
  }

  if (error || !recipient) {
    return (
      <div className="p-12 text-center text-sm text-red-600">
        Recipient record not found or access forbidden by hospital isolation policy.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/doctor/recipients" })}
            className="gap-1 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Recipients
          </Button>
          <div className="h-4 w-px bg-gray-300" />
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">
              Recipient: <span className="font-mono">{recipient.recipient_code}</span>
            </h1>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-mono text-xs">
              Blood: {recipient.blood_group}
            </Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs">
              Organ: {recipient.required_organ}
            </Badge>
          </div>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2.5 text-xs text-amber-800">
        <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
        <span>
          Medical review completed. Final allocation decision is handled by the Allocation Authority.
        </span>
      </div>

      {/* Recipient Information Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2 border-b border-gray-100 pb-2">
            <Stethoscope className="h-4 w-4 text-blue-600" /> Clinical Profile & Vitals
          </h2>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-500 block">Recipient Code</span>
              <span className="font-mono font-medium text-gray-900">{recipient.recipient_code}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Age / Gender</span>
              <span className="font-medium text-gray-900">{recipient.age} yrs / {recipient.gender}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Required Organ</span>
              <span className="font-semibold text-blue-700">{recipient.required_organ}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Urgency Status</span>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs font-semibold">
                {recipient.urgency || "NORMAL"}
              </Badge>
            </div>
            <div>
              <span className="text-gray-500 block">Priority Score</span>
              <span className="font-mono font-semibold text-gray-900">{recipient.priority_score ?? "—"}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Waitlist Date</span>
              <span className="font-mono text-gray-700">{fmtDateTime(recipient.created_at)}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-gray-500 block mb-1">Medical Details & Diagnosis</span>
            <div className="p-3 bg-gray-50 rounded border border-gray-200 text-xs text-gray-800 font-mono whitespace-pre-wrap">
              {recipient.medical_details ? (
                typeof recipient.medical_details === "string"
                  ? recipient.medical_details
                  : JSON.stringify(recipient.medical_details, null, 2)
              ) : (
                "No additional medical notes registered."
              )}
            </div>
          </div>

          <div>
            <span className="text-xs text-gray-500 block mb-1">HLA / Tissue Requirements</span>
            <div className="p-3 bg-gray-50 rounded border border-gray-200 text-xs text-gray-800 font-mono whitespace-pre-wrap">
              {recipient.hla_info ? (
                typeof recipient.hla_info === "string"
                  ? recipient.hla_info
                  : JSON.stringify(recipient.hla_info, null, 2)
              ) : (
                "Recipient HLA profile pending."
              )}
            </div>
          </div>
        </div>

        {/* Clinical Assessment Form */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2 border-b border-gray-100 pb-2">
              <FileText className="h-4 w-4 text-blue-600" /> Provide Clinical Assessment
            </h2>

            <div className="space-y-3 mt-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Medical Readiness & Suitability
                </label>
                <Select value={suitability} onValueChange={setSuitability}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="Select suitability" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APPROVED">APPROVED (Clinically Ready for Match)</SelectItem>
                    <SelectItem value="NEEDS_REVIEW">NEEDS_REVIEW (Condition Under Observation)</SelectItem>
                    <SelectItem value="NOT_APPROVED">NOT_APPROVED (Temporary Medical Hold)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Assessed Risk Level
                </label>
                <Select value={riskLevel} onValueChange={setRiskLevel}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="Select risk level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">LOW RISK</SelectItem>
                    <SelectItem value="MEDIUM">MEDIUM RISK</SelectItem>
                    <SelectItem value="HIGH">HIGH RISK</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Clinical Notes & Observations
                </label>
                <Textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Enter medical evaluation notes, recipient readiness, or antibody status…"
                  rows={3}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Clinical Recommendation
                </label>
                <Textarea
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  placeholder="Recommendation for matching engine or allocation authority…"
                  rows={2}
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          <Button
            onClick={() => submitAssessment.mutate()}
            disabled={submitAssessment.isPending}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
          >
            <Stethoscope className="h-4 w-4" />
            {submitAssessment.isPending ? "Submitting Review…" : "Submit Clinical Assessment"}
          </Button>
        </div>
      </div>

      {/* Previous Clinical Reviews */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-gray-500" /> Historical Clinical Reviews ({assessments?.length ?? 0})
        </h2>

        {!assessments || assessments.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No prior clinical assessments recorded for this recipient.</p>
        ) : (
          <div className="space-y-3">
            {assessments.map((a) => (
              <div key={a.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge value={a.suitability} />
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {a.risk_level} RISK
                    </Badge>
                  </div>
                  <span className="text-gray-400 text-[11px] font-mono">{fmtDateTime(a.reviewed_at)}</span>
                </div>
                {a.clinical_notes && (
                  <p className="text-gray-700"><strong>Notes:</strong> {a.clinical_notes}</p>
                )}
                {a.recommendation && (
                  <p className="text-gray-700"><strong>Recommendation:</strong> {a.recommendation}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
