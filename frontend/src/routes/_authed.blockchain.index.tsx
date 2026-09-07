import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Boxes, Hash, ShieldCheck } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  fmtDateTime,
  LoadingState,
  PageHeader,
  PaginationControls,
  SearchInput,
  TableShell,
  Td,
  Th,
  THead,
  TRow,
  truncHash,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authed/blockchain/")({
  head: () => ({
    meta: [
      { title: "Blockchain ledger — OrganMatch" },
      { name: "description", content: "Allocation record hashes anchored on Hyperledger Fabric and verified against current database state." },
      { property: "og:title", content: "Blockchain ledger — OrganMatch" },
      {
        property: "og:description",
        content: "Allocation record hashes anchored on Hyperledger Fabric and verified against current database state.",
      },
    ],
  }),
  component: BlockchainPage,
});

const VERIFICATIONS = ["CONFIRMED", "PENDING_VERIFICATION", "FABRIC_OFFLINE", "NOT_ANCHORED", "TAMPERING_DETECTED"];

/** Maps verification status strings to badge color classes */
function verificationBadgeClass(v: string): string {
  const upper = (v || "").toUpperCase();
  if (upper === "CONFIRMED") return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  if (upper === "TAMPERING_DETECTED") return "bg-red-100 text-red-800 border border-red-200 font-bold";
  if (upper === "PENDING_VERIFICATION") return "bg-amber-100 text-amber-700 border border-amber-200";
  if (upper === "FABRIC_OFFLINE") return "bg-orange-100 text-orange-700 border border-orange-200";
  if (upper === "NOT_ANCHORED") return "bg-slate-100 text-slate-600 border border-slate-200";
  return "bg-slate-100 text-slate-500 border border-slate-200";
}

function VerificationBadge({ value }: { value?: string | null }) {
  const label = value || "UNKNOWN";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${verificationBadgeClass(label)}`}>
      {label}
    </span>
  );
}

function UnavailableSpan() {
  return <span className="font-mono text-xs text-muted-foreground italic">UNAVAILABLE</span>;
}

function BlockchainPage() {
  const { user, ready } = useAuth();
  const [search, setSearch] = useState("");
  const [verification, setVerification] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["blockchain", { search, verification, page }],
    queryFn: () => api.listBlockchain({ search, verification, page, pageSize: 15 }),
    enabled: ready && !!user,
    placeholderData: keepPreviousData,
  });

  // Strict canonical state filter: relies solely on backend verification_status field
  const rawItems = data?.items ?? [];
  const filteredItems = rawItems.filter((b) => {
    if (!verification || verification === "all" || verification === "ALL") return true;
    const itemStatus = (b.verification_status || b.verification || "").toString().trim().toUpperCase();
    return itemStatus === verification.trim().toUpperCase();
  });

  const latest = filteredItems[0];
  // Latest record hash from DB submission log (payload_hash) — display only, NOT Fabric anchor
  const latestRecordHash = latest?.payloadHash ?? latest?.recordHash ?? null;

  return (
    <div>
      <PageHeader
        title="Blockchain ledger"
        description="Allocation record hashes are anchored on Hyperledger Fabric and verified against the current database state."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="shadow-none">
          <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
            <Boxes className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Block height
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Block height requires a live Fabric ledger-info query which is not
                available via the current gateway library. Always UNAVAILABLE. */}
            <p className="text-2xl text-foreground">
              {latest
                ? (latest.blockHeight != null ? `#${latest.blockHeight}` : <span className="text-base text-muted-foreground italic">UNAVAILABLE</span>)
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
            <Hash className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Latest payload hash
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="truncate font-mono text-sm text-foreground">
              {latestRecordHash ? truncHash(latestRecordHash) : "—"}
            </p>
            {latestRecordHash && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Local submission hash — not Fabric-verified in this view
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
            <ShieldCheck className="h-5 w-5 text-success" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Latest verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latest ? (
              <VerificationBadge value={latest.verification_status || latest.verification} />
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
            {latest?.fabricAnchorStatus && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Status: {latest.fabricAnchorStatus}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by hash, actor, record…"
          className="w-full sm:w-80"
        />
        <Select
          value={verification || "all"}
          onValueChange={(v) => {
            setVerification(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Verification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            {VERIFICATIONS.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState label="Loading ledger…" />
      ) : error ? (
        <ErrorState message={error instanceof Error ? error.message : "Failed to load ledger."} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="No transactions"
          description={
            verification
              ? `No blockchain transactions found with verification state '${verification}'.`
              : "Transactions are appended when allocations are approved and anchored on Hyperledger Fabric."
          }
        />
      ) : (
        <>
          <TableShell>
            <THead>
              <Th>Block</Th>
              <Th>Tx ID</Th>
              <Th>Operation</Th>
              <Th>Record</Th>
              <Th>Actor</Th>
              <Th>Record hash</Th>
              <Th>Previous hash</Th>
              <Th>Verification</Th>
              <Th>Time</Th>
            </THead>
            <tbody>
              {filteredItems.map((b) => (
                <TRow key={b.id}>
                  <Td className="font-mono text-xs font-medium">
                    {b.blockHeight != null ? `#${b.blockHeight}` : <UnavailableSpan />}
                  </Td>
                  <Td className="font-mono text-xs" title={b.fabricTxId ?? ""}>
                    {b.fabricTxId
                      ? truncHash(b.fabricTxId, 8)
                      : <UnavailableSpan />}
                  </Td>
                  <Td className="font-mono text-xs">{b.operation}</Td>
                  <Td className="font-mono text-xs text-muted-foreground">{b.record}</Td>
                  <Td className="max-w-40 truncate text-muted-foreground">
                    {b.actor != null ? b.actor : <UnavailableSpan />}
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-primary">
                      {b.recordHash ? truncHash(b.recordHash) : <UnavailableSpan />}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-muted-foreground">
                      {b.previousHash != null ? truncHash(b.previousHash) : <UnavailableSpan />}
                    </span>
                  </Td>
                  <Td>
                    <VerificationBadge value={b.verification_status || b.verification} />
                  </Td>
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {fmtDateTime(b.timestamp)}
                  </Td>
                </TRow>
              ))}
            </tbody>
          </TableShell>
          <PaginationControls
            page={data?.page ?? page}
            pageSize={data?.pageSize ?? 15}
            total={filteredItems.length}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
