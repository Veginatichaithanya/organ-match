import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Link2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DetailRow,
  ErrorState,
  fmtDateTime,
  LoadingState,
  StatusBadge,
  truncHash,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/security/$eventId")({
  head: () => ({
    meta: [
      { title: "Security event — OrganMatch" },
      { name: "description", content: "Full detail of a detected security event." },
      { property: "og:title", content: "Security event — OrganMatch" },
      { property: "og:description", content: "Full detail of a detected security event." },
    ],
  }),
  component: SecurityEventPage,
});

function SecurityEventPage() {
  const { eventId } = Route.useParams();
  const { user, ready } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["security", "event", eventId],
    queryFn: () => api.getSecurityEvent(eventId),
    enabled: ready && !!user,
  });

  const resolveMutation = useMutation({
    mutationFn: () => api.resolveSecurityEvent(eventId),
    onSuccess: () => {
      toast.success("Event resolved.");
      qc.invalidateQueries({ queryKey: ["security"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Resolve failed."),
  });

  if (isLoading) return <LoadingState label="Loading event…" />;
  if (error || !data)
    return <ErrorState message={error instanceof Error ? error.message : "Event not found."} />;

  const { event, blockchainTx } = data;

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <Link
          to="/security"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to security center
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl text-foreground">{event.id}</h1>
          <StatusBadge value={event.type} />
          <StatusBadge value={event.status} />
        </div>
        {event.status !== "Resolved" && (
          <Button onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending}>
            {resolveMutation.isPending ? "Resolving…" : "Mark resolved"}
          </Button>
        )}
      </div>

      <Card className="mb-6 shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-medium">Event detail</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <dl className="divide-y divide-border">
            <DetailRow label="Type">{event.type}</DetailRow>
            <DetailRow label="Actor">{event.actor}</DetailRow>
            <DetailRow label="Role">{event.role}</DetailRow>
            <DetailRow label="Organization">{event.organization}</DetailRow>
            <DetailRow label="Operation">
              <StatusBadge value={event.operation} />
            </DetailRow>
            <DetailRow label="Target record">
              <span className="font-mono text-xs">{event.record}</span>
            </DetailRow>
            <DetailRow label="Source">{event.source}</DetailRow>
            <DetailRow label="IP address">
              <span className="font-mono text-xs">{event.ip}</span>
            </DetailRow>
            <DetailRow label="Session">
              <span className="font-mono text-xs">{event.sessionId}</span>
            </DetailRow>
            <DetailRow label="Detected at">{fmtDateTime(event.timestamp)}</DetailRow>
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-medium">Why it was flagged</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm leading-relaxed text-muted-foreground">{event.reason}</p>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-medium">Blockchain anchor</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {blockchainTx ? (
            <dl className="divide-y divide-border">
              <DetailRow label="Transaction">
                <span className="font-mono text-xs">{blockchainTx.id}</span>
              </DetailRow>
              <DetailRow label="Block height">#{blockchainTx.blockHeight}</DetailRow>
              <DetailRow label="Record hash">
                <span className="font-mono text-xs text-primary">
                  {truncHash(blockchainTx.recordHash, 14)}
                </span>
              </DetailRow>
              <DetailRow label="Verification">
                <StatusBadge value={blockchainTx.verification} />
              </DetailRow>
              <DetailRow label="Ledger">
                <Link
                  to="/blockchain"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Link2 className="h-3.5 w-3.5" /> View in ledger
                </Link>
              </DetailRow>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              No blockchain transaction is linked to this event yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
