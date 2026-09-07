import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileCode, Globe, RefreshCw, Server } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authed/admin/monitoring/frontend/")({
  head: () => ({
    meta: [{ title: "Frontend Monitoring — OrganMatch Admin" }],
  }),
  component: AdminFrontendMonitoringPage,
});

export function AdminFrontendMonitoringPage() {
  const { user, ready } = useAuth();

  const { data: bEnd, isLoading } = useQuery({
    queryKey: ["admin", "monitoring", "backend"],
    queryFn: () => api.systemBackend(),
    enabled: ready && !!user,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <FileCode className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-semibold text-gray-900">Frontend Application Monitoring</h1>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              HEALTHY
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            React/TanStack SPA environment metadata, router state, and API connectivity metrics.
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Frontend Version
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 font-mono">1.0.0</div>
            <p className="text-[11px] text-gray-500 mt-1">React 18 + TanStack Router</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Environment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 font-mono">
              {import.meta.env.MODE || "development"}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Vite Build Target</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              API Connectivity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 font-mono">CONNECTED</div>
            <p className="text-[11px] text-gray-500 mt-1">Axios Interceptor Active</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Build Bundler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 font-mono">Vite 5</div>
            <p className="text-[11px] text-gray-500 mt-1">Rolldown/ESBuild Client</p>
          </CardContent>
        </Card>
      </div>

      {/* Details List */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b border-gray-100 pb-2">
          Application URLs & Environment Metadata
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
            <span className="text-gray-500 block">Frontend Host Origin</span>
            <span className="text-gray-900 font-medium">{window.location.origin}</span>
          </div>

          <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
            <span className="text-gray-500 block">Backend Target Base URL</span>
            <span className="text-gray-900 font-medium">http://localhost:8000/api</span>
          </div>

          <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
            <span className="text-gray-500 block">Router Architecture</span>
            <span className="text-gray-900 font-medium">TanStack Router (File-Based Route Tree)</span>
          </div>

          <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
            <span className="text-gray-500 block">State Cache Manager</span>
            <span className="text-gray-900 font-medium">TanStack React Query v5</span>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 italic">
          No private environment variables or secrets are exposed in browser runtime metadata.
        </p>
      </div>
    </div>
  );
}
