import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  ShieldAlert,
  Stethoscope,
  Waves,
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

export const Route = createFileRoute("/_authed/doctor/organs/$organId")({
  head: () => ({
    meta: [{ title: "Organ Clinical Assessment — Doctor Console" }],
  }),
  component: DoctorOrganDetailPage,
});

function DoctorOrganDetailPage() {
  const { organId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, ready } = useAuth();

  const [suitability, setSuitability] = useState<string>("APPROVED");
  const [riskLevel, setRiskLevel] = useState<string>("LOW");
  const [clinicalNotes, setClinicalNotes] = useState<string>("");
  const [recommendation, setRecommendation] = useState<string>("");

  const { data: organ, isLoading, error } = useQuery({
    queryKey: ["doctor", "organs", organId],
    queryFn: () => api.doctorGetOrgan(organId),
    enabled: ready && !!user && !!organId,
  });

  const submitAssessment = useMutation({
    mutationFn: async () => {
      return api.doctorCreateAssessment({
        entity_type: "Organ",
        entity_id: organId,
        suitability,
        risk_level: riskLevel,
        clinical_notes: clinicalNotes,
        recommendation,
      });
    },
    onSuccess: () => {
      toast.success("Organ clinical assessment submitted successfully.");
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
        Loading organ medical details…
      </div>
    );
  }

  if (error || !organ) {
    return (
      <div className="p-12 text-center text-sm text-red-600">
        Organ record not found or access forbidden by hospital isolation policy.
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
            onClick={() => navigate({ to: "/doctor/organs" })}
            className="gap-1 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Organs
          </Button>
          <div className="h-4 w-px bg-gray-300" />
          <div className="flex items-center gap-2">
            <Waves className="h-5 w-5 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">
              Organ: <span className="font-mono">{organ.organ_type}</span>
            </h1>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-mono text-xs">
              Blood: {organ.blood_group}
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

      {/* Organ Information Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2 border-b border-gray-100 pb-2">
            <Stethoscope className="h-4 w-4 text-blue-600" /> Organ Specifications & Viability
          </h2>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-500 block">Organ Type</span>
              <span className="font-semibold text-gray-900">{organ.organ_type}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Blood Group</span>
              <span className="font-mono font-semibold text-red-600">{organ.blood_group}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Viability Limit</span>
              <span className="font-mono text-gray-800">{organ.viability_hours ? `${organ.viability_hours} hrs` : "N/A"}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Status</span>
              <StatusBadge value={organ.status} />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <span className="text-xs font-medium text-gray-500 block mb-1">Medical Details</span>
            <p className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded border border-gray-100 whitespace-pre-wrap font-mono">
              {organ.medical_details || "No specific organ medical parameters listed."}
            </p>
          </div>
        </div>

        {/* Clinical Assessment Form */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2 border-b border-gray-100 pb-2">
            <FileText className="h-4 w-4 text-blue-600" /> Perform Medical Review
          </h2>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Medical Suitability</label>
                <Select value={suitability} onValueChange={setSuitability}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APPROVED">APPROVED (Suitable)</SelectItem>
                    <SelectItem value="NEEDS_REVIEW">NEEDS REVIEW</SelectItem>
                    <SelectItem value="NOT_APPROVED">NOT APPROVED</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Risk Level</label>
                <Select value={riskLevel} onValueChange={setRiskLevel}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">LOW RISK</SelectItem>
                    <SelectItem value="MEDIUM">MEDIUM RISK</SelectItem>
                    <SelectItem value="HIGH">HIGH RISK</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Clinical Recommendation</label>
              <Textarea
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                placeholder="Provide medical recommendation for matching engine or allocation authority…"
                rows={2}
                className="text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Clinical Notes</label>
              <Textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Enter detailed medical notes, organ conditioning details, or risk factors…"
                rows={3}
                className="text-xs"
              />
            </div>

            <Button
              onClick={() => submitAssessment.mutate()}
              disabled={submitAssessment.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              {submitAssessment.isPending ? "Submitting…" : "Save Clinical Assessment"}
            </Button>
          </div>
        </div>
      </div>

      {/* Historical Clinical Assessments */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Medical Review History</h3>
          <p className="text-xs text-gray-500">Previous clinical evaluations recorded for this organ</p>
        </div>

        <div className="divide-y divide-gray-100 text-xs">
          {!organ.assessments || organ.assessments.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              No historical medical assessments found for this organ.
            </div>
          ) : (
            organ.assessments.map((a: any, i: number) => (
              <div key={a.id || i} className="p-4 space-y-1.5 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge value={a.suitability} />
                    <Badge variant="outline" className="text-[10px]">
                      {a.risk_level} RISK
                    </Badge>
                  </div>
                  <span className="text-gray-400 font-mono text-[11px]">
                    {fmtDateTime(a.reviewed_at)}
                  </span>
                </div>
                {a.recommendation && (
                  <p className="font-medium text-gray-800">
                    Recommendation: {a.recommendation}
                  </p>
                )}
                {a.clinical_notes && (
                  <p className="text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                    {a.clinical_notes}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
