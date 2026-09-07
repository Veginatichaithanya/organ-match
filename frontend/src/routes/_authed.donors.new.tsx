import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui-kit";
import { DonorForm } from "@/components/record-forms";

export const Route = createFileRoute("/_authed/donors/new")({
  head: () => ({
    meta: [
      { title: "Register donor — OrganMatch" },
      { name: "description", content: "Register a new organ donor in the network." },
      { property: "og:title", content: "Register donor — OrganMatch" },
      { property: "og:description", content: "Register a new organ donor in the network." },
    ],
  }),
  component: NewDonorPage,
});

function NewDonorPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: api.createDonor,
    onSuccess: (donor) => {
      qc.invalidateQueries({ queryKey: ["donors"] });
      toast.success(`Donor ${donor.id} registered.`);
      navigate({ to: "/donors/$donorId", params: { donorId: donor.id } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to register donor."),
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Register donor"
        description="Add a new organ donor to the network registry."
      />
      <Card className="shadow-none">
        <CardContent className="p-6">
          <DonorForm
            submitLabel="Register donor"
            submitting={mutation.isPending}
            onSubmit={(values) => mutation.mutate(values)}
            onCancel={() => navigate({ to: "/donors" })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
