import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, AlertTriangle, HeartHandshake, Info, Shuffle, X, Award, Calendar, Activity } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, StatusBadge } from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/coordinator/matching/")({
  head: () => ({
    meta: [
      { title: "Matching Console — OrganMatch Coordinator" },
      { name: "description", content: "Run clinical compatibility scoring for available hospital organs." },
    ],
  }),
  component: CoordinatorMatchingPage,
});

const COMPONENT_MAX = { blood: 25, medical: 30, tissue: 25, priority: 20 } as const;
const COMPONENT_LABELS = {
  blood: "Blood compatibility",
  medical: "Medical suitability",
  tissue: "HLA Tissue typing",
  priority: "Priority & waitlist position",
} as const;

function ScoreBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {(Object.keys(COMPONENT_MAX) as Array<keyof typeof COMPONENT_MAX>).map((k) => {
        const value = breakdown[k] ?? 0;
        const max = COMPONENT_MAX[k];
        const pct = Math.min(100, Math.max(0, (value / max) * 100));
        return (
          <div key={k} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
              <span>{COMPONENT_LABELS[k]}</span>
              <span className="font-semibold text-gray-900">
                {value} / {max}
              </span>
            </div>
            <Progress value={pct} className="h-1.5 bg-gray-200" />
          </div>
        );
      })}
    </div>
  );
}

