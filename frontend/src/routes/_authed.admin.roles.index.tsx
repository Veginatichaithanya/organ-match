import { createFileRoute } from "@tanstack/react-router";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Info,
  Key,
  RefreshCw,
  Shield,
  ShieldCheck,
  UserCheck,
  X,
  Lock,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authed/admin/roles/")({
  head: () => ({
    meta: [{ title: "Roles & Permissions — OrganMatch Admin" }],
  }),
  component: AdminRolesPage,
});

const CANONICAL_ROLES = [
  { key: "ADMIN", name: "ADMIN", title: "ADMIN", purpose: "System administration" },
  { key: "HOSPITAL_COORDINATOR", name: "HOSPITAL_COORDINATOR", title: "Hospital Coordinator", purpose: "Hospital operations" },
  { key: "DOCTOR", name: "DOCTOR", title: "Doctor", purpose: "Medical validation" },
  { key: "ALLOCATION_AUTHORITY", name: "ALLOCATION_AUTHORITY", title: "Allocation Authority", purpose: "Organ allocation decisions" },
  { key: "AUDITOR", name: "AUDITOR", title: "Auditor", purpose: "Audit and verification" },
];

const ROLE_BADGE_STYLES: Record<string, string> = {
  ADMIN: "bg-blue-50 text-blue-700 border-blue-200/80",
  HOSPITAL_COORDINATOR: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  DOCTOR: "bg-purple-50 text-purple-700 border-purple-200/80",
  ALLOCATION_AUTHORITY: "bg-amber-50 text-amber-700 border-amber-200/80",
  AUDITOR: "bg-rose-50 text-rose-700 border-rose-200/80",
};

