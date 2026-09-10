import { createFileRoute } from "@tanstack/react-router";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  KeyRound,
  MoreVertical,
  Plus,
  Search,
  Shield,
  ShieldOff,
  ShieldCheck,
  UserCog,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import type { AdminUserDetail } from "@/services/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtDateTime } from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/admin/users/")({
  head: () => ({
    meta: [{ title: "User Management — OrganMatch Admin" }],
  }),
  component: AdminUsersPage,
});

const ROLES = ["ADMIN", "HOSPITAL_COORDINATOR", "DOCTOR", "ALLOCATION_AUTHORITY", "AUDITOR"];
const STATUSES = ["Active", "Suspended", "Locked", "Inactive"];

const ROLE_BADGE_STYLES: Record<string, string> = {
  ADMIN: "bg-blue-50 text-blue-700 border-blue-200/80",
  HOSPITAL_COORDINATOR: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  DOCTOR: "bg-purple-50 text-purple-700 border-purple-200/80",
  ALLOCATION_AUTHORITY: "bg-amber-50 text-amber-700 border-amber-200/80",
  AUDITOR: "bg-rose-50 text-rose-700 border-rose-200/80",
};

const ROLE_AVATAR_STYLES: Record<string, string> = {
  ADMIN: "bg-blue-100 text-blue-700 font-bold",
  HOSPITAL_COORDINATOR: "bg-emerald-100 text-emerald-700 font-bold",
  DOCTOR: "bg-purple-100 text-purple-700 font-bold",
  ALLOCATION_AUTHORITY: "bg-amber-100 text-amber-700 font-bold",
  AUDITOR: "bg-rose-100 text-rose-700 font-bold",
};

// ─── Create User Modal ─────────────────────────────────────────────────────────

