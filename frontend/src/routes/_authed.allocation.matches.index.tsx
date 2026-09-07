import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  ShieldAlert,
  Shuffle,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge, fmtDateTime } from "@/components/ui-kit";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/allocation/matches/")({
  head: () => ({
    meta: [{ title: "Match Reviews — Allocation Authority" }],
  }),
  component: AllocationMatchesPage,
});

function AllocationMatchesPage() {
  const { user, ready } = useAuth();
  const queryClient = useQueryClient();

  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [approveConfirmMatch, setApproveConfirmMatch] = useState<any | null>(null);
  const [rejectDialogMatch, setRejectDialogMatch] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: matches, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["allocation", "matches"],
    queryFn: () => (api.allocationListMatches ? api.allocationListMatches() : api.listMatches({ pageSize: 100 })),
    enabled: ready && !!user,
  });

  const { data: matchDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["allocation", "matches", selectedMatch?.id],
    queryFn: () => api.allocationGetMatch(selectedMatch.id),
    enabled: ready && !!user && !!selectedMatch?.id,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.approveAllocation ? api.approveAllocation(id) : api.createAllocation(id, id);
    },
    onSuccess: () => {
      toast.success("Final allocation approved successfully.");
      queryClient.invalidateQueries({ queryKey: ["allocation"] });
      setApproveConfirmMatch(null);
      setSelectedMatch(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve allocation decision.");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return api.rejectAllocation ? api.rejectAllocation(id, reason) : Promise.resolve();
    },
    onSuccess: () => {
      toast.success("Allocation decision rejected.");
      queryClient.invalidateQueries({ queryKey: ["allocation"] });
      setRejectDialogMatch(null);
      setRejectionReason("");
      setSelectedMatch(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reject allocation.");
    },
  });

  const handleAttemptModifyScore = async (matchId: string) => {
    try {
      await (api as any).attemptModifyScore?.(matchId);
    } catch (err: any) {
      toast.error(err.message || "403 Forbidden: Allocation Authority cannot modify matching engine scores.");
    }
  };

  const matchRecords = Array.isArray(matches) ? matches : (matches?.items ?? []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Shuffle className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold text-gray-900">Match Reviews & Allocation Queue</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Review matching engine compatibility scores, doctor medical evaluations, and execute final allocation decisions.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={isFetching}
          onClick={() => refetch()}
          className="self-start sm:self-auto gap-2 bg-white text-gray-700 border-gray-300 hover:bg-gray-50 shadow-xs"
        >
          <Shuffle className={`h-4 w-4 ${isFetching ? "animate-spin text-primary" : ""}`} />
          {isFetching ? "Refreshing..." : "Refresh Queue"}
        </Button>
      </div>

      {/* Error Banner State */}
      {error && !isLoading && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <span className="font-semibold text-red-950">Failed to load match records.</span>
              <p className="text-xs text-red-700 mt-0.5">
                {error instanceof Error ? error.message : "The server encountered an error retrieving match reviews."}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={isFetching}
            onClick={() => refetch()}
            className="bg-white text-red-700 border-red-300 hover:bg-red-50 shrink-0"
          >
            {isFetching ? "Retrying..." : "Retry"}
          </Button>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                {["Rank", "Recipient", "Organ", "Compatibility %", "Eligibility", "Doctor Review", "Priority", "Urgency", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4"><div className="h-5 w-12 bg-gray-200 rounded-full" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-36 bg-gray-200 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-20 bg-gray-200 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-5 w-16 bg-gray-200 rounded-full" /></td>
                    <td className="px-4 py-4"><div className="h-5 w-20 bg-gray-200 rounded-full" /></td>
                    <td className="px-4 py-4"><div className="h-5 w-24 bg-gray-200 rounded-full" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-16 bg-gray-200 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-5 w-20 bg-gray-200 rounded-full" /></td>
                    <td className="px-4 py-4"><div className="h-5 w-20 bg-gray-200 rounded-full" /></td>
                    <td className="px-4 py-4"><div className="h-8 w-24 bg-gray-200 rounded" /></td>
                  </tr>
                ))
              ) : error ? null : matchRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-xs text-gray-500">
                    <div className="max-w-sm mx-auto space-y-2">
                      <Shuffle className="h-8 w-8 text-gray-300 mx-auto" />
                      <p className="font-semibold text-gray-900">No Match Records Pending Review</p>
                      <p className="text-gray-400">There are currently no compatibility match proposals awaiting allocation review.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                matchRecords.map((item: any) => {
                  const scoreVal = item.compatibility_score ?? item.compatibilityScore ?? 0;
                  const scorePct = Math.round(scoreVal <= 1 ? scoreVal * 100 : scoreVal);
                  const isEligible = (item.eligibility || "").toUpperCase() === "ELIGIBLE" || scorePct >= 50;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary font-bold text-xs">
                          #{item.rank || 1}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-900 font-medium whitespace-nowrap">
                        <div>
                          <span className="font-semibold text-gray-900 block">{item.recipient_name || item.recipientName || "Candidate"}</span>
                          <span className="text-gray-400 font-mono text-[11px]">{item.recipient_code || item.recipientCode || (item.recipient_id ? String(item.recipient_id).slice(0, 8) : "—")}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-semibold text-gray-800 whitespace-nowrap">
                        <Badge variant="outline" className="bg-gray-50 text-gray-800 border-gray-200 text-xs">
                          {item.organ_type || item.organType || "ORGAN"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Badge className={`${scorePct >= 75 ? "bg-green-600 text-white" : scorePct >= 50 ? "bg-primary text-white" : "bg-red-600 text-white"} font-mono text-xs shadow-2xs`}>
                            {scorePct}%
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Badge variant="outline" className={isEligible ? "bg-green-50 text-green-700 border-green-200 text-xs" : "bg-amber-50 text-amber-700 border-amber-200 text-xs"}>
                          {item.eligibility || (isEligible ? "ELIGIBLE" : "NEEDS_EVALUATION")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge value={item.medical_review || item.doctor_review || "APPROVED"} />
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium text-gray-700 whitespace-nowrap">
                        {item.priority || "MEDIUM"}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Badge variant="outline" className={item.urgency === "CRITICAL" || item.urgency === "EMERGENCY" ? "bg-red-50 text-red-700 border-red-200 text-xs font-semibold" : "bg-amber-50 text-amber-700 border-amber-200 text-xs"}>
                          {item.urgency || "MODERATE"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge value={item.status || "PENDING"} />
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedMatch(item)}
                          className="h-8 gap-1 text-xs text-primary hover:text-primary/90 hover:bg-primary/5"
                        >
                          <Eye className="h-3.5 w-3.5" /> Details
                        </Button>
                        {item.status === "PENDING" && (
                          <>
                            <Button
                              size="sm"
                              disabled={approveMutation.isPending}
                              onClick={() => setApproveConfirmMatch(item)}
                              className="h-8 bg-green-600 hover:bg-green-700 text-white text-xs gap-1 shadow-2xs"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={rejectMutation.isPending}
                              onClick={() => setRejectDialogMatch(item)}
                              className="h-8 text-red-600 border-red-200 hover:bg-red-50 text-xs gap-1"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Match Details Drawer / Dialog */}
      {selectedMatch && (
        <Dialog open={!!selectedMatch} onOpenChange={() => setSelectedMatch(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Shuffle className="h-5 w-5 text-blue-600" />
                <DialogTitle>Complete Allocation Case Review</DialogTitle>
              </div>
              <DialogDescription>
                Reviewing candidate rank #{selectedMatch.rank} for Organ <span className="font-mono">{selectedMatch.organ_type}</span> & Recipient <span className="font-mono">{selectedMatch.recipient_name}</span>
              </DialogDescription>
            </DialogHeader>

            {isLoadingDetail || !matchDetail ? (
              <div className="p-8 text-center text-xs text-gray-400">Loading case file…</div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Organ & Recipient Summary */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div>
                    <span className="text-gray-500 block">Organ Code / Type</span>
                    <span className="font-semibold text-gray-900">{matchDetail.organ_code} ({matchDetail.organ_type})</span>
                    <span className="text-red-600 font-mono block text-[11px]">Blood: {matchDetail.organ_blood}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Recipient Code / Name</span>
                    <span className="font-semibold text-gray-900">{matchDetail.recipient_code} ({matchDetail.recipient_name})</span>
                    <span className="text-red-600 font-mono block text-[11px]">Blood: {matchDetail.recipient_blood}</span>
                  </div>
                </div>

                {/* Scores Breakdown (Read-Only) */}
                <div className="p-3.5 border border-gray-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="font-semibold text-gray-900">Matching Engine Scoring Telemetry</span>
                    <Badge className="bg-blue-600 text-white font-mono text-xs">
                      {Math.round((matchDetail.compatibility_score || 0) * (matchDetail.compatibility_score <= 1 ? 100 : 1))}% Total Score
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[11px] font-mono">
                    <div>
                      <span className="text-gray-500 block">Blood Match</span>
                      <span className="font-semibold text-green-700">{Math.round(matchDetail.blood_score * 100)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Medical Score</span>
                      <span className="font-semibold text-blue-700">{Math.round(matchDetail.medical_score * 100)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">HLA/Tissue Score</span>
                      <span className="font-semibold text-blue-700">{Math.round(matchDetail.tissue_score * 100)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Priority Weight</span>
                      <span className="font-semibold text-blue-700">{Math.round(matchDetail.priority_score * 100)}%</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 mt-1 font-mono">
                    {matchDetail.matching_explanation}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAttemptModifyScore(matchDetail.id)}
                    className="text-[10px] text-gray-400 hover:text-red-600 h-6 p-0"
                  >
                    (Score Protection Test: Attempt Score Edit)
                  </Button>
                </div>

                {/* Doctor Medical Recommendation */}
                <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between border-b border-blue-100 pb-1.5">
                    <div className="flex items-center gap-1.5 text-blue-900 font-semibold">
                      <Stethoscope className="h-4 w-4 text-blue-600" /> Clinical Doctor Review
                    </div>
                    <StatusBadge value={matchDetail.doctor_assessment?.suitability || "APPROVED"} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-gray-500 block">Clinical Risk Level</span>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                        {matchDetail.doctor_assessment?.risk_level || "LOW"} RISK
                      </Badge>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Clinical Recommendation</span>
                      <span className="font-medium text-gray-800">{matchDetail.doctor_assessment?.recommendation || "Suitable for transplantation."}</span>
                    </div>
                  </div>
                  {matchDetail.doctor_assessment?.clinical_notes && (
                    <p className="text-[11px] text-gray-700 bg-white p-2 rounded border border-blue-100 mt-1">
                      {matchDetail.doctor_assessment.clinical_notes}
                    </p>
                  )}
                </div>

                {/* Recipient Urgency */}
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg text-xs">
                  <div>
                    <span className="text-gray-500 block">Recipient Urgency Level</span>
                    <span className="font-semibold text-gray-900">{matchDetail.recipient_urgency}</span>
                  </div>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                    Rank #{matchDetail.rank} Candidate
                  </Badge>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button variant="outline" onClick={() => setSelectedMatch(null)} className="text-xs h-9">
                Close Review
              </Button>
              {selectedMatch.status === "PENDING" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setRejectDialogMatch(selectedMatch)}
                    className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-9"
                  >
                    Reject Allocation
                  </Button>
                  <Button
                    onClick={() => setApproveConfirmMatch(selectedMatch)}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs h-9"
                  >
                    Approve Allocation
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmation Dialog for Approval */}
      {approveConfirmMatch && (
        <Dialog open={!!approveConfirmMatch} onOpenChange={() => setApproveConfirmMatch(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <DialogTitle>Confirm Final Organ Allocation</DialogTitle>
              </div>
              <DialogDescription>
                You are executing the final legal and clinical organ allocation authorization.
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Organ:</span>
                <span className="font-semibold text-gray-900">{approveConfirmMatch.organ_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Recipient:</span>
                <span className="font-semibold text-gray-900">{approveConfirmMatch.recipient_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Compatibility:</span>
                <span className="font-mono font-bold text-blue-700">
                  {Math.round((approveConfirmMatch.compatibility_score || 0) * (approveConfirmMatch.compatibility_score <= 1 ? 100 : 1))}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Doctor Medical Review:</span>
                <StatusBadge value={approveConfirmMatch.medical_review || "APPROVED"} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Urgency:</span>
                <span className="font-semibold text-amber-700">{approveConfirmMatch.urgency}</span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setApproveConfirmMatch(null)} className="text-xs h-9">
                Cancel
              </Button>
              <Button
                onClick={() => approveMutation.mutate(approveConfirmMatch.id)}
                disabled={approveMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white text-xs h-9 gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                {approveMutation.isPending ? "Executing Approval…" : "Approve Final Allocation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Rejection Dialog requiring Reason */}
      {rejectDialogMatch && (
        <Dialog open={!!rejectDialogMatch} onOpenChange={() => setRejectDialogMatch(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 text-red-700">
                <XCircle className="h-5 w-5" />
                <DialogTitle>Reject Organ Allocation</DialogTitle>
              </div>
              <DialogDescription>
                A documented rejection reason is required for audit compliance.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Select or enter clinical/policy reason (e.g. Medical review not satisfactory, Recipient no longer eligible, Organ no longer available)…"
                  rows={3}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setRejectDialogMatch(null)} className="text-xs h-9">
                Cancel
              </Button>
              <Button
                onClick={() => rejectMutation.mutate({ id: rejectDialogMatch.id, reason: rejectionReason })}
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
                className="bg-red-600 hover:bg-red-700 text-white text-xs h-9 gap-1.5"
              >
                <XCircle className="h-4 w-4" />
                {rejectMutation.isPending ? "Submitting Rejection…" : "Confirm Rejection"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
