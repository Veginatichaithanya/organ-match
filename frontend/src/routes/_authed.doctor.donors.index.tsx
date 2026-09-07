import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Eye,
  FileText,
  HeartHandshake,
  Search,
  Stethoscope,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, fmtDate } from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/doctor/donors/")({
  head: () => ({
    meta: [{ title: "Donor Medical Reviews — Doctor Console" }],
  }),
  component: DoctorDonorsPage,
});

function DoctorDonorsPage() {
  const { user, ready } = useAuth();
  const [search, setSearch] = useState("");

  const { data: donors, isLoading, error } = useQuery({
    queryKey: ["doctor", "donors"],
    queryFn: () => api.doctorListDonors(),
    enabled: ready && !!user,
  });

  const filtered = (donors ?? []).filter((d: any) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (d.donor_code && d.donor_code.toLowerCase().includes(q)) ||
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.blood_group && d.blood_group.toLowerCase().includes(q)) ||
      (d.medical_status && d.medical_status.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <HeartHandshake className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-semibold text-gray-900">Donor Medical Reviews</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Review medical background, HLA profiles, and organ viability for hospital-linked donors.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, blood group, medical status…"
            className="pl-9 bg-white"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Donor Code", "Age / Gender", "Blood Group", "Medical Status", "HLA Info", "Registered Organs", "Actions"].map((h) => (
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
                    Loading hospital donors…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-red-600">
                    Failed to load donor records.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">
                    No donor records found matching search filter.
                  </td>
                </tr>
              ) : (
                filtered.map((d: any) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900 whitespace-nowrap">
                      {d.donor_code}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {d.age} yrs / {d.gender}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="font-mono text-xs bg-red-50 text-red-700 border-red-200">
                        {d.blood_group}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge value={d.medical_status || "PENDING"} />
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600 max-w-xs truncate">
                      {d.hla_info ? (
                        typeof d.hla_info === "string" ? d.hla_info : JSON.stringify(d.hla_info)
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {Array.isArray(d.organs) ? d.organs.length : 0} organ(s)
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to="/doctor/donors/$donorId" params={{ donorId: d.id }}>
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
