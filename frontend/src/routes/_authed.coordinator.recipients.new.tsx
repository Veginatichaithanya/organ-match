import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { RecipientRegistrationForm, type RecipientRegistrationFormValues } from "@/components/recipient-registration-form";

export const Route = createFileRoute("/_authed/coordinator/recipients/new")({
  head: () => ({
    meta: [
      { title: "Register Recipient — OrganMatch Coordinator" },
      { name: "description", content: "Add a patient to the waiting list for this hospital." },
    ],
  }),
  component: CoordinatorNewRecipientPage,
});

function CoordinatorNewRecipientPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (values: RecipientRegistrationFormValues) => api.createRecipient(values),
    onSuccess: (created) => {
      setErrorMessage(null);
      qc.invalidateQueries({ queryKey: ["recipients"] });
      qc.invalidateQueries({ queryKey: ["coordinator", "overview"] });
      qc.invalidateQueries({ queryKey: ["coordinator", "recipients"] });
      toast.success("Recipient registered successfully.", {
        description: `${created.name || "Patient"} has been added to the ${user?.organization || "Hospital"} waiting list.`,
      });
      navigate({
        to: "/coordinator/recipients/$recipientId",
        params: { recipientId: created.id },
      });
    },
    onError: (err: any) => {
      console.error("Recipient registration error:", err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error?.message ||
        err?.message ||
        "Recipient registration could not be completed. Your information has been preserved. Please correct the highlighted fields or try again.";
      const displayMsg = typeof msg === "string" ? msg : JSON.stringify(msg);
      setErrorMessage(displayMsg);
      toast.error("Registration failed", { description: displayMsg });
    },
  });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <RecipientRegistrationForm
        submitLabel="Submit Registration"
        submitting={createMutation.isPending}
        errorMessage={errorMessage}
        hospitalName={user?.organization || "Hospital Facility"}
        onSubmit={(v) => {
          setErrorMessage(null);
          createMutation.mutate(v);
        }}
        onCancel={() => navigate({ to: "/coordinator/recipients" })}
      />
    </div>
  );
}

