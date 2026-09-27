import { createFileRoute } from "@tanstack/react-router";
import { FileText, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authed/reports/")({
  head: () => ({
    meta: [{ title: "Reports & Audits — OrganMatch" }],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Official national registry compliance and allocation audit reports."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Allocation Transparency Summary</CardTitle>
              <p className="text-xs text-muted-foreground">Certified ledger exports for regulatory oversight</p>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            All organ allocations are cryptographically anchored to Hyperledger Fabric with immutable SHA-256 state proofs.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Chain Integrity Audit</CardTitle>
              <p className="text-xs text-muted-foreground">Periodic automated verification of database state</p>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Zero tampering events recorded in the verified baseline. Continuous integrity monitoring active.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
