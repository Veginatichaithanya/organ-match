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
import { DonorRegistrationForm } from "@/components/donor-registration-form";

export const Route = createFileRoute("/_authed/donors/$donorId")({
  head: () => ({
    meta: [
      { title: "Donor record — OrganMatch" },
      { name: "description", content: "Donor record details and full change history." },
      { property: "og:title", content: "Donor record — OrganMatch" },
      { property: "og:description", content: "Donor record details and full change history." },
    ],
  }),
  component: DonorDetailPage,
});

function DonorDetailPage() {
  const { donorId } = Route.useParams();
  const { user, ready, can } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["donor", donorId],
    queryFn: () => api.getDonor(donorId),
    enabled: ready && !!user,
  });

  const updateMutation = useMutation({
    mutationFn: (values: Parameters<typeof api.updateDonor>[1]) => api.updateDonor(donorId, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["donor", donorId] });
      qc.invalidateQueries({ queryKey: ["donors"] });
      setEditOpen(false);
      toast.success("Donor record updated.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteDonor(donorId),
    onSuccess: () => {
      toast.success("Donor record deleted.");
      navigate({ to: "/donors" });
    },
    onError: (err) => {
      setDeleteOpen(false);
      toast.error(err instanceof Error ? err.message : "Delete failed.", {
        description: "The attempt was blocked and recorded as a security event.",
      });
      qc.invalidateQueries({ queryKey: ["donor", donorId] });
      qc.invalidateQueries({ queryKey: ["security"] });
    },
  });

  if (isLoading) return <LoadingState label="Loading donor record…" />;
  if (error || !data)
    return <ErrorState message={error instanceof Error ? error.message : "Donor not found."} />;

  const d = (data as any)?.donor || data;
  if (!d) return <ErrorState message="Donor record not found." />;

  return (
    <div>
      <div className="mb-5">
        <Link
          to="/donors"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to donors
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{d.name || d.id}</h1>
            <span className="font-mono text-sm text-muted-foreground">({d.id})</span>
            <StatusBadge value={d.organStatus} />
            <StatusBadge value={d.availability} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {d.organType} donor · {d.bloodGroup} · {d.hospital}
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
              <DetailRow label="Full Name">{d.name || "—"}</DetailRow>
              <DetailRow label="Age">{d.age}</DetailRow>
              <DetailRow label="Gender">{d.gender}</DetailRow>
              <DetailRow label="Blood group">
                <StatusBadge value={d.bloodGroup} />
              </DetailRow>
              <DetailRow label="Organ type">{d.organType}</DetailRow>
              <DetailRow label="Medical status">
                <StatusBadge value={d.medicalStatus} />
              </DetailRow>
              <DetailRow label="HLA profile">
                <span className="font-mono text-xs">{d.hla}</span>
              </DetailRow>
              <DetailRow label="Medical details">{d.medicalDetails || "—"}</DetailRow>
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-medium">Record metadata</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <dl className="divide-y divide-border">
              <DetailRow label="Hospital">{d.hospital}</DetailRow>
              <DetailRow label="Record status">
                <StatusBadge value={d.status} />
              </DetailRow>
              <DetailRow label="Version">v{d.version}</DetailRow>
              <DetailRow label="Created by">{d.createdBy}</DetailRow>
              <DetailRow label="Created at">{fmtDateTime(d.createdAt)}</DetailRow>
              <DetailRow label="Last edited by">{d.lastEditedBy}</DetailRow>
              <DetailRow label="Last edited at">{fmtDateTime(d.lastEditedAt)}</DetailRow>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 bg-slate-50/50">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold text-slate-900">
              Edit Donor Dossier
            </DialogTitle>
            <p className="text-xs text-slate-500 font-medium">
              Update donor registration information, contact details, and organ donation preferences.
            </p>
          </DialogHeader>
          <DonorRegistrationForm
            mode="edit"
            initial={d}
            submitLabel="Save Changes"
            submitting={updateMutation.isPending}
            onSubmit={(values) => updateMutation.mutate(values)}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete donor {d.id}?</AlertDialogTitle>
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
