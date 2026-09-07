import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
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
import {
  EmptyState,
  ErrorState,
  fmtDate,
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

export const Route = createFileRoute("/_authed/recipients/")({
  head: () => ({
    meta: [
      { title: "Recipients — OrganMatch" },
      {
        name: "description",
        content: "Browse, search, and manage patients waiting for organ transplants.",
      },
      { property: "og:title", content: "Recipients — OrganMatch" },
      {
        property: "og:description",
        content: "Browse, search, and manage patients waiting for organ transplants.",
      },
    ],
  }),
  component: RecipientsPage,
});

const ORGAN_TYPES = ["Heart", "Lungs", "Kidney", "Pancreas"];
const URGENCIES = ["Critical", "High", "Moderate", "Stable"];
const MATCH_STATUSES = ["Waiting", "Matched", "Allocated"];

function RecipientsPage() {
  const { user, ready, can } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [organType, setOrganType] = useState("");
  const [urgency, setUrgency] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["recipients", { search, organType, urgency, status, page }],
    queryFn: () => api.listRecipients({ search, organType, urgency, status, page, pageSize: 10 }),
    enabled: ready && !!user,
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title="Recipients"
        description="Patients on the transplant waiting list."
        actions={
          can("create") ? (
            <Button onClick={() => navigate({ to: "/recipients/new" })}>
              <Plus className="mr-1.5 h-4 w-4" /> New recipient
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by ID, condition, hospital…"
          className="w-full sm:w-72"
        />
        <Select
          value={organType}
          onValueChange={(v) => {
            setOrganType(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Required organ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All organs</SelectItem>
            {ORGAN_TYPES.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={urgency}
          onValueChange={(v) => {
            setUrgency(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Urgency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All urgencies</SelectItem>
            {URGENCIES.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {MATCH_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState label="Loading recipients…" />
      ) : error ? (
        <ErrorState
          message={error instanceof Error ? error.message : "Failed to load recipients."}
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No recipients found"
          description="Try adjusting your search or filters."
        />
      ) : (
        <>
          <TableShell>
            <THead>
              <Th>Recipient</Th>
              <Th>Age / Gender</Th>
              <Th>Blood</Th>
              <Th>Needs</Th>
              <Th>Priority</Th>
              <Th>Urgency</Th>
              <Th>Match status</Th>
              <Th>Listed</Th>
            </THead>
            <tbody>
              {data.items.map((r) => (
                <TRow
                  key={r.id}
                  onClick={() =>
                    navigate({ to: "/recipients/$recipientId", params: { recipientId: r.id } })
                  }
                >
                  <Td>
                    {r.name && <div className="font-medium text-foreground">{r.name}</div>}
                    <div className="font-mono text-xs text-muted-foreground">{r.id}</div>
                  </Td>
                  <Td>
                    {r.age} · {r.gender}
                  </Td>
                  <Td>
                    <StatusBadge value={r.bloodGroup} />
                  </Td>
                  <Td>{r.requiredOrgan}</Td>
                  <Td>
                    <StatusBadge value={r.priority} />
                  </Td>
                  <Td>
                    <StatusBadge value={r.urgency} />
                  </Td>
                  <Td>
                    <StatusBadge value={r.matchStatus} />
                  </Td>
                  <Td className="text-muted-foreground">{fmtDate(r.createdAt)}</Td>
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
