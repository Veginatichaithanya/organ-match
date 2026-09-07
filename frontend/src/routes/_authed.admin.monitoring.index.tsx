import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef } from "react";
import {
  Activity,
  AlertTriangle,
  Blocks,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileCode,
  HardDrive,
  KeyRound,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Users,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtDateTime } from "@/components/ui-kit";

import { AdminPostgresqlMonitoringPage } from "./_authed.admin.monitoring.postgresql.index";
import { AdminDatabaseTablesMonitoringPage } from "./_authed.admin.monitoring.database.index";
import { AdminBackendMonitoringPage } from "./_authed.admin.monitoring.backend.index";
import { AdminFrontendMonitoringPage } from "./_authed.admin.monitoring.frontend.index";
import { AdminAuthMonitoringPage } from "./_authed.admin.monitoring.authentication.index";
import { AdminDockerMonitoringPage } from "./_authed.admin.monitoring.docker.index";
import { AdminBlockchainMonitoringPage } from "./_authed.admin.monitoring.blockchain.index";
import { AdminApiActivityMonitoringPage } from "./_authed.admin.monitoring.api-activity.index";
import { AdminErrorLogsMonitoringPage } from "./_authed.admin.monitoring.errors.index";

export const Route = createFileRoute("/_authed/admin/monitoring/")({
  head: () => ({
    meta: [{ title: "System Monitoring — OrganMatch Admin" }],
  }),
  component: AdminSystemMonitoringPage,
});

function ServiceStatusPill({ status }: { status: string }) {
  const s = (status || "NOT_AVAILABLE").toUpperCase();
  if (s === "HEALTHY" || s === "CONNECTED" || s === "AVAILABLE") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        HEALTHY
      </span>
    );
  }
  if (s === "DEGRADED") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        DEGRADED
      </span>
    );
  }
  if (s === "OFFLINE" || s === "DOWN") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
        <span className="h-2 w-2 rounded-full bg-rose-500" />
        OFFLINE
      </span>
    );
  }
  if (s === "NOT_CONFIGURED") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
        <span className="h-2 w-2 rounded-full bg-slate-400" />
        NOT CONFIGURED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
      <span className="h-2 w-2 rounded-full bg-slate-400" />
      NOT AVAILABLE
    </span>
  );
}

