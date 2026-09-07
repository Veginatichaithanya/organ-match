import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Blocks,
  Building2,
  CheckCircle2,
  ClipboardList,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";

export const Route = createFileRoute("/_authed/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Overview — OrganMatch" },
      { name: "description", content: "System administration dashboard for users, hospitals, security, and audit activity." },
    ],
  }),
  component: AdminOverviewPage,
});

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  colorTheme: "blue" | "emerald" | "rose" | "amber" | "slate" | "indigo";
  to?: string;
  subtitle?: string;
  badgeText?: string;
  statusIndicator?: "healthy" | "warning" | "neutral";
}

const THEME_STYLES: Record<StatCardProps["colorTheme"], { iconBg: string; iconColor: string; border: string }> = {
  blue: {
    iconBg: "bg-blue-50/80 text-blue-700 border-blue-100",
    iconColor: "text-blue-700",
    border: "border-slate-200/90",
  },
  emerald: {
    iconBg: "bg-emerald-50/80 text-emerald-700 border-emerald-100",
    iconColor: "text-emerald-700",
    border: "border-slate-200/90",
  },
  rose: {
    iconBg: "bg-rose-50/80 text-rose-700 border-rose-100",
    iconColor: "text-rose-700",
    border: "border-slate-200/90",
  },
  amber: {
    iconBg: "bg-amber-50/80 text-amber-700 border-amber-100",
    iconColor: "text-amber-700",
    border: "border-slate-200/90",
  },
  slate: {
    iconBg: "bg-slate-100/80 text-slate-700 border-slate-200",
    iconColor: "text-slate-700",
    border: "border-slate-200/90",
  },
  indigo: {
    iconBg: "bg-indigo-50/80 text-indigo-700 border-indigo-100",
    iconColor: "text-indigo-700",
    border: "border-slate-200/90",
  },
};

