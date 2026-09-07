import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DetailRow,
  ErrorState,
  fmtDateTime,
  HistoryTimeline,
  LoadingState,
  StatusBadge,
} from "@/components/ui-kit";
import { RecipientForm } from "@/components/record-forms";

export const Route = createFileRoute("/_authed/recipients/$recipientId")({
  head: () => ({
    meta: [
      { title: "Recipient record — OrganMatch" },
      { name: "description", content: "Recipient record details and full change history." },
      { property: "og:title", content: "Recipient record — OrganMatch" },
      { property: "og:description", content: "Recipient record details and full change history." },
    ],
  }),
  component: RecipientDetailPage,
});

function RecipientDetailPage() {
  const { recipientId } = Route.useParams();
  const { user, ready, can } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["recipient", recipientId],
    queryFn: () => api.getRecipient(recipientId),
    enabled: ready && !!user,
  });

  const updateMutation = useMutation({
    mutationFn: (values: Parameters<typeof api.updateRecipient>[1]) =>
      api.updateRecipient(recipientId, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipient", recipientId] });
      qc.invalidateQueries({ queryKey: ["recipients"] });
      setEditOpen(false);
      toast.success("Recipient record updated.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteRecipient(recipientId),
    onSuccess: () => {
      toast.success("Recipient record deleted.");
      navigate({ to: "/recipients" });
    },
    onError: (err) => {
      setDeleteOpen(false);
      toast.error(err instanceof Error ? err.message : "Delete failed.", {
        description: "The attempt was blocked and recorded as a security event.",
      });
      qc.invalidateQueries({ queryKey: ["security"] });
      qc.invalidateQueries({ queryKey: ["recipient", recipientId] });
    },
  });

  if (isLoading) return <LoadingState label="Loading recipient record…" />;
  if (error || !data)
    return <ErrorState message={error instanceof Error ? error.message : "Recipient not found."} />;

  const r = (data as any)?.recipient || data;
  if (!r) return <ErrorState message="Recipient record not found." />;

  return (
    <div>
      <div className="mb-5">
        <Link
          to="/recipients"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to recipients
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{r.name || r.id}</h1>
            <span className="font-mono text-sm text-muted-foreground">({r.id})</span>
            <StatusBadge value={r.matchStatus} />
            <StatusBadge value={r.urgency} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Needs {r.requiredOrgan} · {r.bloodGroup} · {r.hospital}
          </p>
        </div>
        <div className="flex gap-2">
          {can("edit") && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" /> Edit
            </Button>
          )}
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/5"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-medium">Clinical details</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <dl className="divide-y divide-border">
              <DetailRow label="Full Name">{r.name || "—"}</DetailRow>
              <DetailRow label="Age">{r.age}</DetailRow>
              <DetailRow label="Gender">{r.gender}</DetailRow>
              <DetailRow label="Blood group">
                <StatusBadge value={r.bloodGroup} />
              </DetailRow>
              <DetailRow label="Required organ">{r.requiredOrgan}</DetailRow>
              <DetailRow label="Priority">
                <StatusBadge value={r.priority} />
              </DetailRow>
              <DetailRow label="Urgency">
                <StatusBadge value={r.urgency} />
              </DetailRow>
              <DetailRow label="Suitability">
                <StatusBadge value={r.medicalSuitability} />
              </DetailRow>
              <DetailRow label="HLA profile">
                <span className="font-mono text-xs">{r.hla}</span>
              </DetailRow>
              <DetailRow label="Condition">{r.medicalCondition}</DetailRow>
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-medium">Record metadata</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <dl className="divide-y divide-border">
              <DetailRow label="Hospital">{r.hospital}</DetailRow>
              <DetailRow label="Record status">
                <StatusBadge value={r.status} />
              </DetailRow>
              <DetailRow label="Version">v{r.version}</DetailRow>
              <DetailRow label="Created by">{r.createdBy}</DetailRow>
              <DetailRow label="Created at">{fmtDateTime(r.createdAt)}</DetailRow>
              <DetailRow label="Last edited by">{r.lastEditedBy}</DetailRow>
              <DetailRow label="Last edited at">{fmtDateTime(r.lastEditedAt)}</DetailRow>
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium">Change history</CardTitle>
          </CardHeader>
          <CardContent>
            <HistoryTimeline entries={data.history} />
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit recipient {r.id}</DialogTitle>
          </DialogHeader>
          <RecipientForm
            initial={r}
            submitLabel="Save changes"
            submitting={updateMutation.isPending}
            onSubmit={(values) => updateMutation.mutate(values)}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete recipient {r.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              Record deletion is restricted by the permission matrix. Unauthorized attempts are
              blocked and recorded in the security center as tampering events.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? "Deleting…" : "Attempt delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
