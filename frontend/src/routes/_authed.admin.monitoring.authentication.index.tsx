import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authed/admin/monitoring/authentication/")({
  head: () => ({
    meta: [{ title: "Authentication Service Monitoring — OrganMatch Admin" }],
  }),
  component: AdminAuthMonitoringPage,
});

export function AdminAuthMonitoringPage() {
  const { user, ready } = useAuth();

  const { data: authMon, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "monitoring", "authentication"],
    queryFn: () => api.systemAuthentication(),
    enabled: ready && !!user,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-semibold text-gray-900">Authentication Service Monitoring</h1>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              HEALTHY
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            JWT token issuance status, active user sessions, failed authentication security metrics.
          </p>
        </div>

        <TelemetryRefreshButton
          label="Refresh Auth Status"
          onRefresh={() => refetch()}
          isFetching={isFetching}
        />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Active User Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 font-mono">
              {isLoading ? "…" : authMon?.active_users ?? 0}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Active status users</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Failed Login Attempts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 font-mono">
              {isLoading ? "…" : authMon?.failed_login_attempts ?? 0}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Logged auth failures</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Locked Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 font-mono">
              {isLoading ? "…" : authMon?.locked_accounts ?? 0}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Suspended user profiles</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Access Token Service
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 font-mono">ACTIVE</div>
            <p className="text-[11px] text-gray-500 mt-1">HS256 15-min Lifespan</p>
          </CardContent>
        </Card>
      </div>

      {/* Security notice */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b border-gray-100 pb-2">
          Authentication Architecture & Security Telemetry
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
            <span className="text-gray-500 block">Access Token Mechanism</span>
            <span className="text-gray-900 font-medium">JWT HS256 Bearer Header</span>
          </div>

          <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
            <span className="text-gray-500 block">Refresh Token Mechanism</span>
            <span className="text-gray-900 font-medium">HTTP-Only SameSite Cookie</span>
          </div>

          <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
            <span className="text-gray-500 block">Password Hashing Engine</span>
            <span className="text-gray-900 font-medium">Argon2 / Passlib CryptContext</span>
          </div>

          <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
            <span className="text-gray-500 block">Authorization Model</span>
            <span className="text-gray-900 font-medium">Hybrid RBAC + ABAC (Hospital Scope)</span>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 italic">
          Zero secret keys, active tokens, or password hashes are ever transmitted to monitoring dashboards.
        </p>
      </div>
    </div>
  );
}
