import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  HeartHandshake,
  ShieldAlert,
  Shuffle,
  Stethoscope,
  Users,
  Waves,
  Sparkles,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import { StatusBadge, fmtDateTime } from "@/components/ui-kit";
import type { PriorityReviewItem } from "@/services/types";

export const Route = createFileRoute("/_authed/doctor/")({
  head: () => ({
    meta: [{ title: "Clinical Review Dashboard — OrganMatch" }],
  }),
  component: DoctorOverviewPage,
});

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  to,
  badge,
  badgeVariant = "default",
}: {
  title: string;
  value: number | string;
  description: string;
  icon: React.ElementType;
  to?: string;
  badge?: string;
  badgeVariant?: "default" | "alert" | "warning" | "neutral";
}) {
  const content = (
    <Card className="border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-400/50 transition-all duration-200 bg-white group cursor-pointer h-full flex flex-col justify-between">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </CardTitle>
        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200 shadow-2xs">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</div>
          {badge && (
            <Badge
              variant="outline"
              className={
                badgeVariant === "alert"
                  ? "bg-rose-50 text-rose-700 border-rose-200 text-xs font-semibold"
                  : badgeVariant === "warning"
                  ? "bg-amber-50 text-amber-700 border-amber-200 text-xs font-semibold"
                  : badgeVariant === "neutral"
                  ? "bg-slate-50 text-slate-700 border-slate-200 text-xs font-semibold"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold"
              }
            >
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-2 font-medium flex items-center justify-between">
          <span>{description}</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
        </p>
      </CardContent>
    </Card>
  );

  if (to) {
    return <Link to={to} className="block">{content}</Link>;
  }
  return content;
}

function DoctorOverviewPage() {
  const { user, ready } = useAuth();

  const {
    data: overview,
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["doctor", "overview"],
    queryFn: () => api.doctorOverview(),
    enabled: ready && !!user,
    refetchInterval: 15000,
    placeholderData: keepPreviousData,
  });

  const lastUpdatedStr = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : "Just now";

  const hospitalName =
    user?.hospital_name || overview?.hospital_name || "Hospital Assigned";
  const doctorName =
    user?.username ? `Dr. ${user.username}` : "Attending Physician";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-7">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center shadow-xs">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Clinical Review Dashboard
                </h1>
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs"
                >
                  {hospitalName}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 mt-0.5 font-normal flex items-center gap-2">
                <span>Logged in as: <strong className="text-slate-800 font-semibold">{doctorName}</strong></span>
                <span className="text-slate-300">•</span>
                <span>Hospital Scope Enforced</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <TelemetryRefreshButton
            label="Refresh Data"
            onRefresh={() => refetch()}
            isFetching={isFetching}
          />
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/80 rounded-lg text-[11px] font-mono font-medium text-slate-500 border border-slate-200/60">
            <Clock className="h-3 w-3 text-slate-400" />
            <span>Updated: {lastUpdatedStr}</span>
          </div>
          <Link to="/doctor/assessments">
            <Button variant="outline" className="gap-2 text-xs font-semibold shadow-2xs">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              Assessments
            </Button>
          </Link>
          <Link to="/doctor/matches">
            <Button className="gap-2 text-xs font-semibold shadow-2xs bg-blue-600 hover:bg-blue-700 text-white">
              <Shuffle className="h-4 w-4" />
              Match Reviews
            </Button>
          </Link>
        </div>
      </div>

      {/* Clinical Mandate & Authority Notice */}
      <div className="p-4 bg-amber-50/90 border border-amber-200/90 rounded-xl flex items-start gap-3.5 text-amber-950 text-sm shadow-xs">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <span className="font-semibold text-amber-900 block text-[13px]">
            Clinical Governance & Authority Notice
          </span>
          <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
            Doctors perform independent clinical suitability reviews, risk stratification, and donor/recipient clearances. <strong>Final organ allocation remains strictly with the national Allocation Authority.</strong>
          </p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            Unable to load clinical review data from server.
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="text-xs h-8">
            <RefreshCw className="h-3 w-3 mr-1" /> Retry
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Donors Pending Review"
          value={isLoading ? "…" : overview?.donors_pending_review ?? 0}
          description="Donors registered in your hospital scope"
          icon={HeartHandshake}
          to="/doctor/assessments"
          badge={overview?.donors_pending_review ? `${overview.donors_pending_review} Pending` : undefined}
          badgeVariant="warning"
        />

        <MetricCard
          title="Recipients Pending Review"
          value={isLoading ? "…" : overview?.recipients_pending_review ?? 0}
          description="Waitlisted candidates requiring clinical sign-off"
          icon={Users}
          to="/doctor/assessments"
          badge={overview?.recipients_pending_review ? `${overview.recipients_pending_review} Needs Review` : undefined}
          badgeVariant="alert"
        />

        <MetricCard
          title="Organs Requiring Review"
          value={isLoading ? "…" : overview?.organs_available ?? 0}
          description="Organs awaiting viability & clearance assessment"
          icon={Waves}
          to="/doctor/assessments"
          badge={overview?.organs_available ? `${overview.organs_available} Pending` : undefined}
          badgeVariant="warning"
        />

        <MetricCard
          title="Matches Pending Review"
          value={isLoading ? "…" : overview?.matches_pending ?? 0}
          description="Algorithmic matches awaiting doctor clearance"
          icon={Shuffle}
          to="/doctor/matches"
          badge={overview?.matches_pending ? `${overview.matches_pending} Action Req.` : undefined}
          badgeVariant="alert"
        />
      </div>

      {/* Priority Clinical Reviews Section */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900">Priority Clinical Reviews</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Urgent clinical cases and high-compatibility matches requiring physician review
            </p>
          </div>
          <Link to="/doctor/assessments">
            <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700 font-semibold gap-1">
              View All Assessment Targets <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading priority cases…</div>
          ) : !overview?.priority_reviews || overview.priority_reviews.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No urgent clinical reviews currently pending in your hospital.
            </div>
          ) : (
            overview.priority_reviews.map((item: PriorityReviewItem) => {
              const isMatch = item.type === "Match";
              const nextActionText = item.next_action || (
                item.status === "APPROVED"
                  ? "Awaiting Allocation Authority Approval"
                  : item.status === "NOT_APPROVED"
                  ? "Candidate Ineligible"
                  : "Doctor Clinical Assessment"
              );

              return (
                <div
                  key={item.id + item.code}
                  className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 ${
                        item.type === "Match"
                          ? "bg-purple-50 text-purple-700"
                          : item.type === "Recipient"
                          ? "bg-blue-50 text-blue-700"
                          : item.type === "Donor"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-cyan-50 text-cyan-700"
                      }`}
                    >
                      {item.type === "Match" ? (
                        <Shuffle className="h-4 w-4" />
                      ) : item.type === "Recipient" ? (
                        <Users className="h-4 w-4" />
                      ) : item.type === "Donor" ? (
                        <HeartHandshake className="h-4 w-4" />
                      ) : (
                        <Waves className="h-4 w-4" />
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm font-mono">{item.code}</span>
                        <span className="text-slate-400 text-xs">•</span>
                        <span className="text-slate-800 font-semibold text-xs">{item.target_label}</span>
                        <Badge variant="outline" className="text-[11px] font-semibold bg-slate-50 text-slate-700 border-slate-200">
                          {item.organ}
                        </Badge>
                        <Badge variant="outline" className="text-[11px] font-mono font-semibold bg-slate-50 text-slate-600 border-slate-200">
                          {item.blood_group}
                        </Badge>
                        {item.age && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            {item.age} yrs
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-medium text-slate-600">
                          Category: <strong className="text-slate-800">{item.type}</strong>
                        </span>
                        {item.urgency && (
                          <span className="flex items-center gap-1">
                            Urgency:{" "}
                            <strong
                              className={
                                item.urgency === "CRITICAL" || item.urgency === "Critical"
                                  ? "text-rose-600 font-bold"
                                  : item.urgency === "HIGH" || item.urgency === "High"
                                  ? "text-amber-600 font-semibold"
                                  : "text-slate-700"
                              }
                            >
                              {item.urgency}
                            </strong>
                          </span>
                        )}
                        {item.priority && (
                          <span className="flex items-center gap-1 text-slate-600">
                            Priority: <strong>{item.priority}</strong>
                          </span>
                        )}
                        {item.compatibility_score !== undefined && item.compatibility_score !== null && (
                          <span className="flex items-center gap-1 text-emerald-700 font-bold">
                            Compatibility: {item.compatibility_score}%
                          </span>
                        )}
                      </div>

                      {/* Next Action Pill */}
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-slate-400">Next Step:</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {nextActionText}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <Badge
                      variant="outline"
                      className={
                        item.status === "APPROVED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold"
                          : item.status === "NOT_APPROVED"
                          ? "bg-rose-50 text-rose-700 border-rose-200 text-xs font-semibold"
                          : "bg-amber-50 text-amber-700 border-amber-200 text-xs font-semibold"
                      }
                    >
                      {item.status || "PENDING"}
                    </Badge>
                    <Link to={item.review_url || (isMatch ? `/doctor/matching/${item.id}` : `/doctor/assessments/${item.id}?type=${item.type}`)}>
                      <Button size="sm" className="gap-1.5 text-xs font-semibold shadow-2xs bg-blue-600 hover:bg-blue-700 text-white">
                        Review <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Recent Clinical Assessments */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Clinical Reviews</h2>
            <p className="text-xs text-slate-500">Completed assessments recorded under your hospital scope</p>
          </div>
          <Link to="/doctor/history">
            <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700 font-semibold gap-1">
              Full History <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                {["Target Entity", "Suitability", "Risk Level", "Recommendation / Notes", "Reviewed Date"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-xs text-slate-400">
                    Loading clinical reviews…
                  </td>
                </tr>
              ) : !overview?.recent_assessments || overview.recent_assessments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-xs text-slate-400">
                    No clinical reviews performed yet.
                  </td>
                </tr>
              ) : (
                overview.recent_assessments.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs font-bold bg-slate-50">
                          {item.entity_type}
                        </Badge>
                        <span className="font-semibold text-slate-900 text-xs font-mono">
                          {item.target_code || item.entity_id.slice(0, 8)}
                        </span>
                        {item.target_name && item.target_name !== "—" && (
                          <span className="text-xs text-slate-600 font-medium">({item.target_name})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <StatusBadge value={item.suitability} />
                    </td>
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
                        {item.risk_level} RISK
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 max-w-sm truncate">
                      {item.recommendation || item.clinical_notes || "Clinical clearance documented."}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 font-mono whitespace-nowrap">
                      {fmtDateTime(item.reviewed_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
