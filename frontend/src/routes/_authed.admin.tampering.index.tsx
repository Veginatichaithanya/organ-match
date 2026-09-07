import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  Blocks,
  CheckCircle2,
  Database,
  Eye,
  FileCode,
  Fingerprint,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  RotateCw,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, fmtDateTime, truncHash } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authed/admin/tampering/")({
  head: () => ({
    meta: [{ title: "Tampering Alerts — OrganMatch Admin" }],
  }),
  component: AdminTamperingAlertsPage,
});

interface TamperingAlertItem {
  id: string;
  alertId: string;
  fabricTxId: string;
  recordId: string;
  recordType: string;
  operation: string;
  actor: string | null;
  databaseHash: string | null;
  fabricHash: string | null;
  status: string;
  timestamp: string;
  details?: string;
  raw: any;
}

function AlertDetailModal({
  event,
  onClose,
  onVerifyAgain,
  isVerifying,
  verificationResult,
}: {
  event: TamperingAlertItem | null;
  onClose: () => void;
  onVerifyAgain: (event: TamperingAlertItem) => void;
  isVerifying: boolean;
  verificationResult: any | null;
}) {
  if (!event) return null;

  const currentStatus = verificationResult
    ? verificationResult.verification_result || verificationResult.status
    : event.status;
  const isTampered = currentStatus === "TAMPERING_DETECTED" || currentStatus === "TAMPERED";
  const dbHash = verificationResult?.computed_hash || event.databaseHash;
  const fabricHash = verificationResult?.fabric_state_hash || event.fabricHash;

  return (
    <Dialog open={!!event} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isTampered ? (
              <ShieldAlert className="h-5 w-5 text-red-600" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            )}
            <DialogTitle>Data Integrity Alert Details</DialogTitle>
          </div>
          <DialogDescription>
            Alert ID: <span className="font-mono text-xs text-slate-700">{event.alertId}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2 text-sm">
          {/* Signal Header Banner */}
          <div
            className={`p-3 border rounded-lg ${
              isTampered
                ? "bg-red-50/80 border-red-200 text-red-900"
                : "bg-emerald-50/80 border-emerald-200 text-emerald-900"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-xs uppercase tracking-wide">
                Verification Signal
              </span>
              <Badge
                variant="outline"
                className={
                  isTampered
                    ? "bg-red-100 text-red-800 border-red-300 font-bold"
                    : "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold"
                }
              >
                {isTampered ? "HASH MISMATCH" : "VERIFIED"}
              </Badge>
            </div>
            <p className="text-xs">
              {verificationResult?.details ||
                (isTampered
                  ? "Database state hash does not match the immutable Hyperledger Fabric ledger anchor."
                  : "Database state hash matches the immutable Hyperledger Fabric ledger anchor.")}
            </p>
          </div>

          {/* Cryptographic Proof Card */}
          <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Fingerprint className="h-4 w-4 text-gray-500" />
              Cryptographic Proof Verification
            </h4>

            <div>
              <span className="text-xs text-gray-500 block mb-0.5">Entity / Record Reference</span>
              <code className="text-xs font-mono bg-white p-1.5 rounded border border-gray-200 block text-gray-800">
                {event.recordType}: {event.recordId}
              </code>
            </div>

            <div>
              <span className="text-xs text-gray-500 block mb-0.5">Database State Hash (Current)</span>
              <code className="text-xs font-mono bg-white p-1.5 rounded border border-gray-200 block text-red-700 break-all">
                {dbHash || "Calculating…"}
              </code>
            </div>

            <div>
              <span className="text-xs text-gray-500 block mb-0.5">Immutable Fabric Hash (Ledger)</span>
              <code className="text-xs font-mono bg-white p-1.5 rounded border border-gray-200 block text-emerald-700 break-all">
                {fabricHash || "Not available"}
              </code>
            </div>

            <div>
              <span className="text-xs text-gray-500 block mb-0.5">Associated Fabric TX ID</span>
              <code className="text-xs font-mono bg-white p-1.5 rounded border border-gray-200 block text-gray-700 break-all">
                {event.fabricTxId}
              </code>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded border border-gray-200 bg-white">
              <span className="text-gray-500 block">Actor Identity</span>
              <span className="font-mono font-medium text-gray-900">{event.actor || "Unknown"}</span>
            </div>
            <div className="p-2.5 rounded border border-gray-200 bg-white">
              <span className="text-gray-500 block">Operation</span>
              <span className="font-mono font-medium text-gray-900">{event.operation || "ApproveAllocation"}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onVerifyAgain(event)}
            disabled={isVerifying}
            className="gap-1.5 text-xs"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isVerifying ? "animate-spin" : ""}`} />
            {isVerifying ? "Verifying against Fabric…" : "Verify Again"}
          </Button>

          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminTamperingAlertsPage() {
  const { user, ready } = useAuth();
  const [selectedAlert, setSelectedAlert] = useState<TamperingAlertItem | null>(null);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);

  // Fetch real blockchain transactions from the backend
  const {
    data: pagedTx,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "tampering_alerts"],
    queryFn: async () => {
      const res = await api.listBlockchain({ pageSize: 100 });
      return res || { items: [], total: 0 };
    },
    enabled: ready && !!user,
  });

  // Verify mutation for "Verify Again"
  const verifyMutation = useMutation({
    mutationFn: async (event: TamperingAlertItem) => {
      const res = await api.verifyBlockchainTx(event.fabricTxId || event.recordId);
      return res;
    },
    onSuccess: (data) => {
      setVerificationResult(data);
    },
  });

  const handleOpenAlert = async (alert: TamperingAlertItem) => {
    setSelectedAlert(alert);
    setVerificationResult(null);
    // Automatically trigger live verification on open to fetch freshest hash comparison
    verifyMutation.mutate(alert);
  };

  const handleVerifyAgain = (alert: TamperingAlertItem) => {
    verifyMutation.mutate(alert);
  };

  // Filter only real blockchain records that have TAMPERING_DETECTED status
  const rawItems = pagedTx?.items ?? [];
  const tamperingAlerts: TamperingAlertItem[] = rawItems
    .filter((tx: any) => {
      const status = (tx.verification_status || tx.verification || "").toUpperCase();
      return status === "TAMPERING_DETECTED" || status === "TAMPERED";
    })
    .map((tx: any) => ({
      id: tx.id,
      alertId: tx.fabricTxId ? `ALERT-${tx.fabricTxId.slice(0, 8).toUpperCase()}` : `ALERT-${tx.id.slice(0, 8).toUpperCase()}`,
      fabricTxId: tx.fabricTxId || tx.fabric_tx_id || tx.id,
      recordId: tx.recordId || tx.record_id,
      recordType: tx.recordType || tx.record_type || "Allocation",
      operation: tx.operation || "ApproveAllocation",
      actor: tx.actor || null,
      databaseHash: tx.computed_hash || null,
      fabricHash: tx.payloadHash || tx.fabric_state_hash || null,
      status: "TAMPERING_DETECTED",
      timestamp: tx.confirmedAt || tx.createdAt || new Date().toISOString(),
      raw: tx,
    }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-semibold text-gray-900">Tampering Alerts</h1>
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-200 font-medium">
              Cryptographic Integrity Monitor
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            Dedicated detection console monitoring active PostgreSQL database records against immutable Hyperledger Fabric ledger anchors.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          Failed to load tampering detection feeds from blockchain gateway.
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-xs overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {[
                "Alert ID",
                "Timestamp",
                "Entity / Record",
                "Actor",
                "Operation",
                "Verification Signal",
                "Status",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                  Scanning cryptographic ledger integrity against Hyperledger Fabric…
                </td>
              </tr>
            ) : tamperingAlerts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <ShieldCheck className="h-10 w-10 text-emerald-500 mb-2" />
                    <p className="font-medium text-gray-900">No Tampering Alerts Detected</p>
                    <p className="text-xs text-gray-400 max-w-sm mt-0.5">
                      All local database records match their respective Hyperledger Fabric cryptographic state roots.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              tamperingAlerts.map((e) => (
                <tr key={e.id} className="hover:bg-red-50/40 transition-colors bg-red-50/10">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-red-900 whitespace-nowrap">
                    {e.alertId}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap font-mono">
                    {fmtDateTime(e.timestamp)}
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-mono text-xs whitespace-nowrap">
                    <span className="font-semibold text-gray-700">{e.recordType}:</span> {e.recordId}
                  </td>
                  <td className="px-4 py-3 text-gray-800 whitespace-nowrap font-mono text-xs">
                    {e.actor || "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant="outline" className="text-xs font-mono">
                      {e.operation}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant="outline" className="text-xs bg-red-100 text-red-800 border-red-300 font-bold">
                      HASH MISMATCH
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-600 inline-block animate-pulse" />
                      TAMPERING_DETECTED
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenAlert(e)}
                      className="h-8 text-xs gap-1 border-red-200 hover:bg-red-50 text-red-700"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Inspect & Verify
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AlertDetailModal
        event={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onVerifyAgain={handleVerifyAgain}
        isVerifying={verifyMutation.isPending}
        verificationResult={verificationResult}
      />
    </div>
  );
}