function CreateUserModal({
  open,
  onClose,
  hospitals,
}: {
  open: boolean;
  onClose: () => void;
  hospitals: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    username: "",
    full_name: "",
    email: "",
    hospital_id: "",
    role_name: "DOCTOR",
    password: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.adminCreateUser({
        ...form,
        hospital_id: form.hospital_id || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
      setForm({ username: "", full_name: "", email: "", hospital_id: "", role_name: "DOCTOR", password: "" });
      setError("");
    },
    onError: (e: any) => {
      setError(e?.response?.data?.detail ?? "Failed to create user.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">Create User Account</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            A temporary password will be assigned. The user must change it on initial login.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Username *</label>
              <Input
                id="create-username"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="doctor02"
                className="h-9 text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Full Name</label>
              <Input
                id="create-fullname"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Dr. Jane Smith"
                className="h-9 text-xs"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">Email *</label>
            <Input
              id="create-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="jane@hospital.org"
              className="h-9 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Role *</label>
              <Select value={form.role_name} onValueChange={(v) => setForm((f) => ({ ...f, role_name: v }))}>
                <SelectTrigger id="create-role" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Hospital</label>
              <Select value={form.hospital_id} onValueChange={(v) => setForm((f) => ({ ...f, hospital_id: v }))}>
                <SelectTrigger id="create-hospital" className="h-9 text-xs">
                  <SelectValue placeholder="(None)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-xs">— None —</SelectItem>
                  {hospitals.map((h) => (
                    <SelectItem key={h.id} value={h.id} className="text-xs">{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">Temporary Password *</label>
            <Input
              id="create-password"
              type="text"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Min 8 characters"
              className="h-9 text-xs font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">User must change password upon first login.</p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            id="create-user-submit"
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.username || !form.email || !form.password}
          >
            {mutation.isPending ? "Creating…" : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Update / Reset Password Modal ─────────────────────────────────────────────

function ResetPasswordModal({
  user,
  onClose,
}: {
  user: AdminUserDetail | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: (pwd: string) => api.adminChangePassword(user!.id, pwd),
    onSuccess: () => {
      setSuccess(true);
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(`Password for ${user?.username} updated successfully.`);
    },
    onError: (e: any) => {
      setError(e?.response?.data?.detail ?? "Failed to update password.");
    },
  });

  const handleClose = () => {
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setError("");
    setSuccess(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newPassword || !confirmPassword) {
      setError("Please enter and confirm the new password.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please verify both fields.");
      return;
    }

    mutation.mutate(newPassword);
  };

  return (
    <Dialog open={!!user} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <KeyRound className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">Update Password</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Enter a new password twice for user <strong>{user?.username}</strong>.
          </DialogDescription>
        </DialogHeader>

        {!success ? (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {error && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5 text-xs font-medium text-rose-700 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="admin-new-password" className="text-xs font-semibold text-slate-700">
                  New Password
                </Label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium focus:outline-none"
                >
                  {showPassword ? (
                    <>
                      <EyeOff className="h-3 w-3" /> Hide
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" /> Show
                    </>
                  )}
                </button>
              </div>
              <Input
                id="admin-new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Enter new password (min. 8 chars)"
                className="text-xs"
                autoComplete="new-password"
                disabled={mutation.isPending}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-confirm-password" className="text-xs font-semibold text-slate-700">
                Confirm Password
              </Label>
              <Input
                id="admin-confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Re-enter new password to confirm"
                className="text-xs"
                autoComplete="new-password"
                disabled={mutation.isPending}
              />
              {confirmPassword && newPassword && confirmPassword !== newPassword && (
                <p className="text-[11px] text-rose-600 font-medium">Passwords do not match.</p>
              )}
              {confirmPassword && newPassword && confirmPassword === newPassword && (
                <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Passwords match
                </p>
              )}
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-[11px] text-slate-600 leading-relaxed">
              The user can immediately log in using this new password across all portals.
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button
                id="confirm-update-password"
                type="submit"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                disabled={mutation.isPending || !newPassword || !confirmPassword}
              >
                {mutation.isPending ? "Updating…" : "Update Password"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-900">Password Updated Successfully</p>
                <p className="text-xs text-emerald-700 mt-1">
                  The password for user <strong>{user?.username}</strong> has been updated. They can now log in with their new password.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button id="close-reset-success" size="sm" onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign Role Modal ─────────────────────────────────────────────────────────

function AssignRoleModal({
  user,
  onClose,
}: {
  user: AdminUserDetail | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [error, setError] = useState("");

  const assignMutation = useMutation({
    mutationFn: () => api.adminAssignRole(user!.id, selectedRole),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Failed to assign role."),
  });

  const removeMutation = useMutation({
    mutationFn: (roleName: string) => api.adminRemoveRole(user!.id, roleName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Failed to remove role."),
  });

  return (
    <Dialog open={!!user} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">Manage Roles</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Assign or remove system roles for <strong>{user?.username}</strong>.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        <div className="py-1 space-y-3">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Current Assigned Roles</p>
            {user?.roles.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No roles assigned.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {user?.roles.map((r) => (
                  <div key={r.id} className="flex items-center gap-1.5 rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs">
                    <span className="font-semibold text-slate-700">{r.name}</span>
                    <button
                      className="text-slate-400 hover:text-rose-600 transition-colors"
                      onClick={() => removeMutation.mutate(r.name)}
                      title={`Remove ${r.name}`}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Assign New Role</p>
            <div className="flex gap-2">
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger id="assign-role-select" className="flex-1 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                id="assign-role-submit"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => assignMutation.mutate()}
                disabled={assignMutation.isPending}
              >
                Assign
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Deactivate Confirm Modal ──────────────────────────────────────────────────

function StatusConfirmModal({
  user,
  targetStatus,
  onClose,
}: {
  user: AdminUserDetail | null;
  targetStatus: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.adminSetUserStatus(user!.id, targetStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Status update failed."),
  });

  const isDeactivate = targetStatus !== "Active";

  return (
    <Dialog open={!!user} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">{isDeactivate ? "Deactivate" : "Activate"} User</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {isDeactivate
              ? `Deactivating ${user?.username} will disable sign-in access.`
              : `Activating ${user?.username} will restore active system privileges.`}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700">{error}</div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            id="confirm-status-change"
            size="sm"
            variant={isDeactivate ? "destructive" : "default"}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? "Updating…"
              : isDeactivate
              ? "Deactivate"
              : "Activate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main User Management Page ─────────────────────────────────────────────────

function AdminUsersPage() {
  const { user, ready } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [resetUser, setResetUser] = useState<AdminUserDetail | null>(null);
  const [roleUser, setRoleUser] = useState<AdminUserDetail | null>(null);
  const [statusModal, setStatusModal] = useState<{ user: AdminUserDetail; target: string } | null>(null);
  const [page, setPage] = useState(1);

  const { data: users, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.adminListUsers(),
    enabled: ready && !!user,
    placeholderData: keepPreviousData,
  });

  const { data: hospitals } = useQuery({
    queryKey: ["admin", "hospitals"],
    queryFn: () => api.adminListHospitals(),
    enabled: ready && !!user,
  });

  const filtered = (users ?? []).filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.full_name ?? "").toLowerCase().includes(q);
    const matchRole = !roleFilter || u.role === roleFilter;
    const matchStatus = !statusFilter || u.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-700 shrink-0 shadow-2xs">
            <Users className="h-5.5 w-5.5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              User Management
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Create, edit, activate/deactivate users and manage role assignments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <TelemetryRefreshButton
            label="Refresh Users"
            onRefresh={() => refetch()}
            isFetching={isFetching}
          />
          <Button
            id="create-user-btn"
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-4 shadow-xs"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Create User
          </Button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="user-search"
            placeholder="Search username, email, name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-9 text-xs border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger id="role-filter" className="h-9 w-full sm:w-44 text-xs border-slate-200 bg-white">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" className="text-xs font-medium text-slate-700">All Roles</SelectItem>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="status-filter" className="h-9 w-full sm:w-36 text-xs border-slate-200 bg-white">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" className="text-xs font-medium text-slate-700">All Statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-medium text-rose-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          Failed to load users list. Please try refreshing.
        </div>
      )}

      {/* User Table Card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5 whitespace-nowrap">Username</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Full Name</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Email</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Role</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Hospital</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Status</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Last Login</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Created</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      Loading user accounts…
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    No users matching current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const roleKey = u.role ?? "DOCTOR";
                  const avatarStyle = ROLE_AVATAR_STYLES[roleKey] || "bg-slate-100 text-slate-700 font-bold";
                  const badgeStyle = ROLE_BADGE_STYLES[roleKey] || "bg-slate-100 text-slate-700 border-slate-200";
                  const firstLetter = (u.username[0] || "U").toUpperCase();
                  const isActive = u.status === "Active";

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Username + Avatar */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs shrink-0 ${avatarStyle}`}>
                            {firstLetter}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {u.username}
                          </span>
                        </div>
                      </td>

                      {/* Full Name */}
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                        {u.full_name || "—"}
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                        {u.email}
                      </td>

                      {/* Role Badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {u.role ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${badgeStyle}`}>
                            {u.role}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Hospital */}
                      <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap font-medium">
                        {u.hospital_name || "—"}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            {u.status}
                          </span>
                        )}
                        {u.must_change_password && (
                          <span className="ml-1.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            Pwd Change Req.
                          </span>
                        )}
                      </td>

                      {/* Last Login */}
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap text-[11px]">
                        {u.last_login_at ? fmtDateTime(u.last_login_at) : "Never"}
                      </td>

                      {/* Created Date */}
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap text-[11px]">
                        {fmtDateTime(u.created_at)}
                      </td>

                      {/* Actions Menu */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-400 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700 transition-colors ml-auto">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel className="text-xs text-slate-500">Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setRoleUser(u)} className="text-xs">
                              <UserCog className="h-3.5 w-3.5 mr-2 text-slate-500" /> Manage Roles
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setResetUser(u)} className="text-xs">
                              <KeyRound className="h-3.5 w-3.5 mr-2 text-slate-500" /> Update Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {isActive ? (
                              <DropdownMenuItem
                                onClick={() => setStatusModal({ user: u, target: "Suspended" })}
                                className="text-xs text-rose-600 focus:text-rose-700 focus:bg-rose-50"
                              >
                                <ShieldOff className="h-3.5 w-3.5 mr-2" /> Deactivate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => setStatusModal({ user: u, target: "Active" })}
                                className="text-xs text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50"
                              >
                                <ShieldCheck className="h-3.5 w-3.5 mr-2" /> Activate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer & Pagination Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/40">
          <p className="text-xs text-slate-500 font-medium">
            Showing {filtered.length} of {users?.length ?? 0} users
          </p>

          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="flex h-7 min-w-[28px] items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-2 text-xs font-semibold text-blue-700">
              1
            </span>
            <button
              disabled
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Security Information Footer Banner */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 text-xs font-medium text-blue-900 flex items-center gap-2.5 shadow-2xs">
        <Shield className="h-4 w-4 text-blue-600 shrink-0" />
        <span>Ensure roles and permissions are assigned properly to maintain system security and data integrity.</span>
      </div>

      {/* Modals */}
      <CreateUserModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        hospitals={(hospitals ?? []).map((h) => ({ id: h.id, name: h.name }))}
      />
      <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
      <AssignRoleModal user={roleUser} onClose={() => setRoleUser(null)} />
      <StatusConfirmModal
        user={statusModal?.user ?? null}
        targetStatus={statusModal?.target ?? "Active"}
        onClose={() => setStatusModal(null)}
      />
    </div>
  );
}
