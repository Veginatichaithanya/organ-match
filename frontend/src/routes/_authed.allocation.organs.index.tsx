import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Waves } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatusBadge, fmtDateTime } from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/allocation/organs/")({
  head: () => ({
    meta: [{ title: "Available Organs — Allocation Authority" }],
  }),
  component: AllocationOrgansPage,
});

function AllocationOrgansPage() {
  const { user, ready } = useAuth();
  const [search, setSearch] = useState("");

  const { data: organs, isLoading, error } = useQuery({
    queryKey: ["allocation", "organs"],
    queryFn: () => api.allocationListOrgans(),
    enabled: ready && !!user,
  });

  const filtered = (organs ?? []).filter((o: any) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (o.organ_code && o.organ_code.toLowerCase().includes(q)) ||
      (o.organ_type && o.organ_type.toLowerCase().includes(q)) ||
      (o.blood_group && o.blood_group.toLowerCase().includes(q)) ||
      (o.donor_code && o.donor_code.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Waves className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-semibold text-gray-900">Available Organs</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Registered donor organs available for matching engine evaluation and allocation assignment.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by organ code, type, blood group, donor code…"
            className="pl-9 bg-white"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Organ Code", "Organ Type", "Blood Group", "Donor Code", "Medical Status", "Availability", "Registered Date"].map((h) => (
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
                    Loading available organs…
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
                    No organs found matching search filter.
                  </td>
                </tr>
              ) : (
                filtered.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900 whitespace-nowrap">
                      {item.organ_code}
                    </td>
                    <td className="px-4 py-3 font-medium text-xs text-gray-900 whitespace-nowrap">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {item.organ_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-red-600 whitespace-nowrap">
                      {item.blood_group}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                      {item.donor_code}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge value={item.medical_status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className={item.availability === "AVAILABLE" ? "bg-green-50 text-green-700 border-green-200 text-xs" : "bg-gray-50 text-gray-700 border-gray-200 text-xs"}>
                        {item.availability}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                      {fmtDateTime(item.created_at)}
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
