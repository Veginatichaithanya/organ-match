import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Eye,
  FileEdit,
  FileText,
  Filter,
  HeartHandshake,
  Search,
  ShieldAlert,
  Stethoscope,
  Users,
  Waves,
  Sparkles,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import { StatusBadge, fmtDateTime } from "@/components/ui-kit";
import type { AssessmentTarget } from "@/services/types";

export const Route = createFileRoute("/_authed/doctor/assessments/")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || "all",
  }),
  head: () => ({
    meta: [{ title: "Clinical Assessments — OrganMatch" }],
  }),
  component: DoctorClinicalAssessmentsPage,
});

function DoctorClinicalAssessmentsPage() {
  const { user, ready } = useAuth();
  const searchParams = useSearch({ from: "/_authed/doctor/assessments/" });
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<string>(searchParams.tab || "all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (searchParams.tab) {
      setActiveTab(searchParams.tab);
    }
  }, [searchParams.tab]);

  const {
    data: targets,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["doctor", "targets"],
    queryFn: () => api.doctorListTargets(),
    enabled: ready && !!user,
    refetchInterval: 15000,
    placeholderData: keepPreviousData,
  });

  const filteredTargets = useMemo(() => {
    return (targets ?? []).filter((item: AssessmentTarget) => {
      // Tab filter
      if (activeTab === "donors" && item.type !== "Donor") return false;
      if (activeTab === "recipients" && item.type !== "Recipient") return false;
      if (activeTab === "organs" && item.type !== "Organ") return false;
      if (activeTab === "completed" && item.status === "PENDING") return false;

      // Dropdown type filter
      if (typeFilter !== "all" && item.type !== typeFilter) return false;

      // Priority filter
      if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;

      // Risk level filter
      if (riskFilter !== "all") {
        if (!item.risk_level || item.risk_level !== riskFilter) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "PENDING" && item.status !== "PENDING") return false;
        if (statusFilter === "APPROVED" && item.status !== "APPROVED") return false;
        if (statusFilter === "NEEDS_REVIEW" && item.status !== "NEEDS_REVIEW") return false;
        if (statusFilter === "NOT_APPROVED" && item.status !== "NOT_APPROVED") return false;
      }

      // Search query
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.organ.toLowerCase().includes(q) ||
        item.blood_group.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q) ||
        (item.clinical_notes && item.clinical_notes.toLowerCase().includes(q))
      );
    });
  }, [targets, activeTab, typeFilter, priorityFilter, riskFilter, statusFilter, search]);

  const counts = useMemo(() => {
    const list = targets ?? [];
    return {
      all: list.length,
      donors: list.filter((t) => t.type === "Donor").length,
      recipients: list.filter((t) => t.type === "Recipient").length,
      organs: list.filter((t) => t.type === "Organ").length,
      completed: list.filter((t) => t.status !== "PENDING").length,
    };
  }, [targets]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center shadow-xs">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Clinical Assessments</h1>
              <p className="text-sm text-slate-500 mt-0.5 font-normal">
                Evaluate donor, recipient, and organ clinical suitability within your hospital scope.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TelemetryRefreshButton
            label="Refresh Targets"
            onRefresh={() => refetch()}
            isFetching={isFetching}
          />
          <Link to="/doctor/history">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
              <Clock className="h-4 w-4 text-slate-500" />
              Review History
            </Button>
          </Link>
          <Link to="/doctor/matches">
            <Button size="sm" className="gap-1.5 text-xs font-semibold shadow-2xs bg-blue-600 hover:bg-blue-700 text-white">
              Match Reviews <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="bg-slate-100/90 p-1 border border-slate-200/80 rounded-xl">
            <TabsTrigger value="all" className="text-xs font-semibold gap-1.5 px-3 py-1.5">
              All <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{counts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="donors" className="text-xs font-semibold gap-1.5 px-3 py-1.5">
              Donors <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{counts.donors}</Badge>
            </TabsTrigger>
            <TabsTrigger value="recipients" className="text-xs font-semibold gap-1.5 px-3 py-1.5">
              Recipients <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{counts.recipients}</Badge>
            </TabsTrigger>
            <TabsTrigger value="organs" className="text-xs font-semibold gap-1.5 px-3 py-1.5">
              Organs <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{counts.organs}</Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs font-semibold gap-1.5 px-3 py-1.5">
              Completed <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{counts.completed}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, name, blood group, organ..."
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
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36 bg-white text-xs h-9 border-slate-200 shadow-2xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="HIGH">High Priority</SelectItem>
            <SelectItem value="MEDIUM">Medium Priority</SelectItem>
            <SelectItem value="LOW">Low Priority</SelectItem>
          </SelectContent>
        </Select>

        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-36 bg-white text-xs h-9 border-slate-200 shadow-2xs">
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk Levels</SelectItem>
            <SelectItem value="LOW">Low Risk</SelectItem>
            <SelectItem value="MEDIUM">Moderate / Medium</SelectItem>
            <SelectItem value="HIGH">High / Critical</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-white text-xs h-9 border-slate-200 shadow-2xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending Review</SelectItem>
            <SelectItem value="APPROVED">Suitable / Approved</SelectItem>
            <SelectItem value="NEEDS_REVIEW">Needs Review</SelectItem>
            <SelectItem value="NOT_APPROVED">Not Suitable</SelectItem>
          </SelectContent>
        </Select>

        {(search || typeFilter !== "all" || priorityFilter !== "all" || riskFilter !== "all" || statusFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setTypeFilter("all");
              setPriorityFilter("all");
              setRiskFilter("all");
              setStatusFilter("all");
            }}
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Targets Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                {["TARGET", "TYPE", "ORGAN", "BLOOD GROUP", "PRIORITY", "STATUS", "LAST REVIEW", "ACTION"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-xs text-slate-400">
                    Loading clinical assessment targets…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-xs text-rose-600 font-medium">
                    Failed to load clinical targets from hospital backend.
                  </td>
                </tr>
              ) : filteredTargets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-xs text-slate-400">
                    No clinical targets match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredTargets.map((item) => {
                  const isPending = item.status === "PENDING";
                  return (
                    <tr key={item.id + item.type} className="hover:bg-slate-50/60 transition-colors">
                      {/* TARGET */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold font-mono text-slate-900 text-xs">
                            {item.code}
                          </span>
                          <span className="text-xs text-slate-600 font-medium">{item.name}</span>
                        </div>
                      </td>

                      {/* TYPE */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={
                            item.type === "Donor"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold"
                              : item.type === "Recipient"
                              ? "bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold"
                              : "bg-purple-50 text-purple-700 border-purple-200 text-xs font-semibold"
                          }
                        >
                          {item.type}
                        </Badge>
                      </td>

                      {/* ORGAN */}
                      <td className="px-5 py-3.5 whitespace-nowrap font-medium text-slate-800 text-xs">
                        {item.organ}
                      </td>

                      {/* BLOOD GROUP */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <Badge variant="outline" className="font-mono text-xs font-bold bg-slate-50 text-slate-800 border-slate-200">
                          {item.blood_group}
                        </Badge>
                      </td>

                      {/* PRIORITY */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={
                            item.priority === "HIGH" || item.priority === "High"
                              ? "bg-rose-50 text-rose-700 border-rose-200 text-xs font-bold"
                              : item.priority === "MEDIUM" || item.priority === "Medium"
                              ? "bg-amber-50 text-amber-700 border-amber-200 text-xs font-semibold"
                              : "bg-slate-50 text-slate-600 border-slate-200 text-xs font-semibold"
                          }
                        >
                          {item.priority}
                        </Badge>
                      </td>

                      {/* STATUS */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <StatusBadge value={item.status} />
                      </td>

                      {/* LAST REVIEW */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500 font-mono">
                        {item.last_review ? fmtDateTime(item.last_review) : "Pending Review"}
                      </td>

                      {/* ACTION */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <Link
                          to={`/doctor/assessments/${item.id}`}
                          search={{ type: item.type }}
                        >
                          {isPending ? (
                            <Button size="sm" className="gap-1.5 text-xs font-semibold h-8 shadow-2xs bg-blue-600 hover:bg-blue-700 text-white">
                              <FileEdit className="h-3.5 w-3.5" />
                              Review Assessment
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold h-8 border-slate-200 text-slate-700 hover:bg-slate-100">
                              <Eye className="h-3.5 w-3.5 text-blue-600" />
                              View Assessment
                            </Button>
                          )}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
