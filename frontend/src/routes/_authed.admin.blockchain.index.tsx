import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  Fingerprint,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { fmtDateTime, truncHash, SearchInput } from "@/components/ui-kit";
import type { BlockchainTransaction } from "@/services/types";

export const Route = createFileRoute("/_authed/admin/blockchain/")({
  head: () => ({
    meta: [{ title: "Blockchain Verification — OrganMatch Admin" }],
  }),
  component: AdminBlockchainPage,
});

const VERIFICATIONS = ["CONFIRMED", "PENDING_VERIFICATION", "FABRIC_OFFLINE", "NOT_ANCHORED", "TAMPERING_DETECTED"] as const;

interface VerificationResult {
  is_valid: boolean;
  status: string;
  verification_result: string;
  fabric_tx_id?: string;
  record_id?: string;
  record_type?: string;
  operation?: string;
  fabric_state_hash?: string;
  computed_hash?: string;
  stored_hash?: string;
  payload_hash?: string;
  organization?: string;
  actor?: string;
  fabric_timestamp?: string;
  channel?: string;
  chaincode?: string;
  details?: string;
  message?: string;
}

function LedgerStatusBadge({ status }: { status: string }) {
  const upper = (status || "").toUpperCase();
  if (upper === "VERIFIED" || upper === "CONFIRMED" || upper === "CONFIRMED_ON_LEDGER") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
        CONFIRMED
      </span>
    );
  }
  if (upper === "PENDING" || upper === "PENDING_VERIFICATION") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
        PENDING
      </span>
    );
  }
  if (upper === "FABRIC_OFFLINE") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200/80">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500 inline-block" />
        FABRIC OFFLINE
      </span>
    );
  }
  if (upper === "NOT_ANCHORED") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500 inline-block" />
        NOT ANCHORED
      </span>
    );
  }
  if (upper === "TAMPERING_DETECTED" || upper === "TAMPERED") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-300 font-bold">
        <span className="h-1.5 w-1.5 rounded-full bg-red-600 inline-block" />
        TAMPERING DETECTED
      </span>
    );
  }
  if (upper === "FAILED" || upper === "HASH_MISMATCH" || upper === "VERIFICATION FAILED") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block" />
        FAILED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 inline-block" />
      NOT CONFIGURED
    </span>
  );
}

