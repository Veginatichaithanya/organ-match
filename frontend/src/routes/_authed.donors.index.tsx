import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authed/donors/")({
  head: () => ({
    meta: [
      { title: "Donors — OrganMatch" },
      { name: "description", content: "Browse, search, and manage registered organ donors." },
      { property: "og:title", content: "Donors — OrganMatch" },
      {
        property: "og:description",
        content: "Browse, search, and manage registered organ donors.",
      },
    ],
  }),
  component: DonorsPage,
});

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const ORGAN_TYPES = ["Heart", "Lungs", "Kidney", "Pancreas"];

function DonorsPage() {
  const { user, ready, can } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [blood, setBlood] = useState("");
  const [organ, setOrgan] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["donors", { search, blood, organ, page }],
    queryFn: () =>
      api.listDonors({ search, bloodGroup: blood, organType: organ, page, pageSize: 10 }),
    enabled: ready && !!user,
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title="Donors"
        description="Registered organ donors across the network."
        actions={
          can("create") ? (
            <Button onClick={() => navigate({ to: "/donors/new" })}>
              <Plus className="mr-1.5 h-4 w-4" /> New donor
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by ID, hospital, HLA…"
          className="w-full sm:w-72"
        />
        <Select
          value={blood}
          onValueChange={(v) => {
            setBlood(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Blood group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All blood groups</SelectItem>
            {BLOOD_GROUPS.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      </div>

      {isLoading ? (
        <LoadingState label="Loading donors…" />
      ) : error ? (
        <ErrorState message={error instanceof Error ? error.message : "Failed to load donors."} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No donors found" description="Try adjusting your search or filters." />
      ) : (
        <>
          <TableShell>
            <THead>
              <Th>Donor</Th>
              <Th>Age / Gender</Th>
              <Th>Blood</Th>
              <Th>Organ</Th>
              <Th>Hospital</Th>
              <Th>Status</Th>
              <Th>Registered</Th>
            </THead>
            <tbody>
              {data.items.map((d) => (
                <TRow
                  key={d.id}
                  onClick={() => navigate({ to: "/donors/$donorId", params: { donorId: d.id } })}
                >
                  <Td>
                    {d.name && <div className="font-medium text-foreground">{d.name}</div>}
                    <div className="font-mono text-xs text-muted-foreground">{d.id}</div>
                  </Td>
                  <Td>
                    {d.age} · {d.gender}
                  </Td>
                  <Td>
                    <StatusBadge value={d.bloodGroup} />
                  </Td>
                  <Td>{d.organType}</Td>
                  <Td className="max-w-44 truncate text-muted-foreground">{d.hospital}</Td>
                  <Td>
                    <StatusBadge value={d.organStatus} />
                  </Td>
                  <Td className="text-muted-foreground">{fmtDate(d.createdAt)}</Td>
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
