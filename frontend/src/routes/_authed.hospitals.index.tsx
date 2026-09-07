import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PaginationControls,
  SearchInput,
  StatusBadge,
  TableShell,
  Td,
  Th,
  THead,
  TRow,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/hospitals/")({
  head: () => ({
    meta: [
      { title: "Hospitals — OrganMatch" },
      {
        name: "description",
        content: "Hospitals and transplant centers participating in the network.",
      },
      { property: "og:title", content: "Hospitals — OrganMatch" },
      {
        property: "og:description",
        content: "Hospitals and transplant centers participating in the network.",
      },
    ],
  }),
  component: HospitalsPage,
});

function HospitalsPage() {
  const { user, ready } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["hospitals", { search, page }],
    queryFn: () => api.listHospitals({ search, page, pageSize: 10 }),
    enabled: ready && !!user,
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title="Hospitals"
        description="Hospitals and transplant centers participating in the network."
      />

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name or location…"
          className="w-full sm:w-80"
        />
      </div>

      {isLoading ? (
        <LoadingState label="Loading hospitals…" />
      ) : error ? (
        <ErrorState
          message={error instanceof Error ? error.message : "Failed to load hospitals."}
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No hospitals found" description="Try adjusting your search." />
      ) : (
        <>
          <TableShell>
            <THead>
              <Th>Hospital</Th>
              <Th>Organization</Th>
              <Th>Location</Th>
              <Th>Users</Th>
              <Th>Active records</Th>
              <Th>Status</Th>
            </THead>
            <tbody>
              {data.items.map((h) => (
                <TRow key={h.id}>
                  <Td className="font-medium">{h.name}</Td>
                  <Td className="text-muted-foreground">{h.organization}</Td>
                  <Td className="text-muted-foreground">{h.location}</Td>
                  <Td>{h.users}</Td>
                  <Td>{h.activeRecords}</Td>
                  <Td>
                    <StatusBadge value={h.status} />
                  </Td>
                </TRow>
              ))}
            </tbody>
          </TableShell>
          <PaginationControls
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