function EligibleMatchCard({ match, isBestMatch }: { match: any; isBestMatch: boolean }) {
  const score = Math.round(match.compatibility_score ?? 0);
  const rec = match.recipient || {};
  const recIdStr = match.recipient_id ? String(match.recipient_id).slice(0, 8) : "—";
  const recCode = rec.recipient_code || recIdStr;
  const recName = rec.name || `Recipient ${recCode}`;

  return (
    <Card className={`shadow-xs transition-all bg-white ${isBestMatch ? "border-emerald-300 ring-1 ring-emerald-500/20 shadow-md" : "border-gray-200 hover:border-gray-300"}`}>
      <CardHeader className={`flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3 border-b ${isBestMatch ? "bg-emerald-50/30 border-emerald-100" : "border-gray-100"}`}>
        <div className="flex items-center gap-3">
          {isBestMatch ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white font-bold shadow-xs">
              <Award className="h-5 w-5" />
            </div>
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold bg-primary/10 text-primary">
              #{match.rank || "—"}
            </span>
          )}
          <div>
            <div className="flex items-center gap-2">
              {isBestMatch && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  RANK #1
                </span>
              )}
              <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <span>{recName}</span>
                <span className="font-mono text-xs font-normal text-gray-400">(Recipient ID: {recCode})</span>
              </CardTitle>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
              <span>Blood: <strong className="text-gray-700">{rec.blood_group || "—"}</strong></span>
              <span>·</span>
              {rec.age !== undefined && <span>Age: <strong className="text-gray-700">{rec.age}</strong> ·</span>}
              <span>Urgency: <strong className="text-gray-700">{rec.urgency || "—"}</strong></span>
              <span>·</span>
              <span>Priority: <strong className="text-gray-700">{rec.priority || "—"}</strong></span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge value="ELIGIBLE" />
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${score >= 75 ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-blue-100 text-blue-800 border border-blue-200"}`}>
            {score}% Match Score
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Score Breakdown Bars */}
        {match.scoring_breakdown && <ScoreBreakdown breakdown={match.scoring_breakdown} />}

        {/* Clinical & Allocation Status Flow */}
        <div className="grid sm:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs">
          <div>
            <span className="text-gray-400 uppercase font-semibold text-[10px] block mb-0.5">Clinical Review</span>
            <span className="font-semibold text-amber-800 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              PENDING
            </span>
          </div>
          <div>
            <span className="text-gray-400 uppercase font-semibold text-[10px] block mb-0.5">Allocation Status</span>
            <span className="font-semibold text-blue-900">Requires Allocation Authority Approval</span>
          </div>
        </div>

        {/* Actions & Authority Notice */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5 text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/60">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            Final organ offer requires Allocation Authority approval.
          </span>

          <Link to="/coordinator/recipients/$recipientId" params={{ recipientId: match.recipient_id }}>
            <Button size="sm" variant="outline" className="h-8 text-xs font-medium border-gray-300 hover:bg-gray-50">
              View Recipient Dossier
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function IneligibleMatchCard({ match }: { match: any }) {
  const rec = match.recipient || {};
  const recIdStr = match.recipient_id ? String(match.recipient_id).slice(0, 8) : "—";
  const recCode = rec.recipient_code || recIdStr;
  const recName = rec.name || `Recipient ${recCode}`;
  const reason = match.ineligibility_reason || match.scoring_breakdown?.reason || "Blood group or organ-specific eligibility criteria failed.";

  return (
    <Card className="shadow-xs border-red-200 bg-white">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3 border-b border-red-100 bg-red-50/20">
        <div className="flex items-center gap-3">
          <span className="flex px-2.5 py-1 items-center justify-center rounded-md bg-red-100 text-red-800 text-xs font-bold uppercase tracking-wider border border-red-200">
            NOT RANKED
          </span>
          <div>
            <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <span>{recName}</span>
              <span className="font-mono text-xs font-normal text-gray-400">(Recipient ID: {recCode})</span>
            </CardTitle>
            <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
              <span>Blood: <strong className="text-gray-700">{rec.blood_group || "—"}</strong></span>
              <span>·</span>
              {rec.age !== undefined && <span>Age: <strong className="text-gray-700">{rec.age}</strong> ·</span>}
              <span>Urgency: <strong className="text-gray-700">{rec.urgency || "—"}</strong></span>
              <span>·</span>
              <span>Priority: <strong className="text-gray-700">{rec.priority || "—"}</strong></span>
            </p>
          </div>
        </div>
        <StatusBadge value="INELIGIBLE" />
      </CardHeader>

      <CardContent className="pt-3 space-y-3">
        <div className="p-3 bg-red-50 rounded-md border border-red-200/80 text-xs">
          <span className="font-semibold text-red-950 block mb-1 flex items-center gap-1.5">
            <X className="h-3.5 w-3.5 text-red-600 shrink-0" />
            Reason for Ineligibility
          </span>
          <p className="text-red-900 leading-relaxed">{reason}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CoordinatorMatchingPage() {
  const { user, ready } = useAuth();
  const [organId, setOrganId] = useState("");
  const [results, setResults] = useState<any[] | null>(null);

  // Load available organs to match
  const { data: organsData, isLoading: organsLoading } = useQuery({
    queryKey: ["organs", "matchable"],
    queryFn: () => (api.organs ? api.organs({ pageSize: 100 }) : api.listOrgans?.({ pageSize: 100 })),
    enabled: ready && !!user,
  });

  const organs = organsData?.items ?? [];
  const selectedOrgan = organs.find((o: any) => o.id === organId || o.organCode === organId || o.organ_code === organId) || organs[0];

  // Auto-select first organ if none selected
  useEffect(() => {
    if (!organId && organs.length > 0) {
      setOrganId(organs[0].id);
    }
  }, [organId, organs]);

  const runMutation = useMutation({
    mutationFn: (id: string) => (api.runMatching ? api.runMatching(id) : api.coordinatorRunMatching(id)),
    onSuccess: (res) => {
      setResults(res);
      if (!res || res.length === 0) {
        toast.info("No recipients evaluated on waitlist.");
      } else {
        const eligibleCount = res.filter((m: any) => m.status === "PENDING" || (m.compatibility_score ?? 0) >= 50).length;
        toast.success(`Matching complete! ${res.length} candidates evaluated (${eligibleCount} eligible).`);
      }
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail || err?.message;
      const msg = detail
        ? (typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ") : JSON.stringify(detail))
        : "The matching service encountered an unexpected error. Please retry.";
      toast.error(msg);
    },
  });

  // Calculate results metrics
  const eligibleMatches = results ? results.filter((m: any) => m.status === "PENDING" || (m.compatibility_score ?? 0) >= 50) : [];
  const ineligibleMatches = results ? results.filter((m: any) => m.status !== "PENDING" && (m.compatibility_score ?? 0) < 50) : [];
  const bestMatchScore = eligibleMatches.length > 0 ? Math.round(eligibleMatches[0].compatibility_score ?? 0) : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Compatibility Matching Console</h1>
        <p className="text-sm text-gray-500 mt-1">
          Run clinical compatibility algorithms matching hospital organs against waitlist candidates.
        </p>
      </div>

      {/* Role Responsibility Card */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900 flex items-start gap-3 shadow-xs">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-blue-950">Coordinator Matching Authority:</span> As a Hospital Coordinator, you can run compatibility scoring and review ranked candidates. Final organ offer approval requires Allocation Authority authorization.
        </div>
      </div>

      {/* Organ Selector Card */}
      <Card className="shadow-xs border-gray-200">
        <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50">
          <CardTitle className="text-sm font-semibold text-gray-900 flex items-center justify-between">
            <span>Select Available Organ</span>
            {selectedOrgan && (
              <span className="text-xs font-mono font-normal text-gray-500">
                Organ Ref: {selectedOrgan.organCode || selectedOrgan.organ_code || selectedOrgan.id.slice(0, 8)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-12 items-center">
            <div className="md:col-span-8 space-y-2">
              <Select value={organId} onValueChange={setOrganId}>
                <SelectTrigger className="w-full h-11 text-sm bg-white">
                  <SelectValue placeholder={organsLoading ? "Loading inventory…" : "Select harvested organ…"} />
                </SelectTrigger>
                <SelectContent>
                  {organs.map((o: any) => {
                    const dName = o.donorName || o.donor?.name;
                    const dCode = o.donorCode || o.donor?.donor_code || (o.donor_id ? `DNR-${String(o.donor_id).slice(0, 8)}` : "");
                    const oCode = o.organCode || o.organ_code || o.id.slice(0, 8);
                    const oType = o.organType || o.organ_type;
                    const bg = o.bloodGroup || o.blood_group;
                    const lat = o.laterality || o.medical_details?.laterality;
                    const st = o.availability || o.status;

                    return (
                      <SelectItem key={o.id} value={o.id}>
                        {oType} · {bg} — Ref: {oCode}
                        {dName ? ` · Donor: ${dName}` : dCode ? ` · Donor: ${dCode}` : ""}
                        {lat ? ` · ${lat}` : ""}
                        {` [${st}]`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Selected Organ Rich Summary Card */}
              {selectedOrgan && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200/80 space-y-3 text-xs text-gray-700">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/60 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                        <HeartHandshake className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-gray-900">
                            {selectedOrgan.organType || selectedOrgan.organ_type}
                          </h3>
                          <span className="text-xs font-mono bg-white text-gray-800 font-semibold px-2 py-0.5 rounded border border-gray-200">
                            Blood Group: {selectedOrgan.bloodGroup || selectedOrgan.blood_group}
                          </span>
                          {(selectedOrgan.laterality || selectedOrgan.medical_details?.laterality) && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                              Laterality: {selectedOrgan.laterality || selectedOrgan.medical_details?.laterality}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">
                          Organ Code: <strong className="text-gray-800">{selectedOrgan.organCode || selectedOrgan.organ_code || selectedOrgan.id}</strong>
                        </p>
                      </div>
                    </div>
                    <StatusBadge value={selectedOrgan.availability || selectedOrgan.status} />
                  </div>

                  {/* Detailed Grid: Donor, Organ Code, Laterality, Harvest Time, Ischemia */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-semibold block mb-0.5">Donor Name</span>
                      <span className="font-bold text-gray-900 block truncate">
                        {(selectedOrgan.donorName || selectedOrgan.donor?.name) ? (selectedOrgan.donorName || selectedOrgan.donor?.name) : "Not specified"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-semibold block mb-0.5">Donor ID / Code</span>
                      <span className="font-mono font-semibold text-gray-800 block">
                        {selectedOrgan.donorCode || selectedOrgan.donor?.donor_code || (selectedOrgan.donor_id ? `DNR-${String(selectedOrgan.donor_id).slice(0, 8)}` : "—")}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-semibold block mb-0.5">Harvest Date / Time</span>
                      <span className="font-semibold text-gray-800 block">
                        {selectedOrgan.harvestedAt || selectedOrgan.medical_details?.harvested_at ? (
                          new Date(selectedOrgan.harvestedAt || selectedOrgan.medical_details?.harvested_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short"
                          })
                        ) : "Not specified"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-semibold block mb-0.5">Cold / Warm Ischemia</span>
                      <span className="font-semibold text-gray-800 block">
                        {(selectedOrgan.coldIschemiaTime || selectedOrgan.medical_details?.cold_ischemia_time) ? (
                          `Cold: ${selectedOrgan.coldIschemiaTime || selectedOrgan.medical_details?.cold_ischemia_time}`
                        ) : (selectedOrgan.warmIschemiaMinutes || selectedOrgan.medical_details?.warm_ischemia_minutes) ? (
                          `Warm: ${selectedOrgan.warmIschemiaMinutes || selectedOrgan.medical_details?.warm_ischemia_minutes}m`
                        ) : "Standard Clinical Protocol"}
                      </span>
                    </div>
                  </div>

                  {/* Preservation Method & Clinical Notes */}
                  {(selectedOrgan.preservationMethod || selectedOrgan.medical_details?.preservation_method || selectedOrgan.clinicalNotes || selectedOrgan.medical_details?.notes) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-gray-200/60 text-[11px] text-gray-600">
                      {(selectedOrgan.preservationMethod || selectedOrgan.medical_details?.preservation_method) && (
                        <span>
                          Preservation: <strong className="text-gray-800">{selectedOrgan.preservationMethod || selectedOrgan.medical_details?.preservation_method}</strong>
                        </span>
                      )}
                      {(selectedOrgan.clinicalNotes || selectedOrgan.medical_details?.notes) && (
                        <span>
                          Notes: <span className="italic text-gray-700">{selectedOrgan.clinicalNotes || selectedOrgan.medical_details?.notes}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="md:col-span-4 flex items-center justify-end">
              <Button
                disabled={!organId || runMutation.isPending}
                onClick={() => runMutation.mutate(organId)}
                className="w-full md:w-auto h-11 px-6 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-medium shadow-xs transition-all"
              >
                <Shuffle className={`h-4 w-4 ${runMutation.isPending ? "animate-spin" : ""}`} />
                {runMutation.isPending ? "Running Match Engine..." : "Execute Match Engine"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress / Result Rendering */}
      {runMutation.isPending ? (
        <Card className="p-8 text-center border border-blue-100 bg-gradient-to-b from-blue-50/30 to-white shadow-xs">
          <div className="max-w-md mx-auto space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <Shuffle className="h-6 w-6 animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Analyzing Compatibility</h3>
              <p className="text-xs text-gray-500 mt-1">Evaluating clinical parameters and waitlist priority...</p>
            </div>
            <div className="space-y-2 text-left bg-white p-4 rounded-lg border border-gray-200 text-xs font-mono text-gray-600">
              <div className="flex items-center gap-2 text-green-700">
                <Check className="h-3.5 w-3.5 text-green-600" />
                <span>Organ & blood compatibility checks</span>
              </div>
              <div className="flex items-center gap-2 text-green-700">
                <Check className="h-3.5 w-3.5 text-green-600" />
                <span>Medical suitability scoring</span>
              </div>
              <div className="flex items-center gap-2 text-blue-700 font-semibold animate-pulse">
                <Shuffle className="h-3.5 w-3.5 animate-spin" />
                <span>Evaluating recipient waitlist candidates</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <span className="h-3.5 w-3.5 inline-block text-center">○</span>
                <span>Computing final weighted rankings</span>
              </div>
            </div>
          </div>
        </Card>
      ) : runMutation.isError ? (
        <Card className="p-6 border-red-200 bg-red-50/50 shadow-xs">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-red-900">Unable to run compatibility matching</h3>
                <p className="text-xs text-red-700 mt-0.5">
                  {runMutation.error instanceof Error ? runMutation.error.message : "The matching service encountered an unexpected error."}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runMutation.mutate(organId)}
              className="bg-white text-red-700 border-red-200 hover:bg-red-50 shrink-0"
            >
              Retry Matching
            </Button>
          </div>
        </Card>
      ) : results === null ? (
        <EmptyState
          title="Matching Engine Idle"
          description="Select an available harvested organ above and click execute to view candidate rankings."
        />
      ) : results.length === 0 ? (
        <EmptyState
          title="No Candidates Evaluated"
          description="No active patients on the waitlist match the criteria for your hospital at this time."
        />
      ) : (
        <div className="space-y-6">
          {/* Results Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200/80 text-sm">
            <div>
              <span className="text-[11px] text-gray-500 block uppercase font-bold tracking-wider">Recipients Evaluated</span>
              <span className="text-xl font-bold text-gray-900 mt-0.5 block">{results.length}</span>
            </div>
            <div>
              <span className="text-[11px] text-gray-500 block uppercase font-bold tracking-wider">Eligible</span>
              <span className="text-xl font-bold text-emerald-700 mt-0.5 block">{eligibleMatches.length}</span>
            </div>
            <div>
              <span className="text-[11px] text-gray-500 block uppercase font-bold tracking-wider">Ineligible</span>
              <span className="text-xl font-bold text-red-600 mt-0.5 block">{ineligibleMatches.length}</span>
            </div>
            <div>
              <span className="text-[11px] text-gray-500 block uppercase font-bold tracking-wider">Best Match Score</span>
              <span className="text-xl font-bold text-primary mt-0.5 block">
                {bestMatchScore !== null ? `${bestMatchScore}%` : "N/A"}
              </span>
            </div>
          </div>

          {/* Eligible Candidates Section */}
          {eligibleMatches.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" /> Best Eligible Match
              </h3>

              <EligibleMatchCard match={eligibleMatches[0]} isBestMatch={true} />

              {eligibleMatches.length > 1 && (
                <div className="space-y-4 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Other Eligible Matches ({eligibleMatches.length - 1})
                  </h4>
                  {eligibleMatches.slice(1).map((m: any) => (
                    <EligibleMatchCard key={m.id} match={m} isBestMatch={false} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Ineligible Candidates Section */}
          {ineligibleMatches.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                <X className="h-4 w-4 text-red-600" /> Ineligible Candidates ({ineligibleMatches.length})
              </h3>
              {ineligibleMatches.map((m: any) => (
                <IneligibleMatchCard key={m.id} match={m} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