function SystemHealthOverviewTab({
  onSelectTab,
}: {
  onSelectTab: (tab: string) => void;
}) {
  const { user, ready } = useAuth();

  const {
    data: servicesData,
    isLoading: isLoadingServices,
    isFetching: isFetchingServices,
    isError: isServicesError,
    refetch: refetchServices,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["admin", "system", "services"],
    queryFn: () => api.systemServices(),
    enabled: ready && !!user,
    refetchInterval: 10000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const {
    data: health,
    isLoading: isLoadingHealth,
    isFetching: isFetchingHealth,
    isError: isHealthError,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ["admin", "system", "health"],
    queryFn: () => api.systemHealth(),
    enabled: ready && !!user,
    refetchInterval: 10000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const isLoading = isLoadingServices || isLoadingHealth;
  const isFetching = isFetchingServices || isFetchingHealth;
  const isError = isServicesError && isHealthError;

  const handleRefreshAll = async () => {
    await Promise.all([refetchServices(), refetchHealth()]);
  };

  const services = servicesData?.services || [];
  const dockerService = services.find((s) => s.type === "docker");
  const fabricService = services.find((s) => s.type === "fabric");
  const dbService = services.find((s) => s.type === "database");
  const apiService = services.find((s) => s.type === "backend");
  const authService = services.find((s) => s.type === "auth");

  const lastCheckedTime = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : health?.last_checked
    ? new Date(health.last_checked).toLocaleTimeString()
    : "—";

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-8 text-center space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mx-auto">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">Unable to retrieve current service status</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            The system monitoring health check service did not respond. Check your backend connectivity or retry.
          </p>
        </div>
        <Button
          onClick={handleRefreshAll}
          variant="outline"
          className="bg-white border-rose-200 text-rose-700 hover:bg-rose-100"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Sub-Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-700 shrink-0">
            <Activity className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">System Monitoring</h2>
              <ServiceStatusPill status={servicesData?.overall_status || health?.overall_status || "UNKNOWN"} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time health and connectivity status of infrastructure services.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/80">
            Last checked: <span className="font-semibold text-slate-700">{lastCheckedTime}</span>
          </span>
          <TelemetryRefreshButton
            label="Refresh Status"
            onRefresh={handleRefreshAll}
            isFetching={isFetching}
          />
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && !servicesData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-1/3" />
            <div className="h-4 bg-slate-100 rounded w-2/3" />
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="h-12 bg-slate-100 rounded" />
              <div className="h-12 bg-slate-100 rounded" />
              <div className="h-12 bg-slate-100 rounded" />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-1/3" />
            <div className="h-4 bg-slate-100 rounded w-2/3" />
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="h-12 bg-slate-100 rounded" />
              <div className="h-12 bg-slate-100 rounded" />
              <div className="h-12 bg-slate-100 rounded" />
            </div>
          </div>
        </div>
      )}

      {/* 2 Primary Infrastructure Service Cards (Docker & Hyperledger Fabric) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Docker Services Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-700 shrink-0">
                  <Blocks className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Docker Services</h3>
              </div>
              <ServiceStatusPill status={dockerService?.status || "NOT_AVAILABLE"} />
            </div>

            <p className="text-xs text-slate-600 mb-4 min-h-[32px]">
              {dockerService?.message || "Checking Docker daemon and container status..."}
            </p>

            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Running</span>
                <span className="text-lg font-bold font-mono text-emerald-600">
                  {dockerService?.metrics?.running_containers ?? 0}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Stopped</span>
                <span className="text-lg font-bold font-mono text-slate-700">
                  {dockerService?.metrics?.stopped_containers ?? 0}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Total</span>
                <span className="text-lg font-bold font-mono text-slate-900">
                  {dockerService?.metrics?.total_containers ?? 0}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 font-mono">
              Checked: {lastCheckedTime}
            </span>
            <button
              onClick={() => onSelectTab("docker")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
            >
              View Details →
            </button>
          </div>
        </div>

        {/* Hyperledger Fabric Blockchain Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Hyperledger Fabric Blockchain</h3>
              </div>
              <ServiceStatusPill status={fabricService?.status || "NOT_CONFIGURED"} />
            </div>

            <p className="text-xs text-slate-600 mb-4 min-h-[32px]">
              {fabricService?.message || "Checking Fabric network and chaincode connectivity..."}
            </p>

            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Peer Status</span>
                <span className="text-xs font-bold font-mono text-slate-700 truncate block mt-1">
                  {fabricService?.metrics?.peer_status || "NOT_CONFIGURED"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Channel</span>
                <span className="text-xs font-bold font-mono text-slate-700 truncate block mt-1">
                  {fabricService?.metrics?.channel || "organmatch"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  {fabricService?.status === "HEALTHY" ? "Block Height" : "Last Known Block"}
                </span>
                <span className="text-base font-bold font-mono text-indigo-600 block mt-1">
                  {fabricService?.status === "HEALTHY"
                    ? `#${fabricService?.metrics?.latest_block ?? 0}`
                    : fabricService?.metrics?.last_known_block
                    ? `#${fabricService.metrics.last_known_block}`
                    : "Unavailable"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 font-mono">
              Checked: {lastCheckedTime}
            </span>
            <button
              onClick={() => onSelectTab("blockchain")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
            >
              View Details →
            </button>
          </div>
        </div>
      </div>

      {/* 3 Secondary Supporting Service Cards (DB, Backend, Auth) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* PostgreSQL */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PostgreSQL</span>
              <ServiceStatusPill status={dbService?.status || "HEALTHY"} />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900">
              {health?.database_response_time_ms ?? dbService?.latency_ms ?? 0} ms
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Live query latency (SELECT 1)</p>
          </div>
          <button
            onClick={() => onSelectTab("postgresql")}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 text-left pt-3 border-t border-slate-100 mt-3 cursor-pointer"
          >
            PostgreSQL Metrics →
          </button>
        </div>

        {/* Backend API */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">FastAPI Router</span>
              <ServiceStatusPill status={apiService?.status || "HEALTHY"} />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900">
              {health?.backend_response_time_ms ?? apiService?.latency_ms ?? 0} ms
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Application response time</p>
          </div>
          <button
            onClick={() => onSelectTab("backend")}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 text-left pt-3 border-t border-slate-100 mt-3 cursor-pointer"
          >
            API Diagnostics →
          </button>
        </div>

        {/* Auth & Security */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Auth & RBAC</span>
              <ServiceStatusPill status={authService?.status || "HEALTHY"} />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900">
              {health?.active_users_count ?? 0} Active Users
            </div>
            <p className="text-[11px] text-slate-500 mt-1">JWT HS256 + RBAC/ABAC engine</p>
          </div>
          <button
            onClick={() => onSelectTab("authentication")}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 text-left pt-3 border-t border-slate-100 mt-3 cursor-pointer"
          >
            Auth Health →
          </button>
        </div>
      </div>

      {/* Subsystem Health Matrix */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Subsystem Health Matrix</h3>
            <p className="text-xs text-slate-500 mt-0.5">Live operational status of core infrastructure modules</p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {services.map((srv) => (
            <div key={srv.name} className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-700 shrink-0">
                  {srv.type === "database" ? (
                    <Database className="h-4.5 w-4.5" />
                  ) : srv.type === "backend" ? (
                    <Server className="h-4.5 w-4.5" />
                  ) : srv.type === "auth" ? (
                    <KeyRound className="h-4.5 w-4.5" />
                  ) : srv.type === "docker" ? (
                    <Blocks className="h-4.5 w-4.5" />
                  ) : (
                    <ShieldCheck className="h-4.5 w-4.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{srv.name}</h4>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{srv.message}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                {srv.latency_ms !== undefined && srv.latency_ms !== null && (
                  <span className="text-xs font-mono text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                    {srv.latency_ms} ms
                  </span>
                )}
                <ServiceStatusPill status={srv.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Access Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Monitoring Modules Quick Access
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {[
            { id: "postgresql", label: "PostgreSQL", icon: Database },
            { id: "database", label: "Database Tables", icon: HardDrive },
            { id: "backend", label: "Backend API", icon: Server },
            { id: "frontend", label: "Frontend", icon: FileCode },
            { id: "authentication", label: "Authentication", icon: KeyRound },
            { id: "docker", label: "Docker Services", icon: Blocks },
            { id: "blockchain", label: "Blockchain", icon: ShieldCheck },
            { id: "api-activity", label: "API Activity", icon: Terminal },
            { id: "errors", label: "Error Logs", icon: AlertTriangle },
            { id: "security", label: "Security Health", icon: ShieldAlert },
          ].map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className="group flex flex-col items-center justify-center p-4 min-h-[105px] w-full bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-xs hover:bg-slate-50/50 transition-all text-center cursor-pointer"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors mb-2 shrink-0">
                  <IconComponent className="h-4.5 w-4.5" />
                </div>
                <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-700 transition-colors line-clamp-1">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AdminSystemMonitoringPage() {
  const [activeTab, setActiveTab] = useState("system-health");
  const tabsRef = useRef<HTMLDivElement>(null);

  const monitoringTabs = [
    { id: "system-health", label: "System Health", icon: Activity },
    { id: "postgresql", label: "PostgreSQL", icon: Database },
    { id: "database", label: "Database Tables", icon: HardDrive },
    { id: "backend", label: "Backend API", icon: Server },
    { id: "frontend", label: "Frontend", icon: FileCode },
    { id: "authentication", label: "Authentication", icon: KeyRound },
    { id: "docker", label: "Docker Services", icon: Blocks },
    { id: "blockchain", label: "Blockchain", icon: ShieldCheck },
    { id: "api-activity", label: "API Activity", icon: Terminal },
    { id: "errors", label: "Error Logs", icon: AlertTriangle },
  ];

  const scrollTabs = (direction: "left" | "right") => {
    if (tabsRef.current) {
      const scrollAmount = direction === "left" ? -250 : 250;
      tabsRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex items-start gap-3.5 border-b border-slate-200 pb-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-700 shrink-0 shadow-2xs">
          <Activity className="h-5.5 w-5.5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            System Monitoring
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Centralized administrative telemetry dashboard for infrastructure, services, databases, authentication, blockchain and application activity.
          </p>
        </div>
      </div>

      {/* Main Slider Tabs Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <div className="relative flex items-center gap-1.5 bg-slate-100/90 border border-slate-200 p-1.5 rounded-xl shadow-2xs">
          {/* Left Arrow Button */}
          <button
            type="button"
            onClick={() => scrollTabs("left")}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200/80 text-slate-600 hover:text-blue-700 hover:bg-slate-50 transition-colors shrink-0 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            title="Scroll Left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Scrollable Tabs List */}
          <div
            ref={tabsRef}
            className="w-full overflow-x-auto no-scrollbar scroll-smooth flex items-center"
          >
            <TabsList className="h-auto p-0 bg-transparent border-0 rounded-none flex items-center gap-1 min-w-max">
              {monitoringTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="px-3.5 py-2 text-xs font-semibold gap-2 rounded-lg text-slate-600 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-slate-200/80 transition-all cursor-pointer shrink-0"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* Right Arrow Button */}
          <button
            type="button"
            onClick={() => scrollTabs("right")}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200/80 text-slate-600 hover:text-blue-700 hover:bg-slate-50 transition-colors shrink-0 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            title="Scroll Right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Contents */}
        <TabsContent value="system-health" className="m-0 focus-visible:outline-none">
          <SystemHealthOverviewTab onSelectTab={setActiveTab} />
        </TabsContent>

        <TabsContent value="postgresql" className="m-0 focus-visible:outline-none">
          <AdminPostgresqlMonitoringPage />
        </TabsContent>

        <TabsContent value="database" className="m-0 focus-visible:outline-none">
          <AdminDatabaseTablesMonitoringPage />
        </TabsContent>

        <TabsContent value="backend" className="m-0 focus-visible:outline-none">
          <AdminBackendMonitoringPage />
        </TabsContent>

        <TabsContent value="frontend" className="m-0 focus-visible:outline-none">
          <AdminFrontendMonitoringPage />
        </TabsContent>

        <TabsContent value="authentication" className="m-0 focus-visible:outline-none">
          <AdminAuthMonitoringPage />
        </TabsContent>

        <TabsContent value="docker" className="m-0 focus-visible:outline-none">
          <AdminDockerMonitoringPage />
        </TabsContent>

        <TabsContent value="blockchain" className="m-0 focus-visible:outline-none">
          <AdminBlockchainMonitoringPage />
        </TabsContent>

        <TabsContent value="api-activity" className="m-0 focus-visible:outline-none">
          <AdminApiActivityMonitoringPage />
        </TabsContent>

        <TabsContent value="errors" className="m-0 focus-visible:outline-none">
          <AdminErrorLogsMonitoringPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
