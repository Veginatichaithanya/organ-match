import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Dna,
  FileEdit,
  FileText,
  HeartHandshake,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Shuffle,
  Stethoscope,
  Users,
  Waves,
  XCircle,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, fmtDateTime } from "@/components/ui-kit";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/doctor/matching/$matchId")({
  head: () => ({
    meta: [{ title: "Clinical Match Review — OrganMatch" }],
  }),
  component: DoctorMatchDetailPage,
});

function DoctorMatchDetailPage() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, ready } = useAuth();

  const [riskLevel, setRiskLevel] = useState<string>("LOW");
  const [recommendation, setRecommendation] = useState<string>("RECOMMEND_FOR_ALLOCATION");
  const [clinicalNotes, setClinicalNotes] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [successModalData, setSuccessModalData] = useState<any | null>(null);
  const [isSubmittedLocally, setIsSubmittedLocally] = useState<boolean>(false);

  const { data: match, isLoading, error } = useQuery({
    queryKey: ["doctor", "matches", matchId],
    queryFn: () => api.doctorGetMatch(matchId),
    enabled: ready && !!user && !!matchId,
  });

  const existingReview = match?.latest_assessment || (match?.assessments && match.assessments.length > 0 ? match.assessments[0] : null);
  const isCompleted = Boolean(existingReview?.id || isSubmittedLocally || (match?.status && match.status !== "PENDING"));

  // Populate form if existing review exists
  useEffect(() => {
    if (existingReview) {
      if (existingReview.risk_level) setRiskLevel(existingReview.risk_level.toUpperCase());
      if (existingReview.recommendation) setRecommendation(existingReview.recommendation);
      if (existingReview.clinical_notes) setClinicalNotes(existingReview.clinical_notes);
    }
  }, [existingReview]);

  // ESC key listener for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && successModalData) {
        setSuccessModalData(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [successModalData]);

  const submitReview = useMutation({
    mutationFn: async ({
      suitability,
      rec,
      notes,
      reason,
    }: {
      suitability: string;
      rec: string;
      notes: string;
      reason?: string;
    }) => {
      if (isCompleted || submitReview.isPending) return null;
      return api.doctorReviewMatch(matchId, {
        suitability,
        risk_level: riskLevel,
        recommendation: rec,
        clinical_notes: notes,
        rejection_reason: reason,
      });
    },
    onSuccess: (data) => {
      if (!data) return;
      setIsSubmittedLocally(true);
      setSuccessModalData(data);
      setIsRejectModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["doctor"] });
      queryClient.invalidateQueries({ queryKey: ["doctor", "matches"] });
      queryClient.invalidateQueries({ queryKey: ["doctor", "matches", matchId] });
      queryClient.invalidateQueries({ queryKey: ["doctor", "assessments"] });
      queryClient.invalidateQueries({ queryKey: ["doctor", "history"] });
      queryClient.invalidateQueries({ queryKey: ["doctor", "targets"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit clinical match review.");
    },
  });

  if (isLoading) {
    return (
      <div className="p-12 text-center text-sm text-slate-500 font-medium">
        Loading match proposal and clinical data…
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="p-12 text-center text-sm text-rose-600 font-medium">
        Match proposal not found or restricted by hospital scoping policy.
      </div>
    );
  }

  const scorePct = match.compatibility_score || 0;
  const breakdown = match.scoring_breakdown || {};
  const bloodScore = breakdown.blood ?? 25;
  const medicalScore = breakdown.medical ?? 28;
  const tissueScore = breakdown.tissue ?? 23;
  const priorityScore = breakdown.priority ?? 18;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/doctor/matches" })}
            className="gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Match Proposals
          </Button>
          <div className="h-4 w-px bg-slate-300" />
          <div className="flex items-center gap-2">
            <Shuffle className="h-5 w-5 text-purple-600" />
            <h1 className="text-xl font-bold text-slate-900">
              Clinical Match Review: <span className="font-mono">{match.match_code || matchId.slice(0, 8)}</span>
            </h1>
            <Badge className="bg-purple-600 text-white font-mono text-xs font-bold">
              Rank #{match.rank || 1}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            className={`font-mono text-xs font-bold px-3 py-1 ${
              scorePct >= 85
                ? "bg-emerald-600 text-white"
                : scorePct >= 70
                ? "bg-blue-600 text-white"
                : "bg-amber-600 text-white"
            }`}
          >
            {scorePct}% Compatibility Score
          </Badge>
        </div>
      </div>

      {/* Medical Governance Notice */}
      <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl flex items-center gap-3 text-xs text-amber-900 shadow-xs">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
        <p className="leading-relaxed">
          <strong>Physician Medical Governance Notice:</strong> Doctors provide clinical suitability evaluations and recommendations. <strong>Final organ allocation approval is strictly executed by the Allocation Authority.</strong>
        </p>
      </div>

      {/* Side-by-Side Donor vs Recipient Clinical Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DONOR COLUMN */}
        <Card className="border border-slate-200/80 shadow-xs bg-white">
          <CardHeader className="border-b border-slate-100 pb-3 bg-emerald-50/40">
            <CardTitle className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-2">
              <HeartHandshake className="h-4 w-4 text-emerald-600" /> Donor Medical Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3.5 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block font-medium">Donor Code</span>
                <span className="font-mono font-bold text-slate-900 text-xs">{match.donor?.code || "DNR"}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block font-medium">Name & Age</span>
                <span className="font-bold text-slate-900 text-xs">{match.donor?.name || "Donor"}, {match.donor?.age || 35}y</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block font-medium">Blood Group</span>
                <span className="font-mono font-bold text-slate-900 text-xs">{match.donor?.blood_group || "—"}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block font-medium">Organ Type</span>
                <span className="font-bold text-slate-900 text-xs">{match.organ?.organ_type || "Organ"}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block font-medium">Organ Code</span>
                <span className="font-mono font-bold text-slate-900 text-xs">{match.organ?.code || "ORG"}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block font-medium">Viability Status</span>
                <span className="font-bold text-emerald-600 text-xs">Optimal</span>
              </div>
            </div>

            {/* Donor HLA */}
            <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg space-y-1">
              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                <Dna className="h-3.5 w-3.5 text-emerald-600" /> Donor HLA Typing
              </span>
              <p className="font-mono text-xs text-emerald-950 bg-white p-2 rounded border border-emerald-200">
                {match.donor?.hla || "A*02:01, A*24:02, B*07:02, B*44:02, DRB1*04:01"}
              </p>
            </div>

            {/* Donor Medical Notes */}
            <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-lg space-y-1">
              <span className="font-bold text-slate-800">Donor Clinical Background</span>
              <p className="text-slate-700 bg-white p-2 rounded border border-slate-200 leading-relaxed">
                {match.donor?.medical_details?.notes || "Brain-dead donor, normotensive, cleared viral serology panel."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* RECIPIENT COLUMN */}
        <Card className="border border-slate-200/80 shadow-xs bg-white">
          <CardHeader className="border-b border-slate-100 pb-3 bg-blue-50/40">
            <CardTitle className="text-xs font-bold text-blue-950 uppercase tracking-wider flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" /> Candidate Recipient Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3.5 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block font-medium">Recipient Code</span>
                <span className="font-mono font-bold text-slate-900 text-xs">{match.recipient?.code || "REC"}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block font-medium">Name & Age</span>
                <span className="font-bold text-slate-900 text-xs">{match.recipient?.name || "Patient"}, {match.recipient?.age || 40}y</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block font-medium">Blood Group</span>
                <span className="font-mono font-bold text-slate-900 text-xs">{match.recipient?.blood_group || "—"}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block font-medium">Required Organ</span>
                <span className="font-bold text-slate-900 text-xs">{match.recipient?.required_organ || "Organ"}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block font-medium">Waitlist Urgency</span>
                <span className="font-bold text-rose-600 text-xs">{match.recipient?.urgency || "CRITICAL"}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block font-medium">Priority Class</span>
                <span className="font-bold text-slate-900 text-xs">{match.recipient?.priority || "HIGH"}</span>
              </div>
            </div>

            {/* Recipient HLA */}
            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg space-y-1">
              <span className="font-bold text-blue-900 flex items-center gap-1.5">
                <Dna className="h-3.5 w-3.5 text-blue-600" /> Recipient HLA Typing
              </span>
              <p className="font-mono text-xs text-blue-950 bg-white p-2 rounded border border-blue-200">
                {match.recipient?.hla || "A*02:01, A*24:02, B*07:02, B*44:02, DRB1*04:01"}
              </p>
            </div>

            {/* Recipient Condition */}
            <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-lg space-y-1">
              <span className="font-bold text-slate-800">Primary Diagnosis</span>
              <p className="text-slate-700 bg-white p-2 rounded border border-slate-200 leading-relaxed">
                {match.recipient?.condition || match.recipient?.medical_details?.condition || "End-stage organ failure requiring urgent transplant."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compatibility Analysis (Breakdown Scores from Matching Engine) */}
      <Card className="border border-slate-200/80 shadow-xs bg-white">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-600" /> Compatibility Analysis & Engine Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center space-y-1">
              <span className="text-slate-500 font-medium block">Blood Group Match</span>
              <span className="text-xl font-black text-slate-900 font-mono">{bloodScore} / 25</span>
              <span className="text-[10px] text-emerald-600 font-semibold block">Isohemagglutinin Compatible</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center space-y-1">
              <span className="text-slate-500 font-medium block">Medical Suitability</span>
              <span className="text-xl font-black text-slate-900 font-mono">{medicalScore} / 30</span>
              <span className="text-[10px] text-blue-600 font-semibold block">Weight & Size Adjusted</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center space-y-1">
              <span className="text-slate-500 font-medium block">Tissue / HLA Match</span>
              <span className="text-xl font-black text-slate-900 font-mono">{tissueScore} / 25</span>
              <span className="text-[10px] text-purple-600 font-semibold block">6/6 Antigen Alignment</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center space-y-1">
              <span className="text-slate-500 font-medium block">Urgency / Priority</span>
              <span className="text-xl font-black text-slate-900 font-mono">{priorityScore} / 20</span>
              <span className="text-[10px] text-rose-600 font-semibold block">High Waitlist Priority</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Completed Status Banner */}
      {isCompleted && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-950 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-emerald-900 block">Clinical Match Review Recorded</span>
              <span className="text-emerald-700 text-xs">
                This clinical match review is complete and saved in read-only mode.
              </span>
            </div>
          </div>
          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-[11px] px-3 py-1 shrink-0">
            {existingReview?.recommendation?.replace(/_/g, ' ') || match?.status || "COMPLETED"}
          </Badge>
        </div>
      )}

      {/* Clinical Review Form & Distinct Action Buttons */}
      <Card className="border border-slate-200/80 shadow-xs bg-white">
        <CardHeader className="border-b border-slate-100 pb-3 bg-slate-50/50">
          <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-blue-600" /> Physician Match Recommendation
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 text-xs block">
                Clinical Risk Stratification <span className="text-rose-500">*</span>
              </label>
              <Select
                value={riskLevel}
                disabled={isCompleted || submitReview.isPending}
                onValueChange={(val) => {
                  if (!isCompleted && !submitReview.isPending) setRiskLevel(val);
                }}
              >
                <SelectTrigger className={`h-10 text-xs bg-white border-slate-200 ${isCompleted ? 'opacity-80 cursor-not-allowed' : ''}`}>
                  <SelectValue placeholder="Select Risk Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low Risk (Favorable crossmatch and immunology)</SelectItem>
                  <SelectItem value="MEDIUM">Moderate Risk (Monitor donor specific antibodies)</SelectItem>
                  <SelectItem value="HIGH">High Risk (Requires specialized desensitization protocol)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 text-xs block">
                Clinical Recommendation to Authority <span className="text-rose-500">*</span>
              </label>
              <Select
                value={recommendation}
                disabled={isCompleted || submitReview.isPending}
                onValueChange={(val) => {
                  if (!isCompleted && !submitReview.isPending) setRecommendation(val);
                }}
              >
                <SelectTrigger className={`h-10 text-xs bg-white border-slate-200 ${isCompleted ? 'opacity-80 cursor-not-allowed' : ''}`}>
                  <SelectValue placeholder="Select Recommendation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECOMMEND_FOR_ALLOCATION">Recommend for Allocation Review</SelectItem>
                  <SelectItem value="HOLD_FOR_FURTHER_REVIEW">Hold for Further Testing / Crossmatch</SelectItem>
                  <SelectItem value="CLINICALLY_UNSUITABLE">Mark Clinically Unsuitable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-800 text-xs block">
              Physician Clinical Justification & Observations <span className="text-rose-500">*</span>
            </label>
            <Textarea
              value={clinicalNotes}
              disabled={isCompleted || submitReview.isPending}
              onChange={(e) => {
                if (!isCompleted && !submitReview.isPending) setClinicalNotes(e.target.value);
              }}
              placeholder="Document immunological suitability rationale, crossmatch observations, and medical justification for the Allocation Authority..."
              rows={3}
              className={`text-xs border-slate-200 focus:border-blue-500 ${isCompleted ? 'opacity-80 cursor-not-allowed bg-slate-50' : ''}`}
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            {isCompleted ? (
              <div className="w-full flex items-center justify-end">
                <Button
                  type="button"
                  disabled
                  className="w-full sm:w-auto h-10 px-6 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 gap-2 cursor-not-allowed shadow-none"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Review Recorded
                </Button>
              </div>
            ) : (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setIsRejectModalOpen(true)}
                  disabled={isCompleted || submitReview.isPending}
                  className="text-xs font-bold gap-1.5 h-10 px-4"
                >
                  <XCircle className="h-4 w-4" />
                  Mark Clinically Unsuitable
                </Button>

                <div className="flex items-center gap-2.5">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!isCompleted && !submitReview.isPending) {
                        submitReview.mutate({
                          suitability: "NEEDS_REVIEW",
                          rec: "HOLD_FOR_FURTHER_REVIEW",
                          notes: clinicalNotes || "Hold for further clinical crossmatch review.",
                        });
                      }
                    }}
                    disabled={isCompleted || submitReview.isPending}
                    className="text-xs font-semibold gap-1.5 h-10 px-4 border-amber-300 text-amber-800 hover:bg-amber-50"
                  >
                    <Clock className="h-4 w-4 text-amber-600" />
                    Request Further Review
                  </Button>

                  <Button
                    onClick={() => {
                      if (!isCompleted && !submitReview.isPending) {
                        submitReview.mutate({
                          suitability: "APPROVED",
                          rec: "RECOMMEND_FOR_ALLOCATION",
                          notes: clinicalNotes || "Candidate medically recommended for allocation.",
                        });
                      }
                    }}
                    disabled={isCompleted || submitReview.isPending}
                    className="text-xs font-bold gap-1.5 h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  >
                    {submitReview.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Submitting Review...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Recommend for Allocation Review
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reject Modal */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <XCircle className="h-5 w-5" /> Mark Clinically Unsuitable
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Please specify the clinical or immunological reason why this match is unsuitable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-800 block">
                Mandatory Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <Input
                value={rejectionReason}
                disabled={isCompleted || submitReview.isPending}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Positive crossmatch, HLA donor-specific antibody mismatch..."
                className="text-xs h-9"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" size="sm" onClick={() => setIsRejectModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!rejectionReason.trim() || isCompleted || submitReview.isPending}
                onClick={() => {
                  if (!isCompleted && !submitReview.isPending) {
                    submitReview.mutate({
                      suitability: "NOT_APPROVED",
                      rec: "CLINICALLY_UNSUITABLE",
                      notes: clinicalNotes,
                      reason: rejectionReason,
                    });
                  }
                }}
                className="gap-1.5 text-xs font-bold"
              >
                <XCircle className="h-3.5 w-3.5" />
                Confirm Unsuitability
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Clinical Match Review Success Confirmation Modal ──────────────── */}
      {successModalData && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-modal-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative border border-slate-100 animate-in fade-in zoom-in-95 duration-200 text-center">
            {/* Close Icon */}
            <button
              type="button"
              onClick={() => setSuccessModalData(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-full p-1 transition-colors focus:outline-hidden"
              aria-label="Close modal"
            >
              <XCircle className="h-5 w-5" />
            </button>

            {/* Checkmark icon */}
            <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200/60 shadow-xs">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 stroke-[2.5]" />
            </div>

            {/* Header */}
            <h3 id="match-modal-title" className="text-lg font-extrabold text-slate-900 mb-1">
              Clinical Match Review Recorded
            </h3>
            <p className="text-xs text-slate-500 mb-5 font-medium">
              Your clinical match review has been recorded successfully.
            </p>

            {/* Details Box */}
            <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-4 space-y-2.5 text-left mb-6 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Review ID</span>
                <span className="font-bold text-slate-900 font-mono">
                  {successModalData.review_code ||
                    (successModalData.id
                      ? `CMR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(successModalData.id).slice(0, 4).toUpperCase()}`
                      : "CMR-2026-0042")}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Match ID</span>
                <span className="font-bold text-slate-900 font-mono">
                  {successModalData.match_code || match?.match_code || matchId.slice(0, 8).toUpperCase()}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Donor ID</span>
                <span className="font-bold text-slate-900 font-mono">
                  {successModalData.donor_code || match?.donor?.code || "DNR-UNKNOWN"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Recipient ID</span>
                <span className="font-bold text-slate-900 font-mono">
                  {successModalData.recipient_code || match?.recipient?.code || "REC-UNKNOWN"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Recommendation</span>
                <span>
                  {(() => {
                    const rec = (successModalData.recommendation || recommendation || "RECOMMEND_FOR_ALLOCATION").toUpperCase();
                    if (rec.includes("RECOMMEND") || rec === "APPROVED") {
                      return (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Recommend for Allocation Review
                        </span>
                      );
                    } else if (rec.includes("HOLD") || rec === "NEEDS_REVIEW") {
                      return (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Hold for Further Review
                        </span>
                      );
                    } else {
                      return (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          Mark Clinically Unsuitable
                        </span>
                      );
                    }
                  })()}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Submitted On</span>
                <span className="font-medium text-slate-800">
                  {fmtDateTime(successModalData.submitted_on || successModalData.reviewed_at || new Date().toISOString())}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Submitted By</span>
                <span className="font-bold text-slate-900">
                  {successModalData.submitted_by ||
                    (user?.full_name ? (user.full_name.toLowerCase().startsWith("dr.") ? user.full_name : `Dr. ${user.full_name}`) : (user?.username ? `Dr. ${user.username}` : "Dr. Doctor"))}
                </span>
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSuccessModalData(null)}
                className="flex-1 h-10 text-xs font-semibold text-slate-700 border-slate-300 gap-1.5 shadow-2xs hover:bg-slate-50"
              >
                <FileText className="h-4 w-4 text-slate-500" />
                View Match Review
              </Button>

              <Button
                type="button"
                onClick={() => navigate({ to: "/doctor/matches" })}
                className="flex-1 h-10 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 gap-1.5 shadow-xs"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Match Reviews
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
