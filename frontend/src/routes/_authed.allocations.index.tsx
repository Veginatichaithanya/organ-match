import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Eye } from "lucide-react";
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
import {
  EmptyState,
  ErrorState,
  fmtDateTime,
  LoadingState,
  PageHeader,
  PaginationControls,
  StatusBadge,
  TableShell,
  Td,
  Th,
  THead,
  TRow,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/allocations/")({
  head: () => ({
    meta: [
      { title: "Allocations — OrganMatch" },
      {
        name: "description",
        content: "Review, approve, and track organ allocations across the network.",
      },
      { property: "og:title", content: "Allocations — OrganMatch" },
      {
        property: "og:description",
        content: "Review, approve, and track organ allocations across the network.",
      },
    ],
  }),
  component: AllocationsPage,
});

const STATUSES = ["Pending Review", "Approved", "Rejected", "Completed"];

function AllocationsPage() {
  const { user, ready, can } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["allocations", { status, page }],
    queryFn: () => api.listAllocations({ status, page, pageSize: 10 }),
    enabled: ready && !!user,
    placeholderData: keepPreviousData,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      action === "approve" ? api.approveAllocation(id) : api.rejectAllocation(id),
    onSuccess: (a) => {
      toast.success(`Allocation ${a.id} ${a.status.toLowerCase()}.`);
      qc.invalidateQueries();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Action failed.", {
        description: "The attempt may have been recorded as a security event.",
      });
      qc.invalidateQueries({ queryKey: ["security"] });
    },
  });

  return (
    <div>
      <PageHeader
        title="Allocations"
        description="Organ-to-recipient assignments awaiting or completed."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState label="Loading allocations…" />
      ) : error ? (
        <ErrorState
          message={error instanceof Error ? error.message : "Failed to load allocations."}
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={status === "Approved" ? "No approved allocations found." : "No allocations found."}
          description="There are currently no allocations matching the selected criteria."
        />
      ) : (
        <>
          <TableShell>
            <THead>
              <Th>Allocation</Th>
              <Th>Donor</Th>
              <Th>Recipient</Th>
              <Th>Organ</Th>
              <Th>Score</Th>
              <Th>Priority</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th className="text-right">Actions</Th>
            </THead>
            <tbody>
              {data.items.map((a) => {
                const rawScore = a.matchScore ?? a.match_score ?? a.compatibility_score;
                const scoreDisplay =
                  rawScore !== undefined && rawScore !== null
                    ? `${Math.round(rawScore <= 1.0 ? rawScore * 100 : rawScore)} / 100`
                    : "Not available";

                const createdDate = a.createdAt || a.created_at || a.timestamp;
                const matchId = a.matchId || a.match_id;

                return (
                  <TRow key={a.id}>
                    <Td className="font-mono text-xs font-medium text-gray-900">{a.id}</Td>
                    <Td>
                      {a.donorName ? (
                        <div>
                          <div className="font-medium text-xs text-gray-900">{a.donorName}</div>
                          {a.donorCode && (
                            <div className="font-mono text-[11px] text-muted-foreground">
                              {a.donorCode}
                            </div>
                          )}
                        </div>
                      ) : a.donorCode ? (
                        <span className="font-mono text-xs text-gray-900">{a.donorCode}</span>
                      ) : a.donorId ? (
                        <span className="font-mono text-xs text-gray-700">{a.donorId}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not available</span>
                      )}
                    </Td>
                    <Td>
                      {a.recipientName ? (
                        <div>
                          <div className="font-medium text-xs text-gray-900">{a.recipientName}</div>
                          {a.recipientCode && (
                            <div className="font-mono text-[11px] text-muted-foreground">
                              {a.recipientCode}
                            </div>
                          )}
                        </div>
                      ) : a.recipientCode ? (
                        <span className="font-mono text-xs text-gray-900">{a.recipientCode}</span>
                      ) : a.recipientId ? (
                        <span className="font-mono text-xs text-gray-700">{a.recipientId}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not available</span>
                      )}
                    </Td>
                    <Td>
                      {a.organType && a.organType !== "Not specified" ? (
                        <div>
                          <div className="font-semibold text-xs text-gray-900">{a.organType}</div>
                          {a.organCode && (
                            <div className="font-mono text-[11px] text-muted-foreground">
                              {a.organCode}
                            </div>
                          )}
                        </div>
                      ) : a.organCode ? (
                        <span className="font-mono text-xs text-gray-900">{a.organCode}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not available</span>
                      )}
                    </Td>
                    <Td>
                      {scoreDisplay !== "Not available" ? (
                        <span className="font-semibold text-xs text-gray-900">{scoreDisplay}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not available</span>
                      )}
                    </Td>
                    <Td>
                      {a.priority ? (
                        <StatusBadge value={a.priority} />
                      ) : (
                        <span className="text-xs text-muted-foreground">Not available</span>
                      )}
                    </Td>
                    <Td>
                      <div>
                        <StatusBadge value={a.status} />
                        {a.fabric_tx_id && (
                          <div
                            className="mt-1 font-mono text-[10px] text-green-700 flex items-center gap-1"
                            title={`Fabric Tx: ${a.fabric_tx_id}`}
                          >
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                            {String(a.fabric_tx_id).slice(0, 10)}…
                          </div>
                        )}
                      </div>
                    </Td>
                    <Td className="text-xs text-muted-foreground whitespace-nowrap">
                      {createdDate ? fmtDateTime(createdDate) : "Not available"}
                    </Td>
                    <Td className="text-right">
                      {a.status === "Pending Review" && can("approve") ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={reviewMutation.isPending}
                            onClick={() => reviewMutation.mutate({ id: a.id, action: "approve" })}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reviewMutation.isPending}
                            onClick={() => reviewMutation.mutate({ id: a.id, action: "reject" })}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : matchId ? (
                        <div className="flex justify-end">
                          <Link
                            to="/allocation/matches/$matchId"
                            params={{ matchId: String(matchId) }}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View Details
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {a.approvedBy ? `by ${a.approvedBy}` : "—"}
                        </span>
                      )}
                    </Td>
                  </TRow>
                );
              })}
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
