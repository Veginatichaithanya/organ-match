import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
// allocate uses the "create" permission — enforced by the mock API
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Shuffle, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import type { MatchResult } from "@/services/types";

export const Route = createFileRoute("/_authed/matching/")({
  head: () => ({
    meta: [
      { title: "Matching — OrganMatch" },
      {
        name: "description",
        content: "Run compatibility scoring to match available donors with waiting recipients.",
      },
      { property: "og:title", content: "Matching — OrganMatch" },
      {
        property: "og:description",
        content: "Run compatibility scoring to match available donors with waiting recipients.",
      },
    ],
  }),
  component: MatchingPage,
});

const COMPONENT_MAX = { blood: 25, medical: 30, hla: 25, priority: 20 } as const;
const COMPONENT_LABELS = {
  blood: "Blood compatibility",
  medical: "Medical compatibility",
  hla: "Tissue / HLA",
  priority: "Priority & urgency",
} as const;

function ScoreBreakdown({ result }: { result: MatchResult }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(Object.keys(COMPONENT_MAX) as Array<keyof typeof COMPONENT_MAX>).map((k) => (
        <div key={k}>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{COMPONENT_LABELS[k]}</span>
            <span className="font-medium text-foreground">
              {result.components[k]}/{COMPONENT_MAX[k]}
            </span>
          </div>
          <Progress value={(result.components[k] / COMPONENT_MAX[k]) * 100} className="h-1.5" />
        </div>
      ))}
    </div>
  );
}

function MatchingPage() {
  const { user, ready, can } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [donorId, setDonorId] = useState("");
  const [results, setResults] = useState<MatchResult[] | null>(null);

  const donorsQuery = useQuery({
    queryKey: ["donors", "matchable"],
    queryFn: () => api.listDonors({ availability: "Available", pageSize: 100 }),
    enabled: ready && !!user,
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => api.runMatching(id),
    onSuccess: (r) => {
      setResults(r);
      if (r.length === 0) toast.info("No eligible recipients found for this donor.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Matching failed.");
    },
  });

  const allocateMutation = useMutation({
    mutationFn: ({ recipientId }: { recipientId: string }) =>
      api.createAllocation(donorId, recipientId),
    onSuccess: (a) => {
      toast.success(`Allocation ${a.id} created and pending review.`);
      qc.invalidateQueries();
      navigate({ to: "/allocations" });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Allocation failed.", {
        description: "The attempt may have been recorded as a security event.",
      });
      qc.invalidateQueries({ queryKey: ["security"] });
    },
  });

  return (
    <div>
      <PageHeader
        title="Organ matching"
        description="Score an available donor against the waiting list."
      />

      <Card className="mb-6 shadow-none">
        <CardContent className="flex flex-wrap items-end gap-3 p-5">
          <div className="w-full sm:w-80">
            <label className="mb-1.5 block text-sm text-muted-foreground">Available donor</label>
            <Select value={donorId} onValueChange={setDonorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a donor…" />
              </SelectTrigger>
              <SelectContent>
                {(donorsQuery.data?.items ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.id} · {d.organType} · {d.bloodGroup}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!donorId || runMutation.isPending}
            onClick={() => runMutation.mutate(donorId)}
          >
            <Shuffle className="mr-1.5 h-4 w-4" />
            {runMutation.isPending ? "Scoring…" : "Run matching"}
          </Button>
        </CardContent>
      </Card>

      {runMutation.isPending ? (
        <LoadingState label="Computing compatibility scores…" />
      ) : results === null ? (
        <EmptyState
          title="No matching run yet"
          description="Select an available donor and run the matching engine to see ranked recipients."
        />
      ) : results.length === 0 ? (
        <EmptyState
          title="No eligible recipients"
          description="No waiting recipients are compatible with this donor right now."
        />
      ) : (
        <div className="space-y-4">
          {results.map((m) => (
            <Card key={m.id} className="shadow-none">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    #{m.rank}
                  </span>
                  <div>
                    <CardTitle className="text-base font-medium">
                      Recipient{" "}
                      <Link
                        to="/recipients/$recipientId"
                        params={{ recipientId: m.recipientId }}
                        className="font-mono text-primary hover:underline"
                      >
                        {m.recipientId}
                      </Link>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {m.organType} · priority {m.priority}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={m.status} />
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-sm font-semibold",
                      m.score >= 75
                        ? "bg-success/10 text-success"
                        : m.score >= 50
                          ? "bg-warning/15 text-warning-foreground"
                          : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {m.score}/100
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScoreBreakdown result={m} />
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border pt-3">
                  {m.eligibility.map((e) => (
                    <span
                      key={e.label}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      {e.passed ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-destructive" />
                      )}
                      {e.label}
                    </span>
                  ))}
                </div>
                {can("create") && m.status !== "Ineligible" && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={allocateMutation.isPending}
                      onClick={() => allocateMutation.mutate({ recipientId: m.recipientId })}
                    >
                      Allocate organ
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
