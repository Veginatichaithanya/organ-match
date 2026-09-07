import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Check, ShieldCheck, Blocks, RefreshCw, AlertCircle } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TelemetryRefreshButton } from "@/components/ui/telemetry-refresh-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge, fmtDateTime } from "@/components/ui-kit";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/admin/monitoring/blockchain/")({
  head: () => ({
    meta: [{ title: "Blockchain Monitoring — OrganMatch Admin" }],
  }),
  component: AdminBlockchainMonitoringPage,
});

export function AdminBlockchainMonitoringPage() {
  const { user, ready } = useAuth();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<any | null>(null);

  // Auto-refresh every 10 seconds
  const { data: bc, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin", "system", "blockchain"],
    queryFn: () => api.systemBlockchain(),
    enabled: ready && !!user,
    refetchInterval: 10000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Recent transactions list
  const { data: txList } = useQuery({
    queryKey: ["admin", "system", "blockchain", "transactions"],
    queryFn: () => api.listBlockchain({ page: 1, limit: 50 }).then((r) => r.items),
    enabled: ready && !!user,
  });

  const verifyTxMutation = useMutation({
    mutationFn: async (fabric_tx_id?: string) => {
      return api.verifyBlockchainTx(fabric_tx_id || "");
    },
    onSuccess: (res: any) => {
      setVerifyResult(res);
      if (res.status === "NOT_CONFIGURED") {
        toast.info(res.message);
      } else {
        toast.success("Ledger transaction verified successfully.");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to verify transaction on ledger.");
    },
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Payload hash copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isOnline = bc?.status === "HEALTHY";
  const isDegraded = bc?.status === "DEGRADED";
  const isOffline = bc?.status === "OFFLINE";
  const isNotConfigured = bc?.status === "NOT_CONFIGURED" || !bc?.status;

  const getStatusBadge = () => {
    if (isOnline) {
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-xs">
          ● HEALTHY
        </Badge>
      );
    }
    if (isDegraded) {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-mono text-xs">
          ● DEGRADED
        </Badge>
      );
    }
    if (isOffline) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-mono text-xs">
          ● OFFLINE
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200 font-mono text-xs">
        ● NOT CONFIGURED
      </Badge>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-blue-600 shrink-0" />
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
              Blockchain Network Monitoring
            </h1>
            {getStatusBadge()}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Live Hyperledger Fabric network health, connectivity, and transaction status.
          </p>
        </div>

        <TelemetryRefreshButton
          label="Refresh Network"
          onRefresh={() => refetch()}
          isFetching={isFetching}
        />
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Network Status */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              NETWORK STATUS
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className={`text-xl font-bold font-mono tracking-tight ${
              isOnline ? "text-emerald-700" : isOffline ? "text-red-700" : isDegraded ? "text-amber-700" : "text-gray-700"
            }`}>
              {isLoading ? "…" : (bc?.status ?? "NOT_CONFIGURED")}
            </div>
            <p className="text-xs text-gray-500 mt-1 truncate">
              {bc?.network || "Hyperledger Fabric Testnet"}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Block Height */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              {isOnline ? "LATEST BLOCK HEIGHT" : bc?.last_known_block ? "LAST KNOWN BLOCK HEIGHT" : "LATEST BLOCK HEIGHT"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold text-gray-900 font-mono">
              {isLoading ? (
                "…"
              ) : isOnline ? (
                `#${bc?.latest_block ?? 0}`
              ) : bc?.last_known_block ? (
                `#${bc.last_known_block}`
              ) : (
                <span className="text-gray-400 font-sans text-sm">Unavailable</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {isOnline
                ? "Live Fabric ledger height"
                : bc?.last_synced_at || bc?.last_checked
                ? `Last synced ${fmtDateTime(bc?.last_synced_at || bc?.last_checked)}`
                : "Fabric network currently offline"}
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Transaction Count */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              {isOnline ? "FABRIC TRANSACTIONS" : "LOCAL TRANSACTION RECORDS"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold text-blue-600 font-mono">
              {isLoading ? "…" : (bc?.local_transaction_count ?? bc?.transaction_count ?? 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {isOnline ? "Live ledger committed transactions" : "Stored in PostgreSQL database"}
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Failed Transactions */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              FAILED TRANSACTIONS
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold text-emerald-600 font-mono">
              {isLoading ? "…" : (bc?.failed_transactions ?? 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {(bc?.failed_transactions ?? 0) === 0 ? "Zero endorsement failures" : "Failed transaction submissions"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Hyperledger Fabric Channel & Chaincode Parameters */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
          HYPERLEDGER FABRIC CHANNEL & CHAINCODE PARAMETERS
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3.5 bg-gray-50/80 rounded-lg border border-gray-200 space-y-1">
            <span className="text-gray-500 text-[11px] block font-sans">Channel ID</span>
            <span className="text-gray-900 font-semibold block truncate">{bc?.channel || "organ-donation-channel"}</span>
          </div>

          <div className="p-3.5 bg-gray-50/80 rounded-lg border border-gray-200 space-y-1">
            <span className="text-gray-500 text-[11px] block font-sans">Chaincode ID</span>
            <span className="text-gray-900 font-semibold block truncate">{bc?.chaincode || "organ-contract"}</span>
          </div>

          <div className="p-3.5 bg-gray-50/80 rounded-lg border border-gray-200 space-y-1">
            <span className="text-gray-500 text-[11px] block font-sans">Peer Endpoint</span>
            <span className="text-gray-900 font-semibold block truncate">{bc?.peer_endpoint || "localhost:7051"}</span>
          </div>

          <div className="p-3.5 bg-gray-50/80 rounded-lg border border-gray-200 space-y-1">
            <span className="text-gray-500 text-[11px] block font-sans">Gateway Status</span>
            <span className={`font-semibold block truncate ${
              isOnline ? "text-emerald-700" : isOffline ? "text-red-700" : isDegraded ? "text-amber-700" : "text-gray-700"
            }`}>
              {bc?.connected ? "CONNECTED" : bc?.configured ? "DISCONNECTED" : "NOT CONFIGURED"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 text-[11px] text-gray-400">
          <span>
            Last ledger check: {bc?.last_checked ? fmtDateTime(bc.last_checked) : "—"}
          </span>
          <span className="italic">
            Private keys, crypto materials, and MSP certificates are protected and never sent over the API.
          </span>
        </div>
      </div>

      {/* Recent Blockchain Transactions Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">LOCAL BLOCKCHAIN TRANSACTION RECORDS</h2>
            <p className="text-xs text-gray-500">Stored transaction references & cryptographic payload hashes in PostgreSQL</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Transaction ID", "Record ID", "Record Type", "Operation", "Payload Hash", "Status", "Block #", "Created At", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!txList || txList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs text-gray-400">
                    No blockchain transactions recorded in local database.
                  </td>
                </tr>
              ) : (
                txList.map((item: any) => {
                  const txId = typeof item.fabricTxId === "string" ? item.fabricTxId : typeof item.fabric_tx_id === "string" ? item.fabric_tx_id : typeof item.id === "string" ? item.id : "";
                  const recId = typeof item.recordId === "string" ? item.recordId : typeof item.record_id === "string" ? item.record_id : "";
                  const recType = item.recordType || item.record_type || "Allocation";
                  const pHash = typeof item.payloadHash === "string" ? item.payloadHash : typeof item.payload_hash === "string" ? item.payload_hash : typeof item.recordHash === "string" ? item.recordHash : "";
                  const bNum = item.blockNumber ?? item.block_number ?? item.blockHeight ?? 0;
                  const cAt = item.createdAt || item.created_at || item.timestamp;

                  return (
                    <tr key={item.id || txId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700 whitespace-nowrap">
                        {txId ? (txId.length > 12 ? `${txId.slice(0, 12)}…` : txId) : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-800 whitespace-nowrap">
                        {recId ? (recId.length > 8 ? recId.slice(0, 8) : recId) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-900 font-medium whitespace-nowrap">
                        {recType}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                        {item.operation || "Record"}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-500 max-w-xs truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[140px]">{pHash || "—"}</span>
                          {pHash && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyToClipboard(pHash, item.id || txId)}
                              className="h-6 w-6 text-gray-400 hover:text-gray-700 cursor-pointer"
                            >
                              {copiedId === (item.id || txId) ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge value={item.status} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-800 whitespace-nowrap">
                        {bNum ? `#${bNum}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                        {cAt ? fmtDateTime(cAt) : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => verifyTxMutation.mutate(txId)}
                          disabled={verifyTxMutation.isPending || !txId}
                          className="h-7 text-xs text-blue-700 border-blue-200 bg-blue-50/50 hover:bg-blue-100 gap-1 cursor-pointer"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> Verify
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verification Result Dialog */}
      {verifyResult && (
        <Dialog open={!!verifyResult} onOpenChange={() => setVerifyResult(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Blocks className="h-5 w-5 text-blue-600" />
                <DialogTitle>Hyperledger Fabric Verification</DialogTitle>
              </div>
            </DialogHeader>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2 text-xs font-mono">
              {verifyResult.status === "NOT_CONFIGURED" ? (
                <div className="space-y-2">
                  <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
                    NOT_CONFIGURED
                  </Badge>
                  <p className="text-gray-700 font-sans">
                    {verifyResult.message}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Tx Status:</span>
                    <StatusBadge value={verifyResult.status} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Channel:</span>
                    <span className="text-gray-900">{verifyResult.channel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Chaincode:</span>
                    <span className="text-gray-900">{verifyResult.chaincode}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-gray-500 block text-[11px]">Anchored Payload Hash:</span>
                    <span className="text-gray-900 text-[11px] block truncate">{verifyResult.payload_hash}</span>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
