import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/services/api";
import { RecipientRegistrationForm, type RecipientRegistrationFormValues } from "@/components/recipient-registration-form";

export const Route = createFileRoute("/_authed/recipients/new")({
  head: () => ({
    meta: [
      { title: "Register recipient — OrganMatch" },
      { name: "description", content: "Add a patient to the transplant waiting list." },
      { property: "og:title", content: "Register recipient — OrganMatch" },
      { property: "og:description", content: "Add a patient to the transplant waiting list." },
    ],
  }),
  component: NewRecipientPage,
});

function NewRecipientPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (values: RecipientRegistrationFormValues) => api.createRecipient(values),
    onSuccess: (recipient) => {
      setErrorMessage(null);
      qc.invalidateQueries({ queryKey: ["recipients"] });
      toast.success("Recipient registered successfully.", {
        description: `${recipient.name || "Patient"} has been added to the waiting list.`,
      });
      navigate({ to: "/recipients/$recipientId", params: { recipientId: recipient.id } });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error?.message ||
        err?.message ||
        "Failed to register recipient.";
      const displayMsg = typeof msg === "string" ? msg : JSON.stringify(msg);
      setErrorMessage(displayMsg);
      toast.error("Registration failed", { description: displayMsg });
    },
  });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <RecipientRegistrationForm
        submitLabel="Submit Registration"
        submitting={mutation.isPending}
        errorMessage={errorMessage}
        onSubmit={(values) => {
          setErrorMessage(null);
          mutation.mutate(values);
        }}
        onCancel={() => navigate({ to: "/recipients" })}
      />
    </div>
  );
}

