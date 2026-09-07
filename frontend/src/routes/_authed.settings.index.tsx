import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailRow, PageHeader } from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/settings/")({
  head: () => ({
    meta: [
      { title: "Settings — OrganMatch" },
      { name: "description", content: "User account and session details." },
      { property: "og:title", content: "Settings — OrganMatch" },
      { property: "og:description", content: "User account and session details." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="User account and session details." />

      <Card className="mb-6 shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-medium">Current session</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <dl className="divide-y divide-border">
            <DetailRow label="Signed in as">{user?.name}</DetailRow>
            <DetailRow label="Email">{user?.email}</DetailRow>
            <DetailRow label="Role">{user ? ROLE_LABELS[user.role] : "—"}</DetailRow>
            <DetailRow label="Organization">{user?.organization}</DetailRow>
          </dl>
          <div className="mt-4">
            <Button variant="outline" onClick={logout}>
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
