import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Eye,
  FileText,
  Search,
  Stethoscope,
  Waves,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, fmtDate } from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/doctor/organs/")({
  head: () => ({
    meta: [{ title: "Organ Medical Reviews — Doctor Console" }],
  }),
  component: DoctorOrgansPage,
});

function DoctorOrgansPage() {
  const { user, ready } = useAuth();
  const [search, setSearch] = useState("");

  const { data: organs, isLoading, error } = useQuery({
    queryKey: ["doctor", "organs"],
    queryFn: () => api.doctorListOrgans(),
    enabled: ready && !!user,
  });

  const filtered = (organs ?? []).filter((o: any) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (o.organ_code && o.organ_code.toLowerCase().includes(q)) ||
      (o.organ_type && o.organ_type.toLowerCase().includes(q)) ||
      (o.blood_group && o.blood_group.toLowerCase().includes(q)) ||
      (o.status && o.status.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Waves className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-semibold text-gray-900">Organ Medical Reviews</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Review organ medical specifications, preservation parameters, and clinical viability.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organ type, code, blood group, status…"
            className="pl-9 bg-white"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Organ Code", "Organ Type", "Blood Group", "Donor ID", "Viability / Status", "HLA Information", "Actions"].map((h) => (
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
                    Loading organ inventory…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-red-600">
                    Failed to load organ records.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">
                    No organ records found matching search filter.
                  </td>
                </tr>
              ) : (
                filtered.map((o: any) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900 whitespace-nowrap">
                      {o.organ_code}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="font-semibold text-xs bg-blue-50 text-blue-700 border-blue-200">
                        {o.organ_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="font-mono text-xs bg-red-50 text-red-700 border-red-200">
                        {o.blood_group}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600 whitespace-nowrap">
                      {o.donor_id ? o.donor_id.slice(0, 8) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge value={o.status || "AVAILABLE"} />
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600 max-w-xs truncate">
                      {o.hla_info ? (
                        typeof o.hla_info === "string" ? o.hla_info : JSON.stringify(o.hla_info)
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to="/doctor/donors/$donorId" params={{ donorId: o.donor_id }}>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50">
                          <Stethoscope className="h-3.5 w-3.5" />
                          Review Donor/Organ
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
