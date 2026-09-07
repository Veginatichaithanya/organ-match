import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  HeartHandshake,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
  Waves,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import { StatusBadge, fmtDateTime } from "@/components/ui-kit";
import type { DoctorHistoryItem } from "@/services/types";

export const Route = createFileRoute("/_authed/doctor/history/")({
  head: () => ({
    meta: [{ title: "Clinical Review History — OrganMatch" }],
  }),
  component: DoctorHistoryPage,
});

function DoctorHistoryPage() {
  const { user, ready } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [selectedReview, setSelectedReview] = useState<DoctorHistoryItem | null>(null);

  const {
    data: historyItems,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["doctor", "history"],
    queryFn: () => api.doctorListHistory(),
    enabled: ready && !!user,
    refetchInterval: 15000,
    placeholderData: keepPreviousData,
  });

  const filtered = useMemo(() => {
    return (historyItems ?? []).filter((h: DoctorHistoryItem) => {
      if (typeFilter !== "all" && h.entity_type !== typeFilter) return false;
      if (decisionFilter !== "all") {
        if (decisionFilter === "APPROVED" && h.decision !== "APPROVED") return false;
        if (decisionFilter === "NEEDS_REVIEW" && h.decision !== "NEEDS_REVIEW") return false;
        if (decisionFilter === "NOT_APPROVED" && h.decision !== "NOT_APPROVED") return false;
      }

      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        h.review_code?.toLowerCase().includes(q) ||
        h.target_code?.toLowerCase().includes(q) ||
        h.target_name?.toLowerCase().includes(q) ||
        h.entity_type?.toLowerCase().includes(q) ||
        h.decision?.toLowerCase().includes(q) ||
        h.risk_level?.toLowerCase().includes(q) ||
        h.reviewed_by?.toLowerCase().includes(q) ||
        (h.clinical_notes && h.clinical_notes.toLowerCase().includes(q))
      );
    });
  }, [historyItems, typeFilter, decisionFilter, search]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shadow-xs">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Clinical Review History</h1>
              <p className="text-sm text-slate-500 mt-0.5 font-normal">
                Review previously completed clinical evaluations, assessments, and recommendations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TelemetryRefreshButton
            label="Refresh History"
            onRefresh={() => refetch()}
            isFetching={isFetching}
          />
          <Link to="/doctor/assessments">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
              <Stethoscope className="h-4 w-4" />
              Clinical Assessments
            </Button>
          </Link>
          <Link to="/doctor/matches">
            <Button size="sm" className="gap-1.5 text-xs font-semibold shadow-2xs bg-blue-600 hover:bg-blue-700 text-white">
              Match Reviews <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search review ID, target code, patient name, doctor..."
            className="pl-9 bg-white text-xs h-9 border-slate-200 shadow-2xs"
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 bg-white text-xs h-9 border-slate-200 shadow-2xs">
            <SelectValue placeholder="Entity Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Donor">Donor</SelectItem>
            <SelectItem value="Recipient">Recipient</SelectItem>
            <SelectItem value="Organ">Organ</SelectItem>
            <SelectItem value="Match">Match</SelectItem>
          </SelectContent>
        </Select>

        <Select value={decisionFilter} onValueChange={setDecisionFilter}>
          <SelectTrigger className="w-40 bg-white text-xs h-9 border-slate-200 shadow-2xs">
            <SelectValue placeholder="Decision" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Decisions</SelectItem>
            <SelectItem value="APPROVED">Suitable / Approved</SelectItem>
            <SelectItem value="NEEDS_REVIEW">Needs Review</SelectItem>
            <SelectItem value="NOT_APPROVED">Not Suitable</SelectItem>
          </SelectContent>
        </Select>

        {(search || typeFilter !== "all" || decisionFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setTypeFilter("all");
              setDecisionFilter("all");
            }}
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* History Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                {["REVIEW ID", "TARGET ENTITY", "TYPE", "ORGAN", "BLOOD GROUP", "DECISION", "RISK LEVEL", "REVIEWER", "REVIEWED DATE", "ACTION"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-xs text-slate-400">
                    Loading clinical review history…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-xs text-rose-600 font-medium">
                    Failed to load review history from hospital backend.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-xs text-slate-400">
                    No historical clinical reviews recorded in your hospital scope.
                  </td>
                </tr>
              ) : (
                filtered.map((item: DoctorHistoryItem) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* REVIEW ID */}
                    <td className="px-5 py-3.5 whitespace-nowrap font-mono font-bold text-xs text-slate-900">
                      {item.review_code || item.id.slice(0, 8)}
                    </td>

                    {/* TARGET ENTITY */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-xs font-mono">
                          {item.target_code || item.entity_id.slice(0, 8)}
                        </span>
                        {item.target_name && item.target_name !== "—" && (
                          <span className="text-[11px] text-slate-500">{item.target_name}</span>
                        )}
                      </div>
                    </td>

                    {/* TYPE */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <Badge variant="outline" className="text-xs font-semibold bg-slate-50">
                        {item.entity_type}
                      </Badge>
                    </td>

                    {/* ORGAN */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-medium text-slate-800">
                      {item.organ}
                    </td>

                    {/* BLOOD GROUP */}
                    <td className="px-5 py-3.5 whitespace-nowrap font-mono text-xs font-bold text-slate-700">
                      {item.blood_group}
                    </td>

                    {/* DECISION */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <StatusBadge value={item.decision || item.suitability} />
                    </td>

                    {/* RISK LEVEL */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={
                          item.risk_level === "HIGH" || item.risk_level === "CRITICAL"
                            ? "bg-rose-50 text-rose-700 border-rose-200 text-xs font-bold"
                            : item.risk_level === "MEDIUM" || item.risk_level === "MODERATE"
                            ? "bg-amber-50 text-amber-700 border-amber-200 text-xs font-bold"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold"
                        }
                      >
                        {item.risk_level || "LOW"}
                      </Badge>
                    </td>

                    {/* REVIEWER */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-600 font-medium">
                      {item.reviewed_by}
                    </td>

                    {/* REVIEWED DATE */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500 font-mono">
                      {fmtDateTime(item.reviewed_at)}
                    </td>

                    {/* ACTION */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedReview(item)}
                        className="gap-1.5 text-xs font-semibold h-8 border-slate-200 text-slate-700 hover:bg-slate-100"
                      >
                        <Eye className="h-3.5 w-3.5 text-blue-600" />
                        Details
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Detail Modal */}
      {selectedReview && (
        <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <span>Clinical Review Details</span>
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">
                {selectedReview.review_code} • {selectedReview.entity_type} ({selectedReview.target_code})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                <div>
                  <span className="text-slate-500 font-medium block">Target Subject:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedReview.target_name} ({selectedReview.target_code})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Organ & Blood:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedReview.organ} • {selectedReview.blood_group}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Clinical Decision:</span>
                  <div className="mt-1">
                    <StatusBadge value={selectedReview.decision} />
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Assessed Risk:</span>
                  <span className="font-bold text-slate-900 mt-1 block">
                    {selectedReview.risk_level} RISK
                  </span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-900 block mb-1">Recommendation:</span>
                <p className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-slate-800 leading-relaxed">
                  {selectedReview.recommendation}
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-900 block mb-1">Clinical Notes & Observations:</span>
                <p className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-slate-700 leading-relaxed font-mono text-[11px]">
                  {selectedReview.clinical_notes}
                </p>
              </div>

              <div className="flex items-center justify-between text-slate-500 text-[11px] pt-2 border-t border-slate-100">
                <span>Evaluated by: <strong>{selectedReview.reviewed_by}</strong></span>
                <span>Date: {fmtDateTime(selectedReview.reviewed_at)}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
