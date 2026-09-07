import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  HeartHandshake,
  ShieldAlert,
  Shuffle,
  Users,
  Waves,
  XCircle,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, fmtDateTime } from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/allocation/")({
  head: () => ({
    meta: [{ title: "Allocation Authority Dashboard — OrganMatch" }],
  }),
  component: AllocationOverviewPage,
});

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  to,
  badge,
  variant = "blue",
}: {
  title: string;
  value: number | string;
  description: string;
  icon: React.ElementType;
  to?: string;
  badge?: string;
  variant?: "blue" | "amber" | "green" | "red" | "purple";
}) {
  const colorStyles = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    purple: "bg-purple-50 text-purple-700",
  };

  const content = (
    <Card className="border border-gray-200 shadow-sm hover:border-gray-300 transition-all bg-white">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-lg ${colorStyles[variant]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          {badge && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      </CardContent>
    </Card>
  );

  if (to) {
    return <Link to={to}>{content}</Link>;
  }
  return content;
}

function AllocationOverviewPage() {
  const { user, ready } = useAuth();

  const { data: overview, isLoading, error } = useQuery({
    queryKey: ["allocation", "overview"],
    queryFn: () => api.allocationOverview(),
    enabled: ready && !!user,
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <ClipboardCheck className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-semibold text-gray-900">Allocation Authority Console</h1>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              National Organ Allocation Body
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Centralized decision authority for reviewing compatibility rankings, doctor medical reviews, and authorizing organ allocations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/allocation/queue">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2 text-xs h-9">
              <ClipboardCheck className="h-4 w-4" />
              Allocation Queue
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Available Organs"
          value={isLoading ? "…" : overview?.organs_available ?? 0}
          description="Organs currently registered and unallocated"
          icon={Waves}
          to="/allocation/organs"
          variant="blue"
        />

        <MetricCard
          title="Pending Allocation Reviews"
          value={isLoading ? "…" : overview?.pending_allocation_reviews ?? 0}
          description="Allocations awaiting final authority approval"
          icon={Clock}
          to="/allocation/queue"
          variant="amber"
          badge="Action Required"
        />

        <MetricCard
          title="Medically Approved Matches"
          value={isLoading ? "…" : overview?.medically_approved_matches ?? 0}
          description="Rankings validated by hospital doctors"
          icon={Shuffle}
          to="/allocation/matches"
          variant="purple"
        />

        <MetricCard
          title="High-Priority Recipients"
          value={isLoading ? "…" : overview?.high_priority_recipients ?? 0}
          description="Waitlist candidates with critical urgency"
          icon={Users}
          variant="red"
        />

        <MetricCard
          title="Approved Allocations"
          value={isLoading ? "…" : overview?.approved_allocations ?? 0}
          description="Successfully authorized organ transfers"
          icon={CheckCircle2}
          to="/allocations"
          variant="green"
        />

        <MetricCard
          title="Rejected Allocations"
          value={isLoading ? "…" : overview?.rejected_allocations ?? 0}
          description="Matches rejected due to clinical/policy rules"
          icon={XCircle}
          to="/allocation/history"
          variant="red"
        />

        <MetricCard
          title="Allocations Completed"
          value={isLoading ? "…" : overview?.allocations_completed ?? 0}
          description="Total processed allocation cases"
          icon={FileText}
          to="/allocation/history"
          variant="blue"
        />
      </div>

      {/* Recent Allocation Decisions */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Recent Allocation Decisions</h2>
            <p className="text-xs text-gray-500">Audit-backed record of recent organ allocation determinations</p>
          </div>
          <Link to="/allocation/history">
            <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700">
              View History &rarr;
            </Button>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Allocation ID", "Organ Type", "Recipient", "Decision Status", "Approved / Rejected By", "Decision Date"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">
                    Loading allocation decisions…
                  </td>
                </tr>
              ) : !overview?.recent_decisions || overview.recent_decisions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">
                    No allocation decisions recorded yet.
                  </td>
                </tr>
              ) : (
                overview.recent_decisions.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-900 whitespace-nowrap">
                      {item.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-xs text-gray-900 whitespace-nowrap">
                      {item.organ_type}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {item.recipient_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge value={item.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {item.approved_by || "System"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                      {fmtDateTime(item.updated_at)}
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
