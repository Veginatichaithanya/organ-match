import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Eye,
  FileText,
  Search,
  Stethoscope,
  Users,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, fmtDate } from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/doctor/recipients/")({
  head: () => ({
    meta: [{ title: "Recipient Medical Reviews — Doctor Console" }],
  }),
  component: DoctorRecipientsPage,
});

function DoctorRecipientsPage() {
  const { user, ready } = useAuth();
  const [search, setSearch] = useState("");

  const { data: recipients, isLoading, error } = useQuery({
    queryKey: ["doctor", "recipients"],
    queryFn: () => api.doctorListRecipients(),
    enabled: ready && !!user,
  });

  const filtered = (recipients ?? []).filter((r: any) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (r.recipient_code && r.recipient_code.toLowerCase().includes(q)) ||
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.required_organ && r.required_organ.toLowerCase().includes(q)) ||
      (r.blood_group && r.blood_group.toLowerCase().includes(q)) ||
      (r.urgency && r.urgency.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Users className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-semibold text-gray-900">Recipient Medical Reviews</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Evaluate recipient waitlist readiness, urgency status, and clinical compatibility requirements.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, required organ, blood group, urgency…"
            className="pl-9 bg-white"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Recipient Code", "Age / Gender", "Blood Group", "Required Organ", "Urgency Status", "HLA Information", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">
                    Loading recipient waitlist…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-red-600">
                    Failed to load recipient records.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">
                    No recipient records found matching search filter.
                  </td>
                </tr>
              ) : (
                filtered.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900 whitespace-nowrap">
                      {r.recipient_code}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {r.age} yrs / {r.gender}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="font-mono text-xs bg-red-50 text-red-700 border-red-200">
                        {r.blood_group}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="font-semibold text-xs bg-blue-50 text-blue-700 border-blue-200">
                        {r.required_organ}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={
                          r.urgency === "HIGH" || r.urgency === "CRITICAL"
                            ? "bg-red-50 text-red-700 border-red-200 text-xs font-semibold"
                            : r.urgency === "MEDIUM"
                            ? "bg-amber-50 text-amber-700 border-amber-200 text-xs"
                            : "bg-gray-50 text-gray-700 border-gray-200 text-xs"
                        }
                      >
                        {r.urgency || "NORMAL"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600 max-w-xs truncate">
                      {r.hla_info ? (
                        typeof r.hla_info === "string" ? r.hla_info : JSON.stringify(r.hla_info)
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to="/doctor/recipients/$recipientId" params={{ recipientId: r.id }}>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50">
                          <Stethoscope className="h-3.5 w-3.5" />
                          Review Medical Record
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
