import { createFileRoute } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PERMISSIONS,
  ROLE_LABELS,
  ROUTE_ACCESS,
  type PermissionAction,
  type Role,
} from "@/lib/permissions";
import { PageHeader, TableShell, Td, Th, THead, TRow } from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/permissions/")({
  head: () => ({
    meta: [
      { title: "Permissions — OrganMatch" },
      { name: "description", content: "Role-based permission matrix enforced across the system." },
      { property: "og:title", content: "Permissions — OrganMatch" },
      {
        property: "og:description",
        content: "Role-based permission matrix enforced across the system.",
      },
    ],
  }),
  component: PermissionsPage,
});

const ROLES: Role[] = ["admin", "hospital", "transplant_center", "doctor", "auditor"];
const ACTIONS: PermissionAction[] = ["view", "create", "edit", "delete", "approve"];

function PermissionMark({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <Check className="mx-auto h-4 w-4 text-success" />
  ) : (
    <X className="mx-auto h-4 w-4 text-destructive" />
  );
}

function PermissionsPage() {
  return (
    <div>
      <PageHeader
        title="Permissions"
        description="The role matrix enforced on every request. No role can delete records — delete attempts are blocked and logged as tampering events."
      />

      <Card className="mb-6 shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-medium">Action matrix</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <TableShell>
            <THead>
              <Th>Role</Th>
              {ACTIONS.map((a) => (
                <Th key={a} className="text-center capitalize">
                  {a}
                </Th>
              ))}
            </THead>
            <tbody>
              {ROLES.map((role) => (
                <TRow key={role}>
                  <Td className="font-medium">{ROLE_LABELS[role]}</Td>
                  {ACTIONS.map((action) => (
                    <Td key={action} className="text-center">
                      <PermissionMark allowed={PERMISSIONS[role][action]} />
                    </Td>
                  ))}
                </TRow>
              ))}
            </tbody>
          </TableShell>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-medium">Module access</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <TableShell>
            <THead>
              <Th>Module</Th>
              {ROLES.map((r) => (
                <Th key={r} className="text-center">
                  {ROLE_LABELS[r]}
                </Th>
              ))}
            </THead>
            <tbody>
              {ROUTE_ACCESS.map((route) => (
                <TRow key={route.prefix}>
                  <Td className="font-mono text-xs">{route.prefix}</Td>
                  {ROLES.map((role) => (
                    <Td key={role} className="text-center">
                      <PermissionMark allowed={route.roles.includes(role)} />
                    </Td>
                  ))}
                </TRow>
              ))}
            </tbody>
          </TableShell>
        </CardContent>
      </Card>
    </div>
  );
}
