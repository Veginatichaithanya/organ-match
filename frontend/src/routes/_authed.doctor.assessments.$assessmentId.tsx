import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Dna,
  FileCheck2,
  FileEdit,
  FileText,
  Heart,
  HeartHandshake,
  HeartPulse,
  Info,
  Layers,
  Lock,
  Percent,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  Shuffle,
  Stethoscope,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, fmtDateTime, fmtDate } from "@/components/ui-kit";
import { toast } from "sonner";
import type {
  DoctorRecipientDetail,
  DoctorOrganDetail,
  DoctorDonorDetail,
  DoctorMatchProposal,
} from "@/services/types";

export const Route = createFileRoute("/_authed/doctor/assessments/$assessmentId")({
  validateSearch: (search: Record<string, unknown>) => ({
    type: (search.type as string) || "Recipient",
  }),
  head: () => ({
    meta: [{ title: "Clinical Assessment — OrganMatch" }],
  }),
  component: DoctorClinicalAssessmentDetailPage,
});

type SuitabilityOption = "APPROVED" | "NOT_APPROVED" | "NEEDS_REVIEW";
type RiskLevelOption = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

const RISK_DESCRIPTIONS: Record<string, string> = {
  LOW: "Low risk - Standard clinical risk profile, favorable crossmatch and baseline parameters.",
  MODERATE: "Moderate risk - Proceed with standard precautions and perioperative monitoring.",
  HIGH: "High risk - Requires specialized intensive management, desensitization, or critical monitoring.",
  CRITICAL: "Critical risk - Extreme immunological or surgical risk factors present.",
};

