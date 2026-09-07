import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import {
  EmptyState,
  ErrorState,
  fmtDateTime,
  LoadingState,
  PageHeader,
  PaginationControls,
  SearchInput,
  StatusBadge,
  TableShell,
  Td,
  Th,
  THead,
  TRow,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/users/")({
  head: () => ({
    meta: [
      { title: "User management — OrganMatch" },
      {
        name: "description",
        content: "Manage accounts, roles, and access status across the network.",
      },
      { property: "og:title", content: "User management — OrganMatch" },
      {
        property: "og:description",
        content: "Manage accounts, roles, and access status across the network.",
      },
    ],
  }),
  component: UsersPage,
});

const ROLES: Role[] = ["admin", "hospital", "transplant_center", "doctor", "auditor"];

function UsersPage() {
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["users", { search, role, page }],
    queryFn: () => api.listUsers({ search, role, page, pageSize: 10 }),
    enabled: ready && !!user,
    placeholderData: keepPreviousData,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "Active" | "Suspended" }) =>
      api.setUserStatus(id, status),
    onSuccess: (u) => {
      toast.success(`${u.name} is now ${u.status.toLowerCase()}.`);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Status change failed."),
  });

  return (
    <div>
      <PageHeader
        title="User management"
        description="Accounts and roles across the organ network."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search name, email, organization…"
          className="w-full sm:w-72"
        />
        <Select
          value={role}
          onValueChange={(v) => {
            setRole(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState label="Loading users…" />
      ) : error ? (
        <ErrorState message={error instanceof Error ? error.message : "Failed to load users."} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No users found" description="Try adjusting your search or filters." />
      ) : (
        <>
          <TableShell>
            <THead>
              <Th>User</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Organization</Th>
              <Th>Status</Th>
              <Th>Last login</Th>
              <Th className="text-right">Actions</Th>
            </THead>
            <tbody>
              {data.items.map((u) => (
                <TRow key={u.id}>
                  <Td className="font-medium">{u.name}</Td>
                  <Td className="text-muted-foreground">{u.email}</Td>
                  <Td>
                    <StatusBadge value={ROLE_LABELS[u.role]} />
                  </Td>
                  <Td className="max-w-44 truncate text-muted-foreground">{u.organization}</Td>
                  <Td>
                    <StatusBadge value={u.status} />
                  </Td>
                  <Td className="text-muted-foreground">{fmtDateTime(u.lastLogin)}</Td>
                  <Td className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={statusMutation.isPending}
                      onClick={() =>
                        statusMutation.mutate({
                          id: u.id,
                          status: u.status === "Active" ? "Suspended" : "Active",
                        })
                      }
                    >
                      {u.status === "Active" ? "Suspend" : "Activate"}
                    </Button>
                  </Td>
                </TRow>
              ))}
            </tbody>
          </TableShell>
          <PaginationControls
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
