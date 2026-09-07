export type Role = "admin" | "hospital" | "transplant_center" | "doctor" | "auditor";

export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  hospital: "Hospital",
  transplant_center: "Transplant Center",
  doctor: "Doctor",
  auditor: "Auditor",
};

/**
 * Role permission matrix. Mirrors the backend authorization rules —
 * the UI only reflects these, the (mock) API enforces them again.
 */
export const PERMISSIONS: Record<Role, Record<PermissionAction, boolean>> = {
  admin: { view: true, create: true, edit: true, delete: false, approve: true },
  hospital: { view: true, create: true, edit: true, delete: false, approve: false },
  transplant_center: { view: true, create: false, edit: true, delete: false, approve: true },
  doctor: { view: true, create: false, edit: true, delete: false, approve: false },
  auditor: { view: true, create: false, edit: false, delete: false, approve: false },
};

export function hasPermission(role: Role, action: PermissionAction): boolean {
  return PERMISSIONS[role]?.[action] ?? false;
}

/**
 * Route-level access control. Each entry lists the roles allowed under a
 * path prefix. Evaluated against the current pathname, longest prefix wins.
 */
const ALL_ROLES: Role[] = ["admin", "hospital", "transplant_center", "doctor", "auditor"];

export const ROUTE_ACCESS: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/dashboard", roles: ALL_ROLES },
  { prefix: "/donors", roles: ALL_ROLES },
  { prefix: "/recipients", roles: ALL_ROLES },
  { prefix: "/organs", roles: ALL_ROLES },
  { prefix: "/matching", roles: ALL_ROLES },
  { prefix: "/allocation", roles: ALL_ROLES },
  { prefix: "/blockchain", roles: ALL_ROLES },
  { prefix: "/users", roles: ["admin"] },
  { prefix: "/hospitals", roles: ["admin"] },
  { prefix: "/permissions", roles: ["admin"] },
  { prefix: "/settings", roles: ALL_ROLES },
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/coordinator", roles: ["hospital"] },
  { prefix: "/doctor", roles: ["doctor"] },
];

export function canAccessPath(role: Role, pathname: string): boolean {
  const match = ROUTE_ACCESS.filter(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"),
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  if (!match) return true; // unlisted paths are allowed once authenticated
  return match.roles.includes(role);
}

export function getDashboardForRole(role: string | null | undefined): string {
  if (!role) return "/dashboard";
  const r = role.toLowerCase();
  if (r === "admin") return "/admin";
  if (r === "hospital" || r === "hospital_coordinator") return "/coordinator";
  if (r === "doctor") return "/doctor";
  if (r === "transplant_center" || r === "allocation_authority" || r === "allocation") return "/allocation";
  return "/dashboard";
}