function AdminRolesPage() {
  const { user, ready } = useAuth();
  const [selectedPermission, setSelectedPermission] = useState<{ name: string; description?: string } | null>(null);
  const [selectedRoleKey, setSelectedRoleKey] = useState<string | null>(null);

  const {
    data: roles,
    isLoading, isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => api.adminListRoles(),
    enabled: ready && !!user,
  });

  // Map backend roles for quick lookup by name
  const roleMap = new Map<string, (typeof roles)[number]>();
  (roles ?? []).forEach((r) => roleMap.set(r.name, r));

  // Extract unique sorted permission list from backend
  const permissionMap = new Map<string, string>();
  (roles ?? []).forEach((r) => {
    r.permissions.forEach((p) => {
      if (!permissionMap.has(p.name)) {
        permissionMap.set(p.name, p.description || "System operation permission.");
      }
    });
  });

  const sortedPermissions = Array.from(permissionMap.keys()).sort();

  const selectedRoleObj = selectedRoleKey ? roleMap.get(selectedRoleKey) : null;
  const selectedRoleMeta = CANONICAL_ROLES.find((cr) => cr.name === selectedRoleKey);

  // Calculate assigned roles for selected permission
  const rolesWithSelectedPerm = selectedPermission
    ? (roles ?? []).filter((r) => r.permissions.some((p) => p.name === selectedPermission.name))
    : [];

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-700 shrink-0 shadow-2xs">
            <Key className="h-5.5 w-5.5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Roles & Permissions
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage and review role-based access permissions enforced by the system.
            </p>
          </div>
        </div>

        {/* Actions & Security Indicator Pill */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <TelemetryRefreshButton
            label="Refresh Permissions"
            onRefresh={() => refetch()}
            isFetching={isFetching}
          />
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-lg shadow-2xs">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-semibold text-emerald-900">RBAC Enforced by Backend</span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="flex flex-col items-center justify-center gap-3">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="text-sm font-medium text-slate-700">Loading roles and permissions…</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {isError && !isLoading && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-rose-900">Unable to load the RBAC configuration</h3>
              <p className="text-xs text-rose-700 mt-0.5">
                The backend authorization service could not return the roles matrix. Check JWT permissions.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-rose-300 bg-white text-rose-800 hover:bg-rose-100/50 shrink-0"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Top Five Canonical Role Cards */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              System Roles Summary
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {CANONICAL_ROLES.map((cRole) => {
                const dbRole = roleMap.get(cRole.name);
                const permCount = dbRole?.permissions.length ?? 0;
                const badgeStyle = ROLE_BADGE_STYLES[cRole.name] || "bg-slate-100 text-slate-700 border-slate-200";

                return (
                  <button
                    key={cRole.name}
                    onClick={() => setSelectedRoleKey(cRole.name)}
                    className="group text-left rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-all duration-200 hover:border-slate-300 hover:shadow-md flex flex-col justify-between h-full focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${badgeStyle}`}>
                          {cRole.title}
                        </span>
                        <Shield className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {cRole.purpose}
                      </p>
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-900">
                        {permCount} permission{permCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-[10px] font-medium text-blue-600 group-hover:underline">
                        Details →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* RBAC Permission Matrix Table */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Permission Matrix
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {sortedPermissions.length} total permissions registered
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5 min-w-[220px]">Permission Name</th>
                      {CANONICAL_ROLES.map((cRole) => (
                        <th key={cRole.name} className="px-4 py-3.5 text-center min-w-[130px]">
                          {cRole.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedPermissions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                          No permissions registered in database.
                        </td>
                      </tr>
                    ) : (
                      sortedPermissions.map((permName) => {
                        const permDesc = permissionMap.get(permName);

                        return (
                          <tr
                            key={permName}
                            onClick={() => setSelectedPermission({ name: permName, description: permDesc })}
                            className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                          >
                            {/* Permission Name & Description */}
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              <div className="flex items-center gap-2">
                                <span>{permName}</span>
                                <Info className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              {permDesc && (
                                <p className="text-[11px] font-normal text-slate-500 truncate max-w-xs mt-0.5">
                                  {permDesc}
                                </p>
                              )}
                            </td>

                            {/* Checks per Role */}
                            {CANONICAL_ROLES.map((cRole) => {
                              const rObj = roleMap.get(cRole.name);
                              const isAllowed = rObj?.permissions.some((p) => p.name === permName) ?? false;

                              return (
                                <td key={cRole.name} className="px-4 py-3 text-center">
                                  {isAllowed ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                                      <Check className="h-3 w-3 text-emerald-600" /> Allowed
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-mono text-xs">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Matrix Footer Note */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/40 text-xs text-slate-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                  Permission changes are managed by the backend authorization configuration.
                </span>
                <span className="text-[11px] text-slate-400">Click any row or role for full breakdown</span>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Permission Details Dialog */}
      <Dialog open={!!selectedPermission} onOpenChange={() => setSelectedPermission(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Key className="h-4.5 w-4.5 text-blue-600" />
              Permission: {selectedPermission?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {selectedPermission?.description || "System operation permission."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Assigned Roles ({rolesWithSelectedPerm.length})
            </h4>

            {rolesWithSelectedPerm.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Not assigned to any active role.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {rolesWithSelectedPerm.map((r) => {
                  const badgeStyle = ROLE_BADGE_STYLES[r.name] || "bg-slate-100 text-slate-700 border-slate-200";
                  return (
                    <span
                      key={r.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold border ${badgeStyle}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {r.name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setSelectedPermission(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Details Dialog */}
      <Dialog open={!!selectedRoleKey} onOpenChange={() => setSelectedRoleKey(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Shield className="h-4.5 w-4.5 text-blue-600" />
              Role: {selectedRoleMeta?.title || selectedRoleKey}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {selectedRoleMeta?.purpose || "System role definition."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Assigned Permissions ({selectedRoleObj?.permissions.length ?? 0})
              </h4>
              <Badge variant="outline" className="text-xs font-mono">
                {selectedRoleObj?.permissions.length ?? 0} Total
              </Badge>
            </div>

            <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-slate-50/30 p-1">
              {(selectedRoleObj?.permissions ?? []).length === 0 ? (
                <p className="p-3 text-xs text-slate-400 italic">No permissions assigned.</p>
              ) : (
                (selectedRoleObj?.permissions ?? []).map((p) => (
                  <div key={p.id} className="p-2.5 text-xs flex items-center justify-between hover:bg-white rounded transition-colors">
                    <div>
                      <span className="font-semibold text-slate-900">{p.name}</span>
                      {p.description && <p className="text-[11px] text-slate-500">{p.description}</p>}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      <Check className="h-3 w-3" /> Granted
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setSelectedRoleKey(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