function StatCard({
  title,
  value,
  icon: Icon,
  colorTheme,
  to,
  subtitle,
  badgeText,
  statusIndicator,
}: StatCardProps) {
  const theme = THEME_STYLES[colorTheme];

  const content = (
    <div className={`group relative rounded-xl border ${theme.border} bg-white p-5 shadow-xs transition-all duration-200 hover:border-slate-300 hover:shadow-md flex flex-col justify-between h-full`}>
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            {title}
          </span>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${theme.iconBg} shrink-0 transition-transform duration-200 group-hover:scale-105`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </span>
          {badgeText && (
            <span className="text-xs font-medium text-slate-500">
              {badgeText}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between min-h-[24px]">
        {subtitle ? (
          <p className="text-xs text-slate-500 truncate">{subtitle}</p>
        ) : (
          <span />
        )}

        {statusIndicator === "healthy" && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
            <CheckCircle2 className="h-3 w-3" /> Healthy
          </span>
        )}

        {statusIndicator === "warning" && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
            <Activity className="h-3 w-3" /> Monitor
          </span>
        )}

        {to && !statusIndicator && (
          <span className="text-xs font-medium text-blue-600 group-hover:text-blue-700 inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            View <ArrowRight className="h-3 w-3 ml-0.5" />
          </span>
        )}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block h-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
}

function AdminOverviewPage() {
  const { user, ready } = useAuth();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => api.adminOverview(),
    enabled: ready && !!user,
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-8 pb-10">
      {/* Context & Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
              <Building2 className="h-3.5 w-3.5 text-slate-500" />
              {user?.organization || "Hospital A (General Care)"}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-[11px] font-medium text-blue-700">
              Admin Portal
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Admin Overview
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            System administration dashboard for users, hospitals, security, and audit activity.
          </p>
        </div>

        {/* Refresh & Status Indicator Pill */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <TelemetryRefreshButton
            label="Refresh Dashboard"
            onRefresh={() => refetch()}
            isFetching={isFetching}
          />
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-medium text-slate-700">System Operational</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>Failed to load overview data. Please check connection and refresh.</span>
        </div>
      )}

      {/* Users Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Users Management
          </h2>
          <Link to="/admin/users" className="text-xs font-medium text-blue-700 hover:underline">
            Manage All Users →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Total Users"
            value={isLoading ? "—" : (data?.total_users ?? 0)}
            icon={Users}
            colorTheme="blue"
            to="/admin/users"
            subtitle="Registered system accounts"
          />
          <StatCard
            title="Active Users"
            value={isLoading ? "—" : (data?.active_users ?? 0)}
            icon={UserCheck}
            colorTheme="emerald"
            to="/admin/users"
            subtitle="Enabled & operational accounts"
          />
          <StatCard
            title="Inactive / Suspended"
            value={isLoading ? "—" : (data?.inactive_users ?? 0)}
            icon={UserX}
            colorTheme="slate"
            to="/admin/users"
            subtitle="Disabled or locked accounts"
            statusIndicator="healthy"
          />
        </div>
      </section>

      {/* Hospitals Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Hospitals & Organizations
          </h2>
          <Link to="/admin/hospitals" className="text-xs font-medium text-blue-700 hover:underline">
            Manage Hospitals →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Registered Hospitals"
            value={isLoading ? "—" : (data?.total_hospitals ?? 0)}
            icon={Building2}
            colorTheme="blue"
            to="/admin/hospitals"
            subtitle="Configured network entities"
          />
          <StatCard
            title="Active Hospitals"
            value={isLoading ? "—" : (data?.active_hospitals ?? 0)}
            icon={Building2}
            colorTheme="emerald"
            to="/admin/hospitals"
            subtitle="Participating transplant centers"
            statusIndicator="healthy"
          />
        </div>
      </section>

      {/* Security & Audit Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Compliance & Audit
          </h2>
          <Link to="/admin/monitoring" className="text-xs font-medium text-blue-700 hover:underline">
            System Monitoring →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            title="Open Tampering Alerts"
            value={isLoading ? "—" : (data?.open_tampering_alerts ?? 0)}
            icon={AlertTriangle}
            colorTheme={(data?.open_tampering_alerts ?? 0) > 0 ? "rose" : "emerald"}
            to="/admin/tampering"
            subtitle="Unresolved integrity mismatches"
            statusIndicator={(data?.open_tampering_alerts ?? 0) === 0 ? "healthy" : undefined}
          />
          <StatCard
            title="Blockchain Transactions"
            value={isLoading ? "—" : (data?.total_blockchain_transactions ?? 0)}
            icon={Blocks}
            colorTheme="indigo"
            to="/admin/blockchain"
            subtitle="Hyperledger Fabric ledger blocks"
          />
        </div>
      </section>

      {/* Quick Actions */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Quick Actions</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Direct administrative access to user accounts, audit trails, and system governance.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              label: "Create User",
              desc: "Create and assign a system account",
              to: "/admin/users",
              icon: UserPlus,
              color: "text-blue-700 bg-blue-50 border-blue-100",
            },
            {
              label: "Manage Hospitals",
              desc: "Manage registered hospital organizations",
              to: "/admin/hospitals",
              icon: Building2,
              color: "text-emerald-700 bg-emerald-50 border-emerald-100",
            },
            {
              label: "System Monitoring",
              desc: "Review system performance and telemetry",
              to: "/admin/monitoring",
              icon: Activity,
              color: "text-indigo-700 bg-indigo-50 border-indigo-100",
            },
            {
              label: "Verify Blockchain",
              desc: "Verify ledger integrity",
              to: "/admin/blockchain",
              icon: Blocks,
              color: "text-indigo-700 bg-indigo-50 border-indigo-100",
            },
          ].map(({ label, desc, to, icon: ActionIcon, color }) => (
            <Link
              key={to + label}
              to={to}
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/40 p-4 transition-all duration-200 hover:border-slate-300 hover:bg-white hover:shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg border ${color}`}>
                    <ActionIcon className="h-4.5 w-4.5" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-slate-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                  {label}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
