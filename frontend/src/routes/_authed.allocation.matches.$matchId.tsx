import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
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
import { StatusBadge, fmtDateTime } from "@/components/ui-kit";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/allocation/matches/$matchId")({
  head: () => ({
    meta: [{ title: "Match Detail Review — Allocation Authority" }],
  }),
  component: AllocationMatchDetailPage,
});

function AllocationMatchDetailPage() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, ready } = useAuth();

  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const { data: match, isLoading, error } = useQuery({
    queryKey: ["allocation", "matches", matchId],
    queryFn: () => api.allocationGetMatch(matchId),
    enabled: ready && !!user && !!matchId,
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      return api.approveAllocation(matchId);
    },
    onSuccess: () => {
      toast.success("Final allocation approved.");
      queryClient.invalidateQueries({ queryKey: ["allocation"] });
      navigate({ to: "/allocation/matches" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve allocation.");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      return api.rejectAllocation(matchId, rejectionReason);
    },
    onSuccess: () => {
      toast.success("Allocation rejected.");
      queryClient.invalidateQueries({ queryKey: ["allocation"] });
      navigate({ to: "/allocation/matches" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reject allocation.");
    },
  });

  if (isLoading) {
    return <div className="p-12 text-center text-sm text-gray-500">Loading case details…</div>;
  }

  if (error || !match) {
    return <div className="p-12 text-center text-sm text-red-600">Match file not found.</div>;
  }

  const scorePct = Math.round(
    (match.compatibility_score || 0) * (match.compatibility_score <= 1 ? 100 : 1)
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/allocation/matches" })}
            className="gap-1 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Match Reviews
          </Button>
          <div className="h-4 w-px bg-gray-300" />
          <div className="flex items-center gap-2">
            <Shuffle className="h-5 w-5 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">
              Match Proposal: <span className="font-mono">{matchId.slice(0, 8)}</span>
            </h1>
            <Badge className="bg-blue-600 text-white font-mono text-xs">{scorePct}% Score</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Case File Overview */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b border-gray-100 pb-2">
            Case Parameters & Telemetry
          </h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-500 block">Organ Code</span>
              <span className="font-semibold text-gray-900">{match.organ_code} ({match.organ_type})</span>
            </div>
            <div>
              <span className="text-gray-500 block">Recipient Code</span>
              <span className="font-semibold text-gray-900">{match.recipient_code} ({match.recipient_name})</span>
            </div>
            <div>
              <span className="text-gray-500 block">Rank Position</span>
              <span className="font-mono font-bold text-blue-700">Rank #{match.rank}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Current Status</span>
              <StatusBadge value={match.status} />
            </div>
          </div>
          <div className="pt-2 border-t border-gray-100 text-xs">
            <span className="text-gray-500 block mb-1 font-medium">Algorithmic Explanation</span>
            <p className="bg-gray-50 p-2.5 rounded border border-gray-100 font-mono text-gray-700">
              {match.matching_explanation}
            </p>
          </div>
        </div>

        {/* Clinical Doctor Evaluation */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b border-gray-100 pb-2 flex items-center justify-between">
            <span>Doctor Medical Review</span>
            <StatusBadge value={match.doctor_assessment?.suitability || "APPROVED"} />
          </h2>
          <div className="text-xs space-y-2">
            <div>
              <span className="text-gray-500 block">Clinical Risk</span>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {match.doctor_assessment?.risk_level || "LOW"} RISK
              </Badge>
            </div>
            <div>
              <span className="text-gray-500 block">Recommendation</span>
              <p className="font-medium text-gray-800">{match.doctor_assessment?.recommendation || "Suitable for transplantation."}</p>
            </div>
            {match.doctor_assessment?.clinical_notes && (
              <div>
                <span className="text-gray-500 block">Notes</span>
                <p className="bg-gray-50 p-2 rounded border border-gray-100 text-gray-700">
                  {match.doctor_assessment.clinical_notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
