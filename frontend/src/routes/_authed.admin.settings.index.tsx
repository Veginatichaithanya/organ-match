import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  KeyRound,
  Lock,
  Server,
  Shield,
  Sliders,
  Cpu,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authed/admin/settings/")({
  head: () => ({
    meta: [{ title: "System Settings — OrganMatch Admin" }],
  }),
  component: AdminSettingsPage,
});

function SettingRow({
  icon: Icon,
  title,
  description,
  value,
  badge,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  value: React.ReactNode;
  badge?: string;
}) {
  return (
    <div className="flex items-start justify-between py-4 border-b border-gray-100 last:border-0 gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600 flex-shrink-0 mt-0.5">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-900">{title}</h4>
            {badge && (
              <Badge variant="outline" className="text-xs">
                {badge}
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="text-sm font-mono font-medium text-gray-900 flex-shrink-0">{value}</div>
    </div>
  );
}

function AdminSettingsPage() {
  const { user, ready } = useAuth();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => api.adminGetSettings(),
    enabled: ready && !!user,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">System Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Active platform runtime parameters and security thresholds.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          Failed to load system settings.
        </div>
      )}

      {/* Security notice */}
      <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50/60 p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 leading-relaxed">
          <p className="font-semibold mb-0.5">Cryptographic Safety &amp; Non-Disclosure Policy</p>
          Sensitive credentials including JWT signing secrets, database authentication strings, Hyperledger Fabric private keys, and Dilithium PQC keypairs are managed via secure vault/environment injection and are intentionally omitted from administrative views.
        </div>
      </div>

      {/* Security Policies */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Authentication &amp; Account Security
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Thresholds controlling brute-force prevention and credential validation lifetimes.
        </p>

        <div className="divide-y divide-gray-100">
          <SettingRow
            icon={Lock}
            title="Max Failed Login Attempts"
            description="Consecutive failed authentications before temporary account lock."
            value={isLoading ? "—" : `${settings?.max_failed_login_attempts ?? 5} attempts`}
          />
          <SettingRow
            icon={Clock}
            title="Account Lock Duration"
            description="Lockout window enforced when failure threshold is exceeded."
            value={isLoading ? "—" : `${settings?.account_lock_duration_minutes ?? 30} minutes`}
          />
          <SettingRow
            icon={KeyRound}
            title="Access Token Lifetime"
            description="JWT session expiration for API authorization."
            value={isLoading ? "—" : `${settings?.access_token_expire_minutes ?? 60} minutes`}
          />
          <SettingRow
            icon={KeyRound}
            title="Refresh Token Lifetime"
            description="Cryptographic HttpOnly refresh cookie rotation period."
            value={isLoading ? "—" : `${settings?.refresh_token_expire_days ?? 7} days`}
          />
        </div>
      </div>

      {/* Core Platform Engine */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Sliders className="h-4 w-4 text-primary" />
          Platform Engine &amp; Algorithm Configuration
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Core service orchestrators and integrity engines.
        </p>

        <div className="divide-y divide-gray-100">
          <SettingRow
            icon={Cpu}
            title="Matching Engine Version"
            description="Deterministic donor-recipient HLA &amp; medical compatibility matrix."
            value={isLoading ? "—" : `v${settings?.matching_algorithm_version ?? "1.0.0"}`}
            badge="Deterministic"
          />
          <SettingRow
            icon={Server}
            title="Environment Stage"
            description="Active deployment runtime tier."
            value={isLoading ? "—" : (settings?.app_env ?? "Development").toUpperCase()}
          />
          <SettingRow
            icon={Shield}
            title="Audit Retention Window"
            description="Retention period for immutable audit logs."
            value={isLoading ? "—" : `${settings?.audit_retention_days ?? 365} days`}
          />
          <SettingRow
            icon={Shield}
            title="Continuous Tamper Monitoring"
            description="Real-time SHA-256 and Fabric ledger state parity checking."
            value={
              isLoading ? (
                "—"
              ) : settings?.security_monitoring_enabled ? (
                <span className="text-green-600 font-semibold">Enabled</span>
              ) : (
                <span className="text-red-500 font-semibold">Disabled</span>
              )
            }
          />
        </div>
      </div>

      {/* Development Tools / Data Cleanup */}
      <div className="rounded-lg border border-red-200 bg-white p-5 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-red-900 mb-2 flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-red-600" />
          Development Tools / Data Cleanup
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Safely remove development demo data. This action is restricted to Administrators.
        </p>
        
        <div className="flex items-center justify-between border-t border-red-50 pt-4 mt-4">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Delete Demo Data</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Removes seeded records (Donors, Recipients, Organs, Matches, Assessments).
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (window.confirm("Are you sure you want to delete all demo data? This cannot be undone.")) {
                try {
                  const res = await api.adminCleanupDemoData();
                  alert(`Success: ${res.message}\nDeleted:\nDonors: ${res.counts.donors}\nRecipients: ${res.counts.recipients}\nOrgans: ${res.counts.organs}\nMatches: ${res.counts.matches}\nAssessments: ${res.counts.assessments}`);
                } catch (e: any) {
                  alert(`Error: ${e.message}`);
                }
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Demo Data
          </Button>
        </div>
      </div>

    </div>
  );
}