function DoctorClinicalAssessmentDetailPage() {
  const { assessmentId } = Route.useParams();
  const searchParams = useSearch({ from: "/_authed/doctor/assessments/$assessmentId" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, ready } = useAuth();

  const entityType = (searchParams.type as "Recipient" | "Organ" | "Donor" | "Match") || "Recipient";

  // Form State
  const [suitability, setSuitability] = useState<SuitabilityOption | "">("");
  const [riskLevel, setRiskLevel] = useState<RiskLevelOption | "">("");
  const [successModalData, setSuccessModalData] = useState<any | null>(null);
  const [isSubmittedLocally, setIsSubmittedLocally] = useState<boolean>(false);

  // Validation Errors
  const [errors, setErrors] = useState<{
    suitability?: string;
    riskLevel?: string;
  }>({});

  // 1. Fetch Target Entity details from real backend API
  const {
    data: rawData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["doctor", "entity", entityType, assessmentId],
    queryFn: async () => {
      if (entityType === "Donor") {
        return await api.doctorGetDonor(assessmentId);
      } else if (entityType === "Organ") {
        return await api.doctorGetOrgan(assessmentId);
      } else if (entityType === "Match") {
        return await api.doctorGetMatch(assessmentId);
      } else {
        return await api.doctorGetRecipient(assessmentId);
      }
    },
    enabled: ready && !!user && !!assessmentId,
  });

  // Target-specific resolved models
  const donorData = useMemo<DoctorDonorDetail | null>(() => {
    if (!rawData) return null;
    if (entityType === "Donor") return rawData as DoctorDonorDetail;
    if (entityType === "Organ") return (rawData as any).donor || null;
    if (entityType === "Match") return (rawData as DoctorMatchProposal).donor || null;
    return null;
  }, [rawData, entityType]);

  const recipientData = useMemo<DoctorRecipientDetail | null>(() => {
    if (!rawData) return null;
    if (entityType === "Recipient") return rawData as DoctorRecipientDetail;
    if (entityType === "Match") return (rawData as DoctorMatchProposal).recipient || null;
    return null;
  }, [rawData, entityType]);

  const organData = useMemo<DoctorOrganDetail | null>(() => {
    if (!rawData) return null;
    if (entityType === "Organ") return rawData as DoctorOrganDetail;
    if (entityType === "Recipient") return (rawData as DoctorRecipientDetail).matched_organ || null;
    if (entityType === "Match") return (rawData as DoctorMatchProposal).organ || null;
    return null;
  }, [rawData, entityType]);

  const matchData = useMemo<DoctorMatchProposal | null>(() => {
    if (!rawData) return null;
    if (entityType === "Match") return rawData as DoctorMatchProposal;
    if (entityType === "Recipient") return (rawData as DoctorRecipientDetail).match || null;
    return null;
  }, [rawData, entityType]);

  const existingAssessment = useMemo(() => {
    if (!rawData) return null;
    if (rawData.latest_assessment) return rawData.latest_assessment;
    if (rawData.assessments && rawData.assessments.length > 0) return rawData.assessments[0];
    return null;
  }, [rawData]);

  const isEditing = Boolean(existingAssessment?.id);
  const isCompleted = Boolean(existingAssessment?.id || isSubmittedLocally);

  // Populate form when existing real assessment is loaded
  useEffect(() => {
    if (existingAssessment) {
      const s = existingAssessment.suitability?.toUpperCase() || "";
      if (s === "APPROVED" || s === "NOT_APPROVED" || s === "NEEDS_REVIEW") {
        setSuitability(s as SuitabilityOption);
      }
      const r = existingAssessment.risk_level?.toUpperCase() || "";
      if (r === "MEDIUM" || r === "MODERATE") {
        setRiskLevel("MODERATE");
      } else if (r === "LOW" || r === "HIGH" || r === "CRITICAL") {
        setRiskLevel(r as RiskLevelOption);
      }
    }
  }, [existingAssessment]);

  // Validation Logic
  const validateForm = (): boolean => {
    const errs: typeof errors = {};
    if (!suitability) {
      errs.suitability = "Clinical suitability selection is required.";
    }
    if (!riskLevel) {
      errs.riskLevel = "Clinical risk level stratification is required.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Mutation
  const submitAssessment = useMutation({
    mutationFn: async (isDraft: boolean) => {
      const finalSuitability = isDraft ? (suitability || "NEEDS_REVIEW") : suitability;
      const finalRiskLevel = isDraft ? (riskLevel || "LOW") : riskLevel;

      if (isEditing && existingAssessment?.id) {
        return await api.doctorUpdateAssessment(existingAssessment.id, {
          suitability: finalSuitability as any,
          risk_level: finalRiskLevel as any,
        });
      } else {
        return await api.doctorCreateAssessment({
          entity_type: entityType,
          entity_id: assessmentId,
          suitability: finalSuitability as any,
          risk_level: finalRiskLevel as any,
        });
      }
    },
    onSuccess: (res: any, isDraft: boolean) => {
      setIsSubmittedLocally(true);
      if (!isDraft) {
        setSuccessModalData(res);
      } else {
        toast.success("Assessment draft saved successfully.");
      }
      queryClient.invalidateQueries({ queryKey: ["doctor"] });
      queryClient.invalidateQueries({ queryKey: ["doctor", "targets"] });
      queryClient.invalidateQueries({ queryKey: ["doctor", "assessments"] });
      queryClient.invalidateQueries({ queryKey: ["doctor", "history"] });
      queryClient.invalidateQueries({ queryKey: ["doctor", "entity", entityType, assessmentId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || err?.detail || "Unable to submit clinical assessment.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCompleted || submitAssessment.isPending) return;
    if (!validateForm()) {
      toast.error("Please complete all required clinical evaluation fields.");
      return;
    }
    submitAssessment.mutate(false);
  };

  const handleSaveDraft = () => {
    if (isCompleted || submitAssessment.isPending) return;
    if (!suitability && !riskLevel) {
      toast.error("Please select clinical suitability or risk level before saving draft.");
      return;
    }
    submitAssessment.mutate(true);
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center space-y-3">
        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-700">
          Loading clinical assessment target data from hospital database…
        </p>
        <p className="text-xs text-slate-400">Verifying hospital access authorization…</p>
      </div>
    );
  }

  if (error || !rawData) {
    return (
      <div className="p-12 max-w-2xl mx-auto space-y-4 text-center">
        <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Clinical Target Not Found</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          The requested record was not found or belongs to another hospital beyond your authorized clinical scope.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate({ to: "/doctor/assessments" })}
          className="gap-2 text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4" /> Return to Clinical Assessments
        </Button>
      </div>
    );
  }

  // ─── Target-Specific Context Variables ──────────────────────────────────────
  const targetCode =
    entityType === "Donor"
      ? (rawData as DoctorDonorDetail).donor_code
      : entityType === "Recipient"
      ? (rawData as DoctorRecipientDetail).recipient_code
      : entityType === "Organ"
      ? (rawData as DoctorOrganDetail).organ_code
      : (rawData as DoctorMatchProposal).match_code || `MAT-${assessmentId.slice(0, 6).toUpperCase()}`;

  const targetName =
    entityType === "Donor"
      ? (rawData as DoctorDonorDetail).name || "Anonymous Donor"
      : entityType === "Recipient"
      ? (rawData as DoctorRecipientDetail).name || "Anonymous Patient"
      : entityType === "Organ"
      ? `${(rawData as DoctorOrganDetail).organ_type} (${(rawData as DoctorOrganDetail).donor_name || 'Donor'})`
      : `Match Pair: ${(rawData as DoctorMatchProposal).donor_code || 'DNR'} → ${(rawData as DoctorMatchProposal).recipient_code || 'REC'}`;

  const targetAge =
    entityType === "Donor"
      ? `${(rawData as DoctorDonorDetail).age ?? "—"} years`
      : entityType === "Recipient"
      ? `${(rawData as DoctorRecipientDetail).age ?? "—"} years`
      : entityType === "Organ"
      ? `${organData?.donor_name || 'Donor'} (${organData?.blood_group || '—'})`
      : `${recipientData?.age ?? "—"} years`;

  const targetGender =
    entityType === "Donor"
      ? (rawData as DoctorDonorDetail).gender || "Unspecified"
      : entityType === "Recipient"
      ? (rawData as DoctorRecipientDetail).gender || "Unspecified"
      : "Unspecified";

  const targetBloodGroup =
    rawData.blood_group ||
    organData?.blood_group ||
    recipientData?.blood_group ||
    donorData?.blood_group ||
    "—";

  const targetUrgency =
    entityType === "Recipient"
      ? (rawData as DoctorRecipientDetail).urgency || "MODERATE"
      : entityType === "Donor"
      ? "Donor Clearance"
      : entityType === "Organ"
      ? "Optimal Viability"
      : (rawData as DoctorMatchProposal).recipient_urgency || "MODERATE";

  const targetPriority =
    entityType === "Recipient"
      ? (rawData as DoctorRecipientDetail).priority || "MEDIUM"
      : entityType === "Donor"
      ? "HIGH"
      : entityType === "Organ"
      ? "HIGH"
      : `Rank #${(rawData as DoctorMatchProposal).rank || 1}`;

  const targetHospital =
    rawData.hospital_name ||
    rawData.hospital ||
    "Hospital Scope";

  const targetRegisteredOn =
    rawData.registered_on ||
    rawData.created_at;

  // Organ Context
  const organType =
    organData?.organ_type ||
    (rawData as any).organ_type ||
    recipientData?.required_organ ||
    "KIDNEY";

  const organCode = organData?.organ_code || (entityType === "Organ" ? targetCode : null);

  const organBloodGroup = organData?.blood_group || targetBloodGroup;

  const organLaterality =
    organData?.laterality ||
    organData?.medical_details?.laterality ||
    organData?.medical_details?.side ||
    (organType === "KIDNEY" ? "BOTH" : "N/A");

  const organHarvestDateTime =
    organData?.harvest_date ||
    organData?.created_at ||
    null;

  const organColdIschemia =
    organData?.cold_ischemia_time ||
    organData?.medical_details?.cold_ischemia_time ||
    "02:30";

  const organWarmIschemia =
    organData?.warm_ischemia_time ||
    organData?.medical_details?.warm_ischemia_time ||
    "00:15";

  const organPreservationMethod =
    organData?.preservation_method ||
    organData?.medical_details?.preservation_method ||
    "Static Cold Storage";

  const organStatus = organData?.status || "AVAILABLE";

  // Match Context (Strictly Real Match Data)
  const hasRealMatch = Boolean(matchData && (matchData.id || matchData.match_code));

  const matchCode = matchData
    ? (matchData.match_code || `MAT-${matchData.id?.slice(0, 6).toUpperCase()}`)
    : null;

  const donorCode =
    donorData?.donor_code ||
    matchData?.donor_code ||
    organData?.donor_code ||
    "—";

  const matchScorePct = matchData?.compatibility_score !== undefined
    ? Math.round(matchData.compatibility_score)
    : null;

  const matchRank = matchData?.rank ?? null;

  const matchEligibility = matchData?.eligibility || (matchScorePct !== null && matchScorePct >= 50 ? "ELIGIBLE" : "REVIEW_REQUIRED");

  const scoringBreakdown = matchData?.scoring_breakdown || {};

  const bloodCompLabel = matchData?.blood_compatibility || (scoringBreakdown.blood && scoringBreakdown.blood >= 20 ? "Compatible" : "Compatible");

  const medScore = scoringBreakdown.medical ?? 21;
  const tissueScore = scoringBreakdown.tissue ?? scoringBreakdown.hla ?? 5;
  const priorityScore = scoringBreakdown.priority ?? 10;

  const currentStatusVal = existingAssessment?.suitability || "PENDING";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ─── Breadcrumb & Top Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <button
              onClick={() => navigate({ to: "/doctor/assessments" })}
              className="hover:text-blue-600 transition-colors"
            >
              Clinical Assessments
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-900 font-medium">Assessment Details</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isEditing ? "Edit Clinical Assessment" : "Clinical Assessment"}
            </h1>
            <Badge
              variant="outline"
              className="font-medium text-xs bg-blue-50 text-blue-700 border-blue-200 px-2.5 py-0.5"
            >
              Reviewing <strong className="uppercase ml-1 mr-1">{entityType}</strong> <span className="font-mono font-bold">{targetCode}</span>
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs px-2.5 py-0.5 font-semibold ${
                currentStatusVal === "APPROVED"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : currentStatusVal === "NOT_APPROVED"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : currentStatusVal === "NEEDS_REVIEW"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current mr-1.5 inline-block" />
              {currentStatusVal === "APPROVED"
                ? "Clinical Assessment Approved"
                : currentStatusVal === "NOT_APPROVED"
                ? "Not Approved"
                : currentStatusVal === "NEEDS_REVIEW"
                ? "Needs Clinical Review"
                : "Pending Assessment"}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2 text-xs font-semibold shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-blue-600" : ""}`} />
            Refresh Data
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/doctor/assessments" })}
            className="gap-2 text-xs font-semibold shadow-2xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Assessments
          </Button>
        </div>
      </div>

      {/* ─── Target-Specific Summary Header Cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Target Primary Identity */}
        <Card className="border border-slate-200/90 shadow-2xs bg-white rounded-xl">
          <CardContent className="p-4 flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              {entityType === "Donor" ? (
                <HeartHandshake className="h-5 w-5" />
              ) : entityType === "Recipient" ? (
                <User className="h-5 w-5" />
              ) : entityType === "Organ" ? (
                <Heart className="h-5 w-5" />
              ) : (
                <Shuffle className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                {entityType} Target Identity
              </span>
              <div className="text-sm font-bold text-slate-900 truncate mt-0.5">
                {targetName}
              </div>
              <span className="font-mono text-xs font-bold text-blue-600 block mt-0.5">
                {targetCode}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Context Profile */}
        <Card className="border border-slate-200/90 shadow-2xs bg-white rounded-xl">
          <CardContent className="p-4 flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <Activity className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                {entityType === "Donor" ? "Donated Organ(s)" : entityType === "Recipient" ? "Required Organ & Urgency" : entityType === "Organ" ? "Viability & Ischemia" : "Match Pair Info"}
              </span>
              <div className="flex items-baseline justify-between gap-2 mt-0.5">
                <span className="text-sm font-bold text-slate-900 uppercase">
                  {organType}
                </span>
                <Badge
                  variant="outline"
                  className="font-mono font-bold text-[10px] bg-blue-50 text-blue-700 border-blue-200 px-2 py-0"
                >
                  Blood: {targetBloodGroup}
                </Badge>
              </div>
              <span className="font-mono text-xs font-semibold text-slate-600 block mt-0.5">
                {entityType === "Donor"
                  ? `${donorData?.organs?.length || 1} organ(s) registered`
                  : entityType === "Recipient"
                  ? `Urgency: ${targetUrgency}`
                  : entityType === "Organ"
                  ? `Cold Ischemia: ${organColdIschemia}`
                  : `Score: ${matchScorePct}%`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Clinical Review Summary */}
        <Card className="border border-slate-200/90 shadow-2xs bg-white rounded-xl">
          <CardContent className="p-4 flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Clinical Review Status
              </span>
              <div className="flex items-baseline justify-between gap-2 mt-0.5">
                <span className="text-sm font-bold text-slate-900">
                  {currentStatusVal === "APPROVED"
                    ? "APPROVED"
                    : currentStatusVal === "NOT_APPROVED"
                    ? "NOT APPROVED"
                    : "NEEDS REVIEW"}
                </span>
                <Badge
                  variant="outline"
                  className="font-bold text-[10px] bg-purple-50 text-purple-700 border-purple-200 px-2 py-0"
                >
                  {existingAssessment?.risk_level ? `Risk: ${existingAssessment.risk_level}` : "Pending Evaluation"}
                </Badge>
              </div>
              <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                Doctor Assessment Status
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Previous Assessment Info (if editing) ─────────────────────────── */}
      {isEditing && (
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 shadow-2xs">
          <div className="flex items-center gap-2 font-medium">
            <FileCheck2 className="h-4 w-4 text-blue-600 shrink-0" />
            <span>
              Existing Assessment by <strong className="text-slate-900">{existingAssessment.reviewer_username || "Attending Physician"}</strong>
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono">
            <span>Reviewed: {fmtDateTime(existingAssessment.reviewed_at)}</span>
            <span>Created: {fmtDateTime(existingAssessment.created_at)}</span>
          </div>
        </div>
      )}

      {/* ─── Target-Specific Detailed Context Cards (Grid) ───────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* ─── CASE A: DONOR TARGET ────────────────────────────────────────── */}
        {entityType === "Donor" && (
          <>
            {/* Section 1: Donor Information */}
            <Card className="border border-slate-200/90 shadow-2xs bg-white rounded-xl">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between py-3.5 px-5">
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Donor Information
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-50">
                  Read-only Context
                </Badge>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-xs">
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Donor Name</span>
                    <span className="font-bold text-slate-900 capitalize">{targetName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Donor Code</span>
                    <span className="font-mono font-bold text-slate-900">{targetCode}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Age</span>
                    <span className="font-semibold text-slate-800">{targetAge}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Gender</span>
                    <span className="font-semibold text-slate-800 capitalize">{targetGender}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Blood Group</span>
                    <Badge variant="outline" className="font-mono font-bold text-[11px] bg-slate-50 text-slate-900">
                      {targetBloodGroup}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Hospital</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[150px] text-right">
                      {targetHospital}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-500 font-medium">Registered On</span>
                    <span className="font-mono text-slate-700 font-medium">
                      {fmtDate(targetRegisteredOn)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Donated Organs Information */}
            <Card className="border border-slate-200/90 shadow-2xs bg-white rounded-xl">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between py-3.5 px-5">
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Donated Organ(s) Information
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-50">
                  Read-only Context
                </Badge>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-xs">
                {donorData?.organs && donorData.organs.length > 0 ? (
                  <div className="space-y-3">
                    {donorData.organs.map((org: any) => (
                      <div key={org.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 uppercase">{org.organ_type || "Organ"}</span>
                          <Badge variant="outline" className="font-mono font-bold text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            {org.status || "AVAILABLE"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between font-mono text-[11px] text-slate-600">
                          <span>Code: {org.code || org.organ_code || "—"}</span>
                          <span>Blood: {targetBloodGroup}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/80 text-center text-slate-500 text-xs">
                    <p className="font-medium">All pledged organs for this donor are under medical review.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Section 3: Clinical Review Status */}
            <Card className="border border-slate-200/90 shadow-2xs bg-white rounded-xl">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between py-3.5 px-5">
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center">
                    3
                  </span>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Clinical Suitability Status
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-50">
                  Doctor Evaluation
                </Badge>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-xs">
                <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-2 text-blue-950">
                  <span className="font-bold block text-xs">Physician Evaluation Mandate</span>
                  <p className="text-[11px] leading-relaxed text-blue-900/90">
                    Review donor vital parameters, infectious disease screen, blood group verification, and surgical organ suitability before clearance.
                  </p>
                </div>
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Evaluation Target</span>
                    <span className="font-semibold text-slate-800">Donor Clearance</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Current Status</span>
                    <Badge variant="outline" className="font-bold text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                      {currentStatusVal}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ─── CASE B: RECIPIENT TARGET ────────────────────────────────────── */}
        {entityType === "Recipient" && (
          <>
            {/* Section 1: Recipient Information */}
            <Card className="border border-slate-200/90 shadow-2xs bg-white rounded-xl">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between py-3.5 px-5">
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Recipient Information
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-50">
                  Read-only Context
                </Badge>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-xs">
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Recipient Name</span>
                    <span className="font-bold text-slate-900 capitalize">{targetName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Recipient Code</span>
                    <span className="font-mono font-bold text-slate-900">{targetCode}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Age</span>
                    <span className="font-semibold text-slate-800">{targetAge}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Gender</span>
                    <span className="font-semibold text-slate-800 capitalize">{targetGender}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Blood Group</span>
                    <Badge variant="outline" className="font-mono font-bold text-[11px] bg-slate-50 text-slate-900">
                      {targetBloodGroup}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Urgency</span>
                    <Badge variant="outline" className="font-bold text-[10px] bg-rose-50 text-rose-700 border-rose-200">
                      {targetUrgency}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Priority</span>
                    <Badge variant="outline" className="font-bold text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                      {targetPriority}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Hospital</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[150px] text-right">
                      {targetHospital}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-500 font-medium">Registered On</span>
                    <span className="font-mono text-slate-700 font-medium">
                      {fmtDate(targetRegisteredOn)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Required Organ Information */}
            <Card className="border border-slate-200/90 shadow-2xs bg-white rounded-xl">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between py-3.5 px-5">
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Required Organ Information
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-50">
                  Read-only Context
                </Badge>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-xs">
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Required Organ</span>
                    <span className="font-bold text-slate-900 uppercase">{organType}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Blood Group</span>
                    <Badge variant="outline" className="font-mono font-bold text-[11px] bg-slate-50 text-slate-900">
                      {targetBloodGroup}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Matched Organ Code</span>
                    <span className="font-mono font-bold text-slate-900">
                      {organCode || "Not Yet Assigned"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-500 font-medium">Organ Status</span>
                    <Badge variant="outline" className="font-bold text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      {organData?.status || "WAITLISTED"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Match Information (Real Match Only) */}
            <Card className="border border-slate-200/90 shadow-2xs bg-white rounded-xl">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between py-3.5 px-5">
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center">
                    3
                  </span>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Match Information
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 border-purple-200">
                  {hasRealMatch ? <Lock className="h-3 w-3 mr-1 inline" /> : null}
                  {hasRealMatch ? "Linked Match" : "No Match Linked"}
                </Badge>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-xs">
                {hasRealMatch ? (
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Match ID</span>
                      <span className="font-mono font-bold text-slate-900">{matchCode}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Compatibility Score</span>
                      <span className="font-mono font-bold text-emerald-600 text-sm">{matchScorePct}%</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Rank</span>
                      <span className="font-mono font-bold text-slate-900">#{matchRank}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Eligibility</span>
                      <Badge variant="outline" className="font-bold text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                        {matchEligibility}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/80 text-center text-slate-500 text-xs">
                    <p className="font-medium">No active algorithmic match linked to recipient.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Match calculation runs when organ reservation is initiated.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ─── CASE C: ORGAN TARGET ────────────────────────────────────────── */}
        {entityType === "Organ" && (
          <>
            {/* Section 1: Organ Information */}
            <Card className="border border-slate-200/90 shadow-2xs bg-white rounded-xl">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between py-3.5 px-5">
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Organ Information
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-50">
                  Read-only Context
                </Badge>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-xs">
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Organ Type</span>
                    <span className="font-bold text-slate-900 uppercase">{organType}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Organ Code</span>
                    <span className="font-mono font-bold text-slate-900">{targetCode}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Blood Group</span>
                    <Badge variant="outline" className="font-mono font-bold text-[11px] bg-slate-50 text-slate-900">
                      {targetBloodGroup}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Laterality</span>
                    <span className="font-semibold text-slate-800">{organLaterality}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Harvest Date / Time</span>
                    <span className="font-mono text-slate-700 font-medium">
                      {fmtDateTime(organHarvestDateTime)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Cold Ischemia Time</span>
                    <span className="font-mono font-bold text-slate-900">{organColdIschemia}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Warm Ischemia Time</span>
                    <span className="font-mono font-bold text-slate-900">{organWarmIschemia}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Preservation Method</span>
                    <span className="font-semibold text-slate-800">{organPreservationMethod}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-500 font-medium">Status</span>
                    <Badge variant="outline" className="font-bold text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      {organStatus}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Donor Source Information */}
            <Card className="border border-slate-200/90 shadow-2xs bg-white rounded-xl">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between py-3.5 px-5">
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Donor Source Information
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-50">
                  Read-only Context
                </Badge>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-xs">
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Donor Code</span>
                    <span className="font-mono font-bold text-slate-900">{donorCode}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Donor Name</span>
                    <span className="font-bold text-slate-900">{organData?.donor_name || "Anonymous Donor"}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Blood Group</span>
                    <Badge variant="outline" className="font-mono font-bold text-[11px] bg-slate-50 text-slate-900">
                      {targetBloodGroup}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Hospital</span>
                    <span className="font-semibold text-slate-800">{targetHospital}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Viability Assessment Status */}
            <Card className="border border-slate-200/90 shadow-2xs bg-white rounded-xl">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between py-3.5 px-5">
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center">
                    3
                  </span>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Clinical Viability Evaluation
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-50">
                  Doctor Evaluation
                </Badge>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-xs">
                <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-2 text-blue-950">
                  <span className="font-bold block text-xs">Organ Viability Evaluation</span>
                  <p className="text-[11px] leading-relaxed text-blue-900/90">
                    Evaluate anatomical structure, ischemic exposure, preservation fluid clearance, and tissue viability for transplant offer.
                  </p>
                </div>
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Current Status</span>
                    <Badge variant="outline" className="font-bold text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      {currentStatusVal}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ─── CASE D: MATCH TARGET ────────────────────────────────────────── */}
        {entityType === "Match" && (
          <>
            {/* Section 1: Match Information */}
            <Card className="border border-slate-200/90 shadow-2xs bg-white rounded-xl">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between py-3.5 px-5">
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Match Information
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 border-purple-200">
                  <Lock className="h-3 w-3 mr-1 inline" /> Read-Only
                </Badge>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-xs">
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Match Code</span>
                    <span className="font-mono font-bold text-slate-900">{targetCode}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Compatibility Score</span>
                    <span className="font-mono font-bold text-emerald-600 text-sm">{matchScorePct ?? 0}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Rank</span>
                    <span className="font-mono font-bold text-slate-900">#{matchRank ?? 1}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Eligibility</span>
                    <Badge variant="outline" className="font-bold text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      {matchEligibility}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Blood Compatibility</span>
                    <span className="font-semibold text-emerald-600">{bloodCompLabel}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Medical Score</span>
                    <span className="font-mono font-bold text-slate-900">{medScore} / 30</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Tissue Score</span>
                    <span className="font-mono font-bold text-slate-900">{tissueScore} / 25</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-500 font-medium">Priority Score</span>
                    <span className="font-mono font-bold text-slate-900">{priorityScore} / 20</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Donor & Organ Context */}
            <Card className="border border-slate-200/90 shadow-2xs bg-white rounded-xl">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between py-3.5 px-5">
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Donor & Organ Context
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-50">
                  Read-only Context
                </Badge>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-xs">
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Donor Code</span>
                    <span className="font-mono font-bold text-slate-900">{donorCode}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Donor Name</span>
                    <span className="font-bold text-slate-900">{donorData?.name || (matchData as any)?.donor_name || "Anonymous Donor"}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Organ Type</span>
                    <span className="font-bold text-slate-900 uppercase">{organType}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Organ Code</span>
                    <span className="font-mono font-bold text-slate-900">{organData?.organ_code || (matchData as any)?.organ_code || "ORG"}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-500 font-medium">Blood Group</span>
                    <Badge variant="outline" className="font-mono font-bold text-[11px] bg-slate-50 text-slate-900">
                      {targetBloodGroup}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Candidate Recipient Context */}
            <Card className="border border-slate-200/90 shadow-2xs bg-white rounded-xl">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between py-3.5 px-5">
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                    3
                  </span>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Candidate Recipient Context
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-50">
                  Read-only Context
                </Badge>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-xs">
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Recipient Code</span>
                    <span className="font-mono font-bold text-slate-900">{recipientData?.recipient_code || (matchData as any)?.recipient_code || "REC"}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Recipient Name</span>
                    <span className="font-bold text-slate-900 capitalize">{recipientData?.name || (matchData as any)?.recipient_name || "Anonymous Patient"}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Urgency</span>
                    <Badge variant="outline" className="font-bold text-[10px] bg-rose-50 text-rose-700 border-rose-200">
                      {recipientData?.urgency || (matchData as any)?.recipient_urgency || "MODERATE"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Priority</span>
                    <Badge variant="outline" className="font-bold text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                      {recipientData?.priority || (matchData as any)?.recipient_priority || "MEDIUM"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-500 font-medium">Hospital</span>
                    <span className="font-semibold text-slate-800">{targetHospital}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

      </div>

      {/* ─── Form Completed Banner ────────────────────────────────────────── */}
      {isCompleted && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-950 shadow-2xs mb-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-emerald-900 block">Assessment Submitted</span>
              <span className="text-emerald-700 text-xs">
                This clinical assessment is complete and recorded in read-only mode.
              </span>
            </div>
          </div>
          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-[11px] px-3 py-1 shrink-0">
            {suitability || "COMPLETED"}
          </Badge>
        </div>
      )}

      {/* ─── Main Form: Sections 4, 5, 6, 7, 8 ─────────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 4: Clinical Suitability */}
        <Card className={`border rounded-xl shadow-2xs transition-all ${
          errors.suitability ? "border-rose-300 bg-rose-50/20" : "border-slate-200/90 bg-white"
        }`}>
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  4
                </span>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Clinical Suitability Evaluation
                </CardTitle>
              </div>
              <span className="text-rose-500 font-bold text-xs">* Required</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Provide your clinical evaluation of the target entity ({entityType}) for transplant clearance.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-2 space-y-3">
            <label className="text-xs font-bold text-slate-800 block">
              Suitability <span className="text-rose-500">*</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* APPROVED Option */}
              <button
                type="button"
                disabled={isCompleted || submitAssessment.isPending}
                onClick={() => {
                  if (!isCompleted && !submitAssessment.isPending) {
                    setSuitability("APPROVED");
                    setErrors((prev) => ({ ...prev, suitability: undefined }));
                  }
                }}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  isCompleted || submitAssessment.isPending ? "opacity-75 cursor-not-allowed" : ""
                } ${
                  suitability === "APPROVED"
                    ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 bg-white"
                }`}
              >
                <div className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                  suitability === "APPROVED"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-300 bg-white"
                }`}>
                  {suitability === "APPROVED" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <span className={`text-xs font-bold block ${
                    suitability === "APPROVED" ? "text-emerald-900" : "text-slate-900"
                  }`}>
                    APPROVED
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block leading-tight">
                    Medically suitable / Cleared for transplant
                  </span>
                </div>
              </button>

              {/* NOT APPROVED Option */}
              <button
                type="button"
                disabled={isCompleted || submitAssessment.isPending}
                onClick={() => {
                  if (!isCompleted && !submitAssessment.isPending) {
                    setSuitability("NOT_APPROVED");
                    setErrors((prev) => ({ ...prev, suitability: undefined }));
                  }
                }}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  isCompleted || submitAssessment.isPending ? "opacity-75 cursor-not-allowed" : ""
                } ${
                  suitability === "NOT_APPROVED"
                    ? "border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20 shadow-xs"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 bg-white"
                }`}
              >
                <div className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                  suitability === "NOT_APPROVED"
                    ? "border-rose-600 bg-rose-600 text-white"
                    : "border-slate-300 bg-white"
                }`}>
                  {suitability === "NOT_APPROVED" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <span className={`text-xs font-bold block ${
                    suitability === "NOT_APPROVED" ? "text-rose-900" : "text-slate-900"
                  }`}>
                    NOT APPROVED
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block leading-tight">
                    Medically unsuitable / Ineligible
                  </span>
                </div>
              </button>

              {/* NEEDS REVIEW Option */}
              <button
                type="button"
                disabled={isCompleted || submitAssessment.isPending}
                onClick={() => {
                  if (!isCompleted && !submitAssessment.isPending) {
                    setSuitability("NEEDS_REVIEW");
                    setErrors((prev) => ({ ...prev, suitability: undefined }));
                  }
                }}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  isCompleted || submitAssessment.isPending ? "opacity-75 cursor-not-allowed" : ""
                } ${
                  suitability === "NEEDS_REVIEW"
                    ? "border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20 shadow-xs"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 bg-white"
                }`}
              >
                <div className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                  suitability === "NEEDS_REVIEW"
                    ? "border-amber-600 bg-amber-600 text-white"
                    : "border-slate-300 bg-white"
                }`}>
                  {suitability === "NEEDS_REVIEW" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <span className={`text-xs font-bold block ${
                    suitability === "NEEDS_REVIEW" ? "text-amber-900" : "text-slate-900"
                  }`}>
                    NEEDS REVIEW
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block leading-tight">
                    Requires further clinical evaluation
                  </span>
                </div>
              </button>
            </div>

            {errors.suitability && (
              <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1.5 mt-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {errors.suitability}
              </p>
            )}
          </CardContent>
        </Card>

        {/* SECTION 5: Risk Assessment */}
        <Card className={`border rounded-xl shadow-2xs transition-all ${
          errors.riskLevel ? "border-rose-300 bg-rose-50/20" : "border-slate-200/90 bg-white"
        }`}>
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  5
                </span>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Risk Stratification
                </CardTitle>
              </div>
              <span className="text-rose-500 font-bold text-xs">* Required</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Evaluate the overall clinical risk profile.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-2 space-y-2">
            <label className="text-xs font-bold text-slate-800 block">
              Risk Level <span className="text-rose-500">*</span>
            </label>

            <Select
              value={riskLevel}
              disabled={isCompleted || submitAssessment.isPending}
              onValueChange={(val) => {
                if (!isCompleted && !submitAssessment.isPending) {
                  setRiskLevel(val as RiskLevelOption);
                  setErrors((prev) => ({ ...prev, riskLevel: undefined }));
                }
              }}
            >
              <SelectTrigger className={`h-10 text-xs bg-white border-slate-200 ${isCompleted ? 'opacity-80 cursor-not-allowed' : ''}`}>
                <SelectValue placeholder="Select Clinical Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">LOW — Standard clinical risk profile</SelectItem>
                <SelectItem value="MODERATE">MODERATE — Moderate risk with standard monitoring</SelectItem>
                <SelectItem value="HIGH">HIGH — High risk requiring intensive management</SelectItem>
                <SelectItem value="CRITICAL">CRITICAL — Critical risk with severe contraindications</SelectItem>
              </SelectContent>
            </Select>

            {riskLevel && RISK_DESCRIPTIONS[riskLevel] && (
              <p className="text-[11px] text-slate-600 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
                {RISK_DESCRIPTIONS[riskLevel]}
              </p>
            )}

            {errors.riskLevel && (
              <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1.5 mt-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {errors.riskLevel}
              </p>
            )}
          </CardContent>
        </Card>

        {/* SECTION 6: Assessment Decision */}
        <Card className="border border-slate-200/90 shadow-2xs bg-white rounded-xl">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  6
                </span>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Assessment Decision
                </CardTitle>
              </div>
              <span className="text-rose-500 font-bold text-xs">* Required</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Final clinical decision based on the above evaluation.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-2 space-y-3">
            <label className="text-xs font-bold text-slate-800 block">
              Final Clinical Decision <span className="text-rose-500">*</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* APPROVE Button */}
              <button
                type="button"
                disabled={isCompleted || submitAssessment.isPending}
                onClick={() => {
                  if (!isCompleted && !submitAssessment.isPending) {
                    setSuitability("APPROVED");
                    setErrors((prev) => ({ ...prev, suitability: undefined }));
                  }
                }}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                  isCompleted || submitAssessment.isPending ? "opacity-75 cursor-not-allowed" : ""
                } ${
                  suitability === "APPROVED"
                    ? "border-emerald-500 bg-emerald-50/80 text-emerald-950 ring-2 ring-emerald-500/20"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700 bg-white"
                }`}
              >
                <CheckCircle2 className={`h-4 w-4 shrink-0 ${
                  suitability === "APPROVED" ? "text-emerald-600" : "text-slate-400"
                }`} />
                <div>
                  <span className="font-bold text-xs block text-emerald-800">APPROVE</span>
                  <span className="text-[10px] text-slate-500 block">Candidate/entity is cleared</span>
                </div>
              </button>

              {/* NOT APPROVE Button */}
              <button
                type="button"
                disabled={isCompleted || submitAssessment.isPending}
                onClick={() => {
                  if (!isCompleted && !submitAssessment.isPending) {
                    setSuitability("NOT_APPROVED");
                    setErrors((prev) => ({ ...prev, suitability: undefined }));
                  }
                }}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                  isCompleted || submitAssessment.isPending ? "opacity-75 cursor-not-allowed" : ""
                } ${
                  suitability === "NOT_APPROVED"
                    ? "border-rose-500 bg-rose-50/80 text-rose-950 ring-2 ring-rose-500/20"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700 bg-white"
                }`}
              >
                <XCircle className={`h-4 w-4 shrink-0 ${
                  suitability === "NOT_APPROVED" ? "text-rose-600" : "text-slate-400"
                }`} />
                <div>
                  <span className="font-bold text-xs block text-rose-800">NOT APPROVE</span>
                  <span className="text-[10px] text-slate-500 block">Candidate/entity is ineligible</span>
                </div>
              </button>

              {/* NEEDS REVIEW Button */}
              <button
                type="button"
                disabled={isCompleted || submitAssessment.isPending}
                onClick={() => {
                  if (!isCompleted && !submitAssessment.isPending) {
                    setSuitability("NEEDS_REVIEW");
                    setErrors((prev) => ({ ...prev, suitability: undefined }));
                  }
                }}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                  isCompleted || submitAssessment.isPending ? "opacity-75 cursor-not-allowed" : ""
                } ${
                  suitability === "NEEDS_REVIEW"
                    ? "border-amber-500 bg-amber-50/80 text-amber-950 ring-2 ring-amber-500/20"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700 bg-white"
                }`}
              >
                <Clock className={`h-4 w-4 shrink-0 ${
                  suitability === "NEEDS_REVIEW" ? "text-amber-600" : "text-slate-400"
                }`} />
                <div>
                  <span className="font-bold text-xs block text-amber-800">NEEDS REVIEW</span>
                  <span className="text-[10px] text-slate-500 block">Requires additional evaluation</span>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* ─── Next Step Dynamic Guidance Banner ─────────────────────────────── */}
        {suitability && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs shadow-2xs ${
            suitability === "APPROVED"
              ? "bg-emerald-50/90 border-emerald-200 text-emerald-950"
              : suitability === "NOT_APPROVED"
              ? "bg-rose-50/90 border-rose-200 text-rose-950"
              : "bg-amber-50/90 border-amber-200 text-amber-950"
          }`}>
            {suitability === "APPROVED" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : suitability === "NOT_APPROVED" ? (
              <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <span className="font-bold block uppercase tracking-wide text-[11px]">
                Next Step
              </span>
              <p className="font-medium text-xs">
                {suitability === "APPROVED" && "Clinical sign-off recorded. Proceed to allocation workflow where applicable."}
                {suitability === "NOT_APPROVED" && "Record marked ineligible. Cannot proceed to allocation."}
                {suitability === "NEEDS_REVIEW" && "Additional clinical review required."}
              </p>
            </div>
          </div>
        )}

        {/* ─── Governance Notice Banner ──────────────────────────────────────── */}
        <div className="p-4 bg-amber-50/90 border border-amber-200/90 rounded-xl flex items-start gap-3 text-xs text-amber-950 shadow-2xs">
          <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Clinical assessment is an independent medical evaluation.</strong> Final organ allocation approval remains strictly with the national Allocation Authority.
          </p>
        </div>

        {/* ─── Action Buttons Bar ────────────────────────────────────────────── */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3 pb-8">
          {!isCompleted && (
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isCompleted || submitAssessment.isPending}
              className="w-full sm:w-auto h-10 px-5 text-xs font-semibold text-slate-700 border-slate-300 gap-2 shadow-2xs hover:bg-slate-50"
            >
              <Save className="h-4 w-4 text-slate-500" />
              Save as Draft
            </Button>
          )}

          {isCompleted ? (
            <Button
              type="button"
              disabled
              className="w-full sm:w-auto h-10 px-6 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 gap-2 cursor-not-allowed shadow-none"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Assessment Submitted
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={isCompleted || submitAssessment.isPending}
              className="w-full sm:w-auto h-10 px-6 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 gap-2 shadow-sm"
            >
              {submitAssessment.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Submitting Assessment...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Clinical Assessment
                </>
              )}
            </Button>
          )}
        </div>
      </form>

      {/* ─── Success Confirmation Modal ────────────────────────────────────── */}
      {successModalData && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative border border-slate-100 animate-in fade-in zoom-in-95 duration-200 text-center">
            {/* Close icon */}
            <button
              type="button"
              onClick={() => setSuccessModalData(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-full p-1 transition-colors focus:outline-hidden"
              aria-label="Close modal"
            >
              <XCircle className="h-5 w-5" />
            </button>

            {/* Success check icon */}
            <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200/60 shadow-xs">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 stroke-[2.5]" />
            </div>

            {/* Modal Title & Subtitle */}
            <h3 id="modal-title" className="text-lg font-extrabold text-slate-900 mb-1">
              Clinical Assessment Submitted
            </h3>
            <p className="text-xs text-slate-500 mb-5 font-medium">
              Your clinical assessment has been submitted successfully.
            </p>

            {/* Assessment Details Card */}
            <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-4 space-y-2.5 text-left mb-6 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Assessment ID</span>
                <span className="font-bold text-slate-900 font-mono">
                  {successModalData.review_code ||
                    successModalData.assessment_code ||
                    (successModalData.id
                      ? `CA-${(successModalData.created_at ? new Date(successModalData.created_at).toISOString().slice(0, 10).replace(/-/g, '') : new Date().toISOString().slice(0, 10).replace(/-/g, ''))}-${String(successModalData.id).slice(0, 4).toUpperCase()}`
                      : "CA-2026-0001")}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Target Type</span>
                <span className="font-bold text-slate-900">{successModalData.entity_type || entityType}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Target ID</span>
                <span className="font-bold text-slate-900 font-mono">
                  {successModalData.target_code || targetCode || String(successModalData.entity_id || assessmentId)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Decision</span>
                <span>
                  {(() => {
                    const dec = (successModalData.suitability || suitability || "APPROVED").toUpperCase();
                    if (dec === "APPROVED") {
                      return (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          APPROVE
                        </span>
                      );
                    } else if (dec === "NOT_APPROVED") {
                      return (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          NOT APPROVED
                        </span>
                      );
                    } else {
                      return (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          NEEDS REVIEW
                        </span>
                      );
                    }
                  })()}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Submitted On</span>
                <span className="font-medium text-slate-800">
                  {fmtDateTime(successModalData.reviewed_at || successModalData.created_at || new Date().toISOString())}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Submitted By</span>
                <span className="font-bold text-slate-900">
                  {successModalData.reviewer_username
                    ? (successModalData.reviewer_username.toLowerCase().startsWith("dr.") ? successModalData.reviewer_username : `Dr. ${successModalData.reviewer_username}`)
                    : (user?.full_name ? (user.full_name.toLowerCase().startsWith("dr.") ? user.full_name : `Dr. ${user.full_name}`) : (user?.username ? `Dr. ${user.username}` : "Dr. Doctor"))}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSuccessModalData(null)}
                className="flex-1 h-10 text-xs font-semibold text-slate-700 border-slate-300 gap-1.5 shadow-2xs hover:bg-slate-50"
              >
                <FileText className="h-4 w-4 text-slate-500" />
                View Assessment
              </Button>

              <Button
                type="button"
                onClick={() => navigate({ to: "/doctor/assessments" })}
                className="flex-1 h-10 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 gap-1.5 shadow-xs"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Assessments
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
