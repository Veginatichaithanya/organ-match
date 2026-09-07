import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmptyState,
  ErrorState,
  fmtDate,
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

export const Route = createFileRoute("/_authed/organs/")({
  head: () => ({
    meta: [
      { title: "Organs — OrganMatch" },
      {
        name: "description",
        content: "Live inventory of donated organs and their availability status.",
      },
      { property: "og:title", content: "Organs — OrganMatch" },
      {
        property: "og:description",
        content: "Live inventory of donated organs and their availability status.",
      },
    ],
  }),
  component: OrgansPage,
});

const ORGAN_TYPES = ["Heart", "Lungs", "Kidney", "Pancreas"];
const STATUSES = ["Available", "Under Review", "Matched", "Allocated", "Unavailable"];

function OrgansPage() {
  const { user, ready } = useAuth();
  const [search, setSearch] = useState("");
  const [organ, setOrgan] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["organs", { search, organ, status, page }],
    queryFn: () => api.listOrgans({ search, organType: organ, status, page, pageSize: 12 }),
    enabled: ready && !!user,
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title="Organ inventory"
        description="Donated organs tracked across the network."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by ID, donor, hospital…"
          className="w-full sm:w-72"
        />
        <Select
          value={organ}
          onValueChange={(v) => {
            setOrgan(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Organ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All organs</SelectItem>
            {ORGAN_TYPES.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState label="Loading organs…" />
      ) : error ? (
        <ErrorState message={error instanceof Error ? error.message : "Failed to load organs."} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No organs found" description="Try adjusting your search or filters." />
      ) : (
        <>
          <TableShell>
            <THead>
              <Th>Organ ID</Th>
              <Th>Type</Th>
              <Th>Donor</Th>
              <Th>Blood</Th>
              <Th>Hospital</Th>
              <Th>Availability</Th>
              <Th>Status</Th>
              <Th>Registered</Th>
            </THead>
            <tbody>
              {data.items.map((o) => (
                <TRow key={o.id}>
                  <Td className="font-mono text-xs font-medium">{o.id}</Td>
                  <Td>{o.organType}</Td>
                  <Td className="font-mono text-xs">{o.donorId}</Td>
                  <Td>
                    <StatusBadge value={o.bloodGroup} />
                  </Td>
                  <Td className="max-w-44 truncate text-muted-foreground">{o.hospital}</Td>
                  <Td>
                    <StatusBadge value={o.availability} />
                  </Td>
                  <Td>
                    <StatusBadge value={o.status} />
                  </Td>
                  <Td className="text-muted-foreground">{fmtDate(o.registeredAt)}</Td>
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
