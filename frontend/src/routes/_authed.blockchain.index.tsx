import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Boxes,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  Database,
  FileText,
  Fingerprint,
  Hash,
  Info,
  Layers,
  Link2,
  Network,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import {
  EmptyState,
  ErrorState,
  fmtDateTime,
  LoadingState,
  PaginationControls,
  truncHash,
} from "@/components/ui-kit";
import type { BlockchainTransaction } from "@/services/types";

export const Route = createFileRoute("/_authed/blockchain/")({
  head: () => ({
    meta: [
      { title: "Blockchain Ledger — OrganMatch" },
      {
        name: "description",
        content:
          "Read-only verification of allocation state against the immutable Hyperledger Fabric ledger.",
      },
      { property: "og:title", content: "Blockchain Ledger — OrganMatch" },
      {
        property: "og:description",
        content:
          "Read-only verification of allocation state against the immutable Hyperledger Fabric ledger.",
      },
    ],
  }),
  component: BlockchainPage,
});

const STATUS_FILTERS = [
  "VERIFIED",
  "TAMPERING_DETECTED",
  "FABRIC_OFFLINE",
  "NOT_ANCHORED",
  "PENDING_VERIFICATION",
] as const;

interface VerificationModalState {
  isOpen: boolean;
  isLoading: boolean;
  error?: string | null;
  data?: {
    is_valid: boolean;
    verification_result: string;
    status: string;
    fabric_tx_id?: string;
    record_id?: string;
    record_type?: string;
    channel?: string;
    chaincode?: string;
    computed_hash?: string;
    fabric_state_hash?: string;
    stored_hash?: string;
    details?: string;
  } | null;
}

function UnavailableText() {
  return (
    <span className="font-mono text-xs text-slate-400 italic">UNAVAILABLE</span>
  );
}

