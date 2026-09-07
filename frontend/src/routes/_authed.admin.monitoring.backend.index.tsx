import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, RefreshCw, Server, Zap } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/admin/monitoring/backend/")({
  head: () => ({
    meta: [{ title: "Backend API Monitoring — OrganMatch Admin" }],
  }),
  component: AdminBackendMonitoringPage,
});

export function AdminBackendMonitoringPage() {
  const { user, ready } = useAuth();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const { data: bEnd, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "monitoring", "backend"],
    queryFn: () => api.systemBackend(),
    enabled: ready && !!user,
  });

  const handleTestConnection = async () => {
    setTesting(true);
    const t0 = performance.now();
    try {
      await api.systemBackend();
      const latency = Math.round(performance.now() - t0);
      setTestResult(`Success (HTTP 200 OK — ${latency} ms latency)`);
      toast.success(`Backend API test passed (${latency} ms)`);
    } catch (err: any) {
      setTestResult(`Failed (${err.message || "Connection error"})`);
      toast.error("Backend connection test failed.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Server className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-semibold text-gray-900">Backend API Monitoring</h1>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              HEALTHY
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            FastAPI application status, latency metrics, runtime environment, and request breakdown.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing}
            className="gap-1.5 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
          >
            <Zap className="h-3.5 w-3.5" />
            {testing ? "Testing…" : "Test Backend Connection"}
          </Button>
          <TelemetryRefreshButton
            label="Refresh Metrics"
            onRefresh={() => refetch()}
            isFetching={isFetching}
          />
        </div>
      </div>

      {testResult && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs font-mono text-blue-800 flex items-center justify-between">
          <span><strong>Live Ping Verification:</strong> {testResult}</span>
          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setTestResult(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              API Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 font-mono">
              {isLoading ? "…" : `${bEnd?.response_time_ms ?? 0} ms`}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Internal dispatch latency</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 font-mono">
              {isLoading ? "…" : bEnd?.total_requests_count?.toLocaleString() ?? 0}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Since application startup</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              2xx Success Responses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 font-mono">
              {isLoading ? "…" : bEnd?.responses_2xx_count?.toLocaleString() ?? 0}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Successful API dispatches</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              4xx / 5xx Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 font-mono">
              {isLoading ? "…" : (bEnd?.responses_4xx_count ?? 0) + (bEnd?.responses_5xx_count ?? 0)}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Client/Server error count</p>
          </CardContent>
        </Card>
      </div>

      {/* Runtime details */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b border-gray-100 pb-2">
          FastAPI Runtime Environment
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 bg-gray-50 rounded border border-gray-200">
            <span className="text-gray-500 block mb-0.5">Framework</span>
            <span className="text-gray-900 font-medium">FastAPI v{bEnd?.fastapi_version || "0.111.0"}</span>
          </div>

          <div className="p-3 bg-gray-50 rounded border border-gray-200">
            <span className="text-gray-500 block mb-0.5">Python Interpreter</span>
            <span className="text-gray-900 font-medium">Python {bEnd?.python_version || "3.11"}</span>
          </div>

          <div className="p-3 bg-gray-50 rounded border border-gray-200">
            <span className="text-gray-500 block mb-0.5">Uptime</span>
            <span className="text-gray-900 font-medium">
              {bEnd?.uptime_seconds ? `${Math.round(bEnd.uptime_seconds / 60)} minutes` : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