function AdminBlockchainPage() {
  const { user, ready } = useAuth();
  const [search, setSearch] = useState("");
  const [verification, setVerification] = useState("");
  const [verifyingTxId, setVerifyingTxId] = useState<string | null>(null);
  const [verifyModal, setVerifyModal] = useState<VerificationResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const { data: pagedTx, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["admin", "blockchain_transactions", { search, verification }],
    queryFn: () => api.listBlockchain({ search, verification, pageSize: 100 }),
    enabled: ready && !!user,
  });

  const rawTransactions = pagedTx?.items ?? [];
  const transactions = rawTransactions.filter((tx) => {
    if (!verification || verification === "all" || verification === "ALL") return true;
    const itemStatus = (tx.verification_status || tx.verification || "").toString().trim().toUpperCase();
    return itemStatus === verification.trim().toUpperCase();
  });

  const verifyMutation = useMutation({
    mutationFn: async (tx: BlockchainTransaction) => {
      setVerifyingTxId(tx.fabricTxId || tx.id);
      setVerifyError(null);
      const res = await api.verifyBlockchainTx(tx.fabricTxId || tx.id);
      return res as VerificationResult;
    },
    onSuccess: (data) => {
      setVerifyModal(data);
      setVerifyingTxId(null);
    },
    onError: (err: any) => {
      const errMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Hyperledger Fabric ledger verification failed or network endpoint unreachable.";
      setVerifyError(errMsg);
      setVerifyingTxId(null);
    },
  });

  const handleCopyHash = (hash: string) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 border border-purple-100 text-purple-700 shrink-0 shadow-2xs">
            <ShieldCheck className="h-5.5 w-5.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Blockchain Verification
              </h1>
              <Badge variant="outline" className="text-xs font-semibold bg-purple-50 text-purple-700 border-purple-200">
                Hyperledger Fabric Anchor
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Read-only audit of cryptographic block headers, state payload hashes, and on-demand chain verification.
            </p>
          </div>
        </div>

        <TelemetryRefreshButton
          label="Refresh Ledger"
          onRefresh={() => refetch()}
          isFetching={isFetching}
        />
      </div>

      {/* Verification Error Panel */}
      {verifyError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
            <span className="text-xs font-medium text-rose-900">{verifyError}</span>
          </div>
          <Button size="sm" variant="ghost" className="text-xs text-rose-700 hover:bg-rose-100" onClick={() => setVerifyError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Query Failure Alert */}
      {isError && !isLoading && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          Failed to retrieve blockchain transactions from database node. Check connection settings.
        </div>
      )}

      {/* Search and Canonical Verification Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v) => setSearch(v)}
          placeholder="Search by hash, actor, record…"
          className="w-full sm:w-80"
        />
        <Select
          value={verification || "all"}
          onValueChange={(v) => setVerification(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-52">
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

      {/* Main Transactions Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5 min-w-[160px]">Transaction ID</th>
                <th className="px-4 py-3.5 text-center min-w-[100px]">Block Height</th>
                <th className="px-4 py-3.5 min-w-[180px]">Record / Entity</th>
                <th className="px-4 py-3.5 min-w-[140px]">Operation</th>
                <th className="px-4 py-3.5 min-w-[200px]">Payload Hash</th>
                <th className="px-4 py-3.5 min-w-[140px]">Timestamp</th>
                <th className="px-4 py-3.5 text-center min-w-[130px]">Ledger Status</th>
                <th className="px-4 py-3.5 text-right min-w-[120px]">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                      <span>Reading transaction blocks from peer channel…</span>
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    {verification
                      ? `No blockchain transactions found with verification state '${verification}'.`
                      : "No blockchain transaction records committed yet."}
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                   const displayTxId = tx.fabricTxId || null;
                  const displayHash = tx.payloadHash || tx.recordHash || "";
                  const displayBlock = tx.blockNumber ?? tx.blockHeight;
                  const isNotAnchored = tx.fabricAnchorStatus === "NOT_ANCHORED";
                  const isFabricOffline = tx.fabricAnchorStatus === "FABRIC_OFFLINE";

                  return (
                    <tr key={tx.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isNotAnchored ? "bg-amber-50/40" : ""
                      }`}>
                      {/* Transaction ID — warn if NOT_ANCHORED */}
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {isNotAnchored && (
                          <span className="inline-block mr-1.5 text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-sans" title="This transaction ID is synthetic (fab_tx_ prefix). The record was submitted when Fabric was offline and is NOT anchored on the real ledger.">
                            NOT ANCHORED
                          </span>
                        )}
                        {isFabricOffline && (
                          <span className="inline-block mr-1.5 text-[10px] bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded font-sans" title="Fabric is currently offline. Cannot verify this transaction.">
                            FABRIC OFFLINE
                          </span>
                        )}
                        {displayTxId ? (
                          <span title={displayTxId}>
                            {displayTxId.length > 16 ? `${displayTxId.slice(0, 14)}…` : displayTxId}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-sans font-normal text-xs">UNAVAILABLE</span>
                        )}
                      </td>

                       {/* Block Height */}
                       <td className="px-4 py-3 text-center font-mono font-semibold text-purple-700 whitespace-nowrap">
                         {displayBlock != null
                           ? `#${displayBlock}`
                           : <span className="text-slate-400 font-sans font-normal text-xs">UNAVAILABLE</span>}
                       </td>

                      {/* Record / Entity */}
                      <td className="px-4 py-3 text-slate-800 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{tx.recordType || "Allocation"}</div>
                        <div className="text-[11px] font-mono text-slate-400 truncate max-w-[160px]">
                          {tx.recordId || "—"}
                        </div>
                      </td>

                      {/* Operation */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {tx.operation || "ApproveAllocation"}
                        </span>
                      </td>

                      {/* Payload Hash + Copy Button */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono">
                        {displayHash ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 text-[11px]" title={displayHash}>
                              {truncHash(displayHash, 8)}
                            </span>
                            <button
                              onClick={() => handleCopyHash(displayHash)}
                              className="p-1 text-slate-400 hover:text-slate-700 transition-colors rounded hover:bg-slate-100"
                              title="Copy SHA-256 Payload Hash"
                            >
                              {copiedHash === displayHash ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-sans">—</span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="px-4 py-3 text-slate-500 font-mono whitespace-nowrap text-[11px]">
                        {tx.createdAt ? fmtDateTime(tx.createdAt) : "—"}
                      </td>

                       {/* Ledger Status */}
                       <td className="px-4 py-3 text-center whitespace-nowrap">
                         <LedgerStatusBadge status={tx.fabricAnchorStatus || tx.status} />
                       </td>

                      {/* Verify Proof Action */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={verifyingTxId === displayTxId || verifyMutation.isPending}
                          onClick={() => verifyMutation.mutate(tx)}
                          className="h-7 text-xs gap-1 border-purple-200 bg-purple-50/50 text-purple-700 hover:bg-purple-100"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
                          {verifyingTxId === displayTxId ? "Verifying…" : "Verify Proof"}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/40 text-xs text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <Fingerprint className="h-3.5 w-3.5 text-purple-600" />
            Hyperledger Fabric ledger anchors and SHA-256 payload hashes are immutable.
          </span>
          <span className="text-[11px] text-slate-400">Total: {transactions.length} records</span>
        </div>
      </div>

      {/* Verification Result Modal */}
      <Dialog open={!!verifyModal} onOpenChange={() => setVerifyModal(null)}>
        <DialogContent className="sm:max-w-[580px] w-[95vw] p-6 sm:p-7 gap-5 rounded-2xl border border-slate-200 bg-white shadow-xl">
          {/* Header */}
          <DialogHeader className="space-y-1.5 text-left">
            <div className="flex items-center gap-2.5">
              {verifyModal?.is_valid ? (
                <CheckCircle2 className="h-5.5 w-5.5 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-5.5 w-5.5 text-rose-600 shrink-0" />
              )}
              <DialogTitle className="text-lg font-bold tracking-tight text-slate-900">
                {verifyModal?.is_valid ? "Proof Cryptographically Verified" : "Integrity Verification Result"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 font-sans pl-8">
              Fabric Tx ID:{" "}
              <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80">
                {verifyModal?.fabric_tx_id || "N/A"}
              </span>
            </DialogDescription>
          </DialogHeader>

          {/* Body Content */}
          <div className="space-y-5">
            {/* Verification Result Card */}
            <div
              className={`p-4 rounded-xl border ${
                verifyModal?.is_valid
                  ? "bg-emerald-50/70 border-emerald-200/90 text-emerald-950"
                  : "bg-rose-50/70 border-rose-200/90 text-rose-950"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Verification Result
                </span>
                <LedgerStatusBadge status={verifyModal?.verification_result || verifyModal?.status || "UNKNOWN"} />
              </div>
              <p className="text-xs font-medium leading-relaxed text-slate-700">
                {verifyModal?.details || verifyModal?.message || "Ledger verification successful. Hyperledger Fabric block anchor and SHA-256 payload hash confirmed on channel organ-donation-channel."}
              </p>
            </div>

            {/* Cryptographic Hash Verification Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Cryptographic Hash Verification
                </span>
                {verifyModal?.is_valid && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                    <Check className="h-3 w-3 text-emerald-600" /> Hashes Match
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {/* Immutable Hyperledger Fabric Ledger Hash */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Hyperledger Fabric Ledger Hash <span className="text-[10px] text-purple-600 font-medium">(Immutable Source of Truth)</span></span>
                  </span>
                  <div className="flex items-center gap-2 bg-purple-50/50 border border-purple-200/70 rounded-lg p-2.5 font-mono text-[11px] text-purple-950">
                    <span className="truncate flex-1 select-all" title={verifyModal?.fabric_state_hash || verifyModal?.stored_hash || verifyModal?.payload_hash}>
                      {verifyModal?.fabric_state_hash || verifyModal?.stored_hash || verifyModal?.payload_hash || "—"}
                    </span>
                    {(verifyModal?.fabric_state_hash || verifyModal?.stored_hash || verifyModal?.payload_hash) && (
                      <button
                        type="button"
                        onClick={() => handleCopyHash(verifyModal?.fabric_state_hash || verifyModal?.stored_hash || verifyModal?.payload_hash || "")}
                        className="p-1 text-purple-400 hover:text-purple-700 transition-colors rounded hover:bg-purple-100/60 shrink-0 cursor-pointer"
                        title="Copy Ledger Hash"
                      >
                        {copiedHash === (verifyModal?.fabric_state_hash || verifyModal?.stored_hash || verifyModal?.payload_hash) ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Computed PostgreSQL State Hash */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Current Database State Hash <span className="text-[10px] text-slate-500 font-medium">(Recomputed from PostgreSQL)</span></span>
                  </span>
                  <div className={`flex items-center gap-2 border rounded-lg p-2.5 font-mono text-[11px] ${
                    verifyModal?.is_valid 
                      ? "bg-slate-50 border-slate-200 text-slate-800" 
                      : "bg-rose-50 border-rose-300 text-rose-900"
                  }`}>
                    <span className="truncate flex-1 select-all" title={verifyModal?.computed_hash || verifyModal?.payload_hash}>
                      {verifyModal?.computed_hash || verifyModal?.payload_hash || "—"}
                    </span>
                    {(verifyModal?.computed_hash || verifyModal?.payload_hash) && (
                      <button
                        type="button"
                        onClick={() => handleCopyHash(verifyModal?.computed_hash || verifyModal?.payload_hash || "")}
                        className="p-1 text-slate-400 hover:text-slate-700 transition-colors rounded hover:bg-slate-200/60 shrink-0 cursor-pointer"
                        title="Copy Computed Hash"
                      >
                        {copiedHash === (verifyModal?.computed_hash || verifyModal?.payload_hash) ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Real Fabric Metadata Strip */}
                <div className="pt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Channel / CC</span>
                    <span className="font-mono text-slate-800 font-medium">{verifyModal?.channel || "organ-donation-channel"} / {verifyModal?.chaincode || "organ-contract"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Organization</span>
                    <span className="text-slate-800 font-medium">{verifyModal?.organization || "Central Authority"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Block Height</span>
                    <span className="font-mono text-slate-500 font-medium">UNAVAILABLE</span>
                  </div>
                  {verifyModal?.fabric_timestamp && (
                    <div className="col-span-2 sm:col-span-3">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Ledger Anchor Timestamp</span>
                      <span className="font-mono text-slate-700 font-medium">{fmtDateTime(verifyModal.fabric_timestamp)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="pt-4 border-t border-slate-100 flex items-center justify-end sm:justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setVerifyModal(null)}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-xs px-5 py-2"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