export function BlockchainPage() {
  const { user, ready } = useAuth();
  const [search, setSearch] = useState("");
  const [verification, setVerification] = useState("");
  const [page, setPage] = useState(1);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [verifyModal, setVerifyModal] = useState<VerificationModalState>({
    isOpen: false,
    isLoading: false,
    error: null,
    data: null,
  });

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["blockchain", { search, verification, page }],
    queryFn: () =>
      api.listBlockchain({ search, verification, page, pageSize: 15 }),
    enabled: ready && !!user,
    placeholderData: keepPreviousData,
  });

  const verifyMutation = useMutation({
    mutationFn: async (tx: BlockchainTransaction) => {
      setVerifyModal({
        isOpen: true,
        isLoading: true,
        error: null,
        data: null,
      });
      const res = await api.verifyBlockchainTx(tx.fabricTxId || tx.id);
      return res;
    },
    onSuccess: (resData: any) => {
      setVerifyModal({
        isOpen: true,
        isLoading: false,
        error: null,
        data: resData,
      });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Hyperledger Fabric ledger verification failed.";
      setVerifyModal({
        isOpen: true,
        isLoading: false,
        error: msg,
        data: null,
      });
    },
  });

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2000);
  };

  const rawItems = data?.items ?? [];
  const filteredItems = rawItems.filter((b) => {
    if (!verification || verification === "all" || verification === "ALL")
      return true;
    const itemStatus = (b.verification_status || b.verification || "")
      .toString()
      .trim()
      .toUpperCase();
    return itemStatus === verification.trim().toUpperCase();
  });

  const latest = filteredItems[0] || rawItems[0];
  const latestFabricHash =
    latest?.fabricStateHash || latest?.recordHash || latest?.payloadHash || null;
  const currentVerificationStatus =
    latest?.verification_status || latest?.verification || "PENDING_VERIFICATION";
  const currentLedgerStatus = latest?.ledger_status || latest?.status || "CONFIRMED";

  const channelName = latest?.channel || "organ-donation-channel";
  const chaincodeName = latest?.chaincode || "organ-contract";

  return (
    <div className="space-y-6 pb-12">
      {/* ── 1. HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
            <Link2 className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Blockchain Ledger
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Read-only verification of allocation state against the immutable
              Hyperledger Fabric ledger.
            </p>
          </div>
        </div>

        {/* Right Technology Card */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-4 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 shadow-2xs">
            <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
              <div className="grid grid-cols-2 gap-0.5 h-4 w-4 text-orange-500">
                <span className="h-1.5 w-1.5 rounded-xs bg-orange-500" />
                <span className="h-1.5 w-1.5 rounded-xs bg-blue-600" />
                <span className="h-1.5 w-1.5 rounded-xs bg-blue-600" />
                <span className="h-1.5 w-1.5 rounded-xs bg-orange-500" />
              </div>
              <span>Hyperledger Fabric</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div className="text-xs space-y-0.5">
              <div className="flex items-center gap-1.5 text-slate-500">
                <span>Channel:</span>
                <span className="font-mono font-medium text-slate-800">
                  {channelName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <span>Chaincode:</span>
                <span className="font-mono font-medium text-slate-800">
                  {chaincodeName}
                </span>
              </div>
            </div>
          </div>

          <TelemetryRefreshButton
            label="Refresh Ledger"
            onRefresh={() => refetch()}
            isFetching={isFetching}
          />
        </div>
      </div>

      {/* ── 2. TOP THREE SUMMARY CARDS ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CARD 1: Block Height */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-700">
                Block Height
              </div>
              <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                {latest && latest.blockHeight != null ? (
                  `#${latest.blockHeight}`
                ) : (
                  <span className="text-xl font-bold text-slate-900">
                    UNAVAILABLE
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Block metadata unavailable from the current Fabric verification API.
          </p>
        </div>

        {/* CARD 2: Immutable Fabric Hash */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              <Hash className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-700">
                Immutable Fabric Hash
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-base sm:text-lg font-bold text-slate-900 truncate">
                  {latestFabricHash ? truncHash(latestFabricHash) : "—"}
                </span>
                {latestFabricHash && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(latestFabricHash, "card-hash")}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Copy full Fabric hash"
                  >
                    {copiedKey === "card-hash" ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <p className="text-xs text-slate-500">
              Retrieved from Hyperledger Fabric
            </p>
            <div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                Trusted Source: Hyperledger Fabric
              </span>
            </div>
          </div>
        </div>

        {/* CARD 3: Verification Status */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-700">
                Verification Status
              </div>
              <div className="mt-1">
                {currentVerificationStatus === "VERIFIED" ||
                currentVerificationStatus === "CONFIRMED" ? (
                  <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/80">
                    VERIFIED
                  </span>
                ) : currentVerificationStatus === "TAMPERING_DETECTED" ? (
                  <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                    TAMPERING_DETECTED
                  </span>
                ) : currentVerificationStatus === "FABRIC_OFFLINE" ? (
                  <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">
                    FABRIC_OFFLINE
                  </span>
                ) : currentVerificationStatus === "NOT_ANCHORED" ? (
                  <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    NOT_ANCHORED
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
                    PENDING_VERIFICATION
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <p className="text-xs text-slate-500">
              {currentVerificationStatus === "VERIFIED" ||
              currentVerificationStatus === "CONFIRMED"
                ? "Database state matches the immutable Fabric ledger anchor."
                : currentVerificationStatus === "TAMPERING_DETECTED"
                ? "Database state differs from the immutable Fabric ledger anchor."
                : currentVerificationStatus === "FABRIC_OFFLINE"
                ? "Fabric verification is currently unavailable."
                : currentVerificationStatus === "NOT_ANCHORED"
                ? "Allocation is not yet anchored on Hyperledger Fabric."
                : "Verification evaluation in progress."}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>Ledger:</span>
              <span className="font-semibold text-emerald-700 font-mono">
                {currentLedgerStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. SEARCH + STATUS FILTER BAR ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by hash, actor, record, TX ID..."
            className="w-full h-10 pl-9 pr-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
          />
        </div>

        <Select
          value={verification || "all"}
          onValueChange={(v) => {
            setVerification(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40 h-10 rounded-xl bg-white border-slate-200 text-sm font-medium">
            <SelectValue placeholder="All states" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter Badges (Pills) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((s) => {
            const isSelected = verification === s;
            let pillClasses = "";
            if (s === "VERIFIED") {
              pillClasses = isSelected
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100";
            } else if (s === "TAMPERING_DETECTED") {
              pillClasses = isSelected
                ? "bg-red-600 text-white border-red-600"
                : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100";
            } else if (s === "FABRIC_OFFLINE") {
              pillClasses = isSelected
                ? "bg-orange-600 text-white border-orange-600"
                : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100";
            } else if (s === "NOT_ANCHORED") {
              pillClasses = isSelected
                ? "bg-slate-600 text-white border-slate-600"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100";
            } else {
              pillClasses = isSelected
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
            }

            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setVerification(isSelected ? "" : s);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${pillClasses}`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 4. TRANSACTION TABLE ─────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingState label="Loading ledger from Hyperledger Fabric..." />
      ) : error ? (
        <ErrorState
          message={
            error instanceof Error ? error.message : "Failed to load ledger."
          }
        />
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
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">BLOCK</th>
                  <th className="py-3 px-4">TX ID</th>
                  <th className="py-3 px-4">OPERATION</th>
                  <th className="py-3 px-4">RECORD</th>
                  <th className="py-3 px-4">ACTOR</th>
                  <th className="py-3 px-4">RECORD HASH (Fabric)</th>
                  <th className="py-3 px-4">PREVIOUS HASH</th>
                  <th className="py-3 px-4">VERIFICATION</th>
                  <th className="py-3 px-4">TIME</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((b) => {
                  const txId = b.fabricTxId || "";
                  const recordId = b.recordId || "";
                  const recordHash =
                    b.fabricStateHash || b.recordHash || b.payloadHash || "";
                  const vStatus =
                    (b.verification_status || b.verification || "").toUpperCase();
                  const isVerified =
                    vStatus === "VERIFIED" || vStatus === "CONFIRMED";

                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-slate-50/60 transition-colors"
                      data-fabric-tx={txId}
                    >
                      {/* BLOCK */}
                      <td className="py-3.5 px-4 font-mono">
                        {b.blockHeight != null ? (
                          `#${b.blockHeight}`
                        ) : (
                          <UnavailableText />
                        )}
                      </td>

                      {/* TX ID */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                        {txId ? (
                          <div
                            className="flex items-center gap-1.5"
                            title={txId}
                          >
                            <span>{truncHash(txId, 8)}</span>
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(txId, `tx-${b.id}`)
                              }
                              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Copy full TX ID"
                            >
                              {copiedKey === `tx-${b.id}` ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <UnavailableText />
                        )}
                      </td>

                      {/* OPERATION */}
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {b.operation || "ApproveAllocation"}
                      </td>

                      {/* RECORD */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-blue-600 hover:underline cursor-pointer">
                          Allocation ({recordId ? recordId.slice(0, 8) : "—"})
                        </span>
                      </td>

                      {/* ACTOR */}
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {b.actor ? b.actor : <UnavailableText />}
                      </td>

                      {/* RECORD HASH (Fabric) */}
                      <td className="py-3.5 px-4">
                        {recordHash ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 font-mono text-blue-600 font-medium">
                              <span>{truncHash(recordHash)}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  copyToClipboard(recordHash, `hash-${b.id}`)
                                }
                                className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Copy Fabric Hash"
                              >
                                {copiedKey === `hash-${b.id}` ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                            <div>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                                Fabric ledger
                              </span>
                            </div>
                          </div>
                        ) : (
                          <UnavailableText />
                        )}
                      </td>

                      {/* PREVIOUS HASH */}
                      <td className="py-3.5 px-4 font-mono">
                        {b.previousHash ? (
                          truncHash(b.previousHash)
                        ) : (
                          <UnavailableText />
                        )}
                      </td>

                      {/* VERIFICATION */}
                      <td className="py-3.5 px-4">
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            VERIFIED
                          </span>
                        ) : vStatus === "TAMPERING_DETECTED" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                            <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                            TAMPERING_DETECTED
                          </span>
                        ) : vStatus === "FABRIC_OFFLINE" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                            FABRIC_OFFLINE
                          </span>
                        ) : vStatus === "NOT_ANCHORED" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            NOT_ANCHORED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                            PENDING_VERIFICATION
                          </span>
                        )}
                      </td>

                      {/* TIME */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-medium">
                        {fmtDateTime(b.timestamp)}
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => verifyMutation.mutate(b)}
                            disabled={verifyMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium px-3 py-1.5 h-8 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>Verify Proof</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              copyToClipboard(txId, `act-copy-${b.id}`)
                            }
                            className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 rounded-lg text-xs font-medium px-2.5 py-1.5 h-8 flex items-center gap-1.5 cursor-pointer"
                          >
                            {copiedKey === `act-copy-${b.id}` ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            <span>Copy TX</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-100 px-4 py-3">
            <PaginationControls
              page={data?.page ?? page}
              pageSize={data?.pageSize ?? 15}
              total={filteredItems.length}
              onPage={setPage}
            />
          </div>
        </div>
      )}

      {/* ── 5. VERIFY PROOF MODAL ────────────────────────────────────────── */}
      <Dialog
        open={verifyModal.isOpen}
        onOpenChange={(open) =>
          setVerifyModal((curr) => ({ ...curr, isOpen: open }))
        }
      >
        <DialogContent className="sm:max-w-3xl rounded-2xl p-6 bg-white border-slate-200 shadow-xl">
          <DialogHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
              <DialogTitle className="text-lg font-bold text-slate-900">
                Fabric Integrity Verification
              </DialogTitle>
            </div>
          </DialogHeader>

          {verifyModal.isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
              <p className="text-xs text-slate-500 font-medium">
                Evaluating cryptographic state on Hyperledger Fabric ledger...
              </p>
            </div>
          ) : verifyModal.error ? (
            <div className="py-6 space-y-4">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
                {verifyModal.error}
              </div>
            </div>
          ) : verifyModal.data ? (
            <div className="pt-4 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Transaction Metadata */}
                <div className="space-y-4">
                  {/* Record */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                      <FileText className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-500">
                        Record
                      </div>
                      <div className="font-semibold text-blue-600 text-sm">
                        Allocation (
                        {verifyModal.data.record_id
                          ? verifyModal.data.record_id.slice(0, 8)
                          : "—"}
                        )
                      </div>
                    </div>
                  </div>

                  {/* Fabric Transaction ID */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                      <Fingerprint className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-500">
                        Fabric Transaction ID
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs font-medium text-slate-900 truncate">
                          {verifyModal.data.fabric_tx_id
                            ? truncHash(verifyModal.data.fabric_tx_id, 12)
                            : "—"}
                        </span>
                        {verifyModal.data.fabric_tx_id && (
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                verifyModal.data?.fabric_tx_id || "",
                                "modal-tx"
                              )
                            }
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Copy full TX ID"
                          >
                            {copiedKey === "modal-tx" ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Channel */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                      <Network className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-500">
                        Channel
                      </div>
                      <div className="text-sm font-medium text-slate-900">
                        {verifyModal.data.channel || "organ-donation-channel"}
                      </div>
                    </div>
                  </div>

                  {/* Chaincode */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                      <Cpu className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-500">
                        Chaincode
                      </div>
                      <div className="text-sm font-medium text-slate-900">
                        {verifyModal.data.chaincode || "organ-contract"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Verification Result & Hashes */}
                <div className="space-y-4">
                  {/* Result Card */}
                  {verifyModal.data.is_valid ||
                  verifyModal.data.verification_result === "VERIFIED" ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-center gap-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0 shadow-2xs">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                          Verification Result
                        </div>
                        <div className="text-xl font-bold text-emerald-700">
                          VERIFIED
                        </div>
                        <p className="text-xs text-emerald-600 mt-0.5">
                          Database state matches the immutable Fabric ledger anchor.
                        </p>
                      </div>
                    </div>
                  ) : verifyModal.data.verification_result === "TAMPERING_DETECTED" ? (
                    <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 flex items-center gap-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shrink-0 shadow-2xs">
                        <ShieldAlert className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-red-800">
                          Verification Result
                        </div>
                        <div className="text-xl font-bold text-red-700">
                          TAMPERING_DETECTED
                        </div>
                        <p className="text-xs text-red-600 mt-0.5">
                          Database state does not match the immutable Fabric ledger anchor.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-4 flex items-center gap-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white shrink-0">
                        <ShieldAlert className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-orange-800">
                          Verification Result
                        </div>
                        <div className="text-xl font-bold text-orange-700">
                          {verifyModal.data.verification_result || "FABRIC_OFFLINE"}
                        </div>
                        <p className="text-xs text-orange-600 mt-0.5">
                          Fabric verification is currently unavailable.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Two Hash Boxes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Database Hash */}
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-700 shrink-0">
                          <Database className="h-4 w-4" />
                        </div>
                        <div className="text-xs font-semibold text-slate-700 leading-tight">
                          Current Database State Hash{" "}
                          <span className="text-[10px] text-slate-400 font-normal">
                            (PostgreSQL)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-xs font-semibold text-slate-800 truncate">
                          {verifyModal.data.computed_hash
                            ? truncHash(verifyModal.data.computed_hash)
                            : "—"}
                        </span>
                        {verifyModal.data.computed_hash && (
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                verifyModal.data?.computed_hash || "",
                                "modal-db-hash"
                              )
                            }
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                            title="Copy full DB Hash"
                          >
                            {copiedKey === "modal-db-hash" ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Fabric Immutable Hash */}
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-700 shrink-0">
                          <Boxes className="h-4 w-4" />
                        </div>
                        <div className="text-xs font-semibold text-slate-700 leading-tight">
                          Immutable Fabric State Hash{" "}
                          <span className="text-[10px] text-blue-600 font-normal">
                            (Hyperledger Fabric)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-xs font-semibold text-slate-800 truncate">
                          {verifyModal.data.fabric_state_hash ||
                          verifyModal.data.stored_hash
                            ? truncHash(
                                verifyModal.data.fabric_state_hash ||
                                  verifyModal.data.stored_hash ||
                                  ""
                              )
                            : "—"}
                        </span>
                        {(verifyModal.data.fabric_state_hash ||
                          verifyModal.data.stored_hash) && (
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                verifyModal.data?.fabric_state_hash ||
                                  verifyModal.data?.stored_hash ||
                                  "",
                                "modal-fabric-hash"
                              )
                            }
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                            title="Copy full Fabric Hash"
                          >
                            {copiedKey === "modal-fabric-hash" ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Explanation Banner */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  Verification compares the current PostgreSQL allocation state
                  with the immutable state hash stored on Hyperledger Fabric.
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
