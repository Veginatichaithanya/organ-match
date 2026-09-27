import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Eye,
  FileCode,
  FileText,
  Fingerprint,
  RefreshCw,
  RotateCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
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

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const handleCopy = (key: string, val: string) => {
    if (!val) return;
    try {
      navigator.clipboard?.writeText(val);
    } catch {}
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const currentStatus = verificationResult
    ? verificationResult.verification_result || verificationResult.status
    : event.status;
  const isTampered = currentStatus === "TAMPERING_DETECTED" || currentStatus === "TAMPERED";
  const dbHash = verificationResult?.computed_hash || event.databaseHash || "—";
  const fabricHash = verificationResult?.fabric_state_hash || event.fabricHash || "—";
  const actorName = verificationResult?.actor || event.actor || "HOSP-001 (City General Hospital)";
  const actorId =
    verificationResult?.actor_id ||
    event.raw?.created_by ||
    event.raw?.actor_id ||
    "a1b2c3d4-56e7-890f-1234-56789abcdef0";
  const operation = verificationResult?.operation || event.operation || "ApproveAllocation";

  const rawTs = verificationResult?.confirmed_at || verificationResult?.fabric_timestamp || event.timestamp;
  let formattedTime = "Sep 24, 2024, 05:34 AM";
  try {
    if (rawTs) {
      formattedTime = new Date(rawTs).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
  } catch {}

  const recordRefText = `${event.recordType || "Allocation"} - ${event.recordId}`;

  return (
    <Dialog open={!!event} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl p-6 rounded-3xl bg-white shadow-2xl border border-slate-100">
        <DialogHeader className="space-y-1 pb-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-red-50 text-red-600 border border-red-100/80 flex items-center justify-center shrink-0">
              {isTampered ? (
                <ShieldAlert className="h-6 w-6 text-red-600" />
              ) : (
                <ShieldCheck className="h-6 w-6 text-emerald-600" />
              )}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
                Data Integrity Alert Details
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-normal mt-0.5">
                Alert ID: <span className="font-mono text-slate-700 font-medium">{event.alertId}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1 pb-1 text-sm">
          {/* Signal Header Banner */}
          <div
            className={`p-4 border rounded-2xl flex items-start gap-3.5 ${
              isTampered
                ? "bg-red-50/70 border-red-200/90 text-red-950"
                : "bg-emerald-50/70 border-emerald-200/90 text-emerald-950"
            }`}
          >
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-xs font-bold text-white ${
                isTampered ? "bg-red-600" : "bg-emerald-600"
              }`}
            >
              {isTampered ? "!" : "✓"}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[11px] uppercase tracking-wider text-slate-700">
                  VERIFICATION SIGNAL
                </span>
                <Badge
                  variant="outline"
                  className={
                    isTampered
                      ? "bg-red-100/80 text-red-600 border-red-300 font-bold text-[11px] px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                      : "bg-emerald-100/80 text-emerald-700 border-emerald-300 font-bold text-[11px] px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                  }
                >
                  {isTampered ? "HASH MISMATCH" : "VERIFIED"}
                </Badge>
              </div>

              <div
                className={`text-lg font-bold tracking-tight mt-0.5 ${
                  isTampered ? "text-red-600" : "text-emerald-700"
                }`}
              >
                {isTampered ? "TAMPERING DETECTED" : "VERIFIED ON LEDGER"}
              </div>

              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {isTampered
                  ? "The current database state hash does not match the immutable Hyperledger Fabric ledger hash. The PostgreSQL record has been altered after ledger anchoring."
                  : "The current database state hash matches the immutable Hyperledger Fabric ledger hash. Cryptographic verification successful."}
              </p>
            </div>
          </div>

          {/* Cryptographic Proof Verification Section */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100/80 flex items-center justify-center shrink-0">
                <Fingerprint className="h-4.5 w-4.5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  CRYPTOGRAPHIC PROOF VERIFICATION
                </h4>
                <p className="text-[11px] text-slate-500">
                  Detailed cryptographic information for this integrity alert.
                </p>
              </div>
            </div>

            {/* Field 1: Entity / Record Reference */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                <div className="p-1 rounded-md bg-blue-50 text-blue-600">
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <span>Entity / Record Reference</span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="font-mono text-xs sm:text-sm text-slate-800 font-medium truncate">
                  {recordRefText}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy("recordRef", recordRefText)}
                  className="p-1 text-blue-500 hover:text-blue-700 transition-colors shrink-0 ml-2"
                  title="Copy reference"
                >
                  {copiedKey === "recordRef" ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Field 2: Database State Hash (Current) */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                <div className="p-1 rounded-md bg-red-50 text-red-600">
                  <Database className="h-3.5 w-3.5" />
                </div>
                <span>Database State Hash (Current)</span>
              </div>
              <div
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border ${
                  isTampered
                    ? "border-red-200 bg-red-50/50 text-red-600"
                    : "border-emerald-200 bg-emerald-50/50 text-emerald-700"
                }`}
              >
                <span className="font-mono text-xs sm:text-sm font-semibold break-all select-all">
                  {dbHash}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy("dbHash", dbHash)}
                  className="p-1 text-blue-500 hover:text-blue-700 transition-colors shrink-0 ml-2"
                  title="Copy database hash"
                >
                  {copiedKey === "dbHash" ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Field 3: Immutable Fabric Hash (Ledger) */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                <div className="p-1 rounded-md bg-emerald-50 text-emerald-600">
                  <Boxes className="h-3.5 w-3.5" />
                </div>
                <span>Immutable Fabric Hash (Ledger)</span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 text-emerald-600">
                <span className="font-mono text-xs sm:text-sm font-semibold break-all select-all">
                  {fabricHash}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy("fabricHash", fabricHash)}
                  className="p-1 text-blue-500 hover:text-blue-700 transition-colors shrink-0 ml-2"
                  title="Copy immutable Fabric hash"
                >
                  {copiedKey === "fabricHash" ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Field 4: Associated Fabric TX ID */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                <div className="p-1 rounded-md bg-blue-50 text-blue-600">
                  <FileCode className="h-3.5 w-3.5" />
                </div>
                <span>Associated Fabric TX ID</span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-700">
                <span className="font-mono text-xs sm:text-sm font-medium break-all select-all">
                  {event.fabricTxId}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy("txId", event.fabricTxId)}
                  className="p-1 text-blue-500 hover:text-blue-700 transition-colors shrink-0 ml-2"
                  title="Copy Fabric TX ID"
                >
                  {copiedKey === "txId" ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Metadata Grid: Actor Identity & Operation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Actor Identity */}
              <div className="p-3 rounded-2xl border border-slate-200 bg-white flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100/70 flex items-center justify-center shrink-0">
                  <User className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                    Actor Identity
                  </span>
                  <p className="text-xs font-semibold text-slate-900 mt-0.5 truncate">
                    {actorName}
                  </p>
                  <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                    {actorId}
                  </p>
                </div>
              </div>

              {/* Operation */}
              <div className="p-3 rounded-2xl border border-slate-200 bg-white flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100/70 flex items-center justify-center shrink-0">
                  <Settings className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                    Operation
                  </span>
                  <p className="text-xs font-semibold text-slate-900 mt-0.5 truncate">
                    {operation}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                    Performed at: {formattedTime}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full pt-3 border-t border-slate-100">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onVerifyAgain(event)}
            disabled={isVerifying}
            className="gap-2 text-xs border-blue-600 text-blue-600 hover:bg-blue-50 rounded-xl px-4 py-2 font-medium"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isVerifying ? "animate-spin" : ""}`} />
            {isVerifying ? "Verifying against Fabric…" : "Verify Again"}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-6 py-2 font-medium text-xs"
          >
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
    verifyMutation.mutate(alert, {
      onSuccess: () => {
        refetch();
      },
    });
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
      databaseHash: tx.computed_hash || tx.computedHash || null,
      fabricHash: tx.payloadHash || tx.fabric_state_hash || tx.fabricStateHash || null,
      status: "TAMPERING_DETECTED",
      timestamp: tx.confirmedAt || tx.createdAt || new Date().toISOString(),
      raw: tx,
    }));

  return (
    <div className="p-6 max-w-full space-y-6">
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
      <div className="rounded-xl border border-gray-200 bg-white shadow-xs overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80 border-b border-gray-200">
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
                  className={`px-2.5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${
                    h === "Actions" ? "text-right" : "text-left"
                  }`}
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
                  <td className="px-2.5 py-2.5 font-mono text-xs font-bold text-red-900 whitespace-nowrap">
                    {e.alertId}
                  </td>
                  <td className="px-2.5 py-2.5 text-gray-500 text-xs whitespace-nowrap font-mono">
                    {fmtDateTime(e.timestamp)}
                  </td>
                  <td className="px-2.5 py-2.5 text-gray-900 font-mono text-xs whitespace-nowrap">
                    <span className="font-semibold text-gray-700">{e.recordType}:</span>{" "}
                    {e.recordId.length > 14
                      ? `${e.recordId.slice(0, 8)}…`
                      : e.recordId}
                  </td>
                  <td className="px-2.5 py-2.5 text-gray-800 whitespace-nowrap text-xs font-medium">
                    {e.actor || "—"}
                  </td>
                  <td className="px-2.5 py-2.5 whitespace-nowrap">
                    <Badge variant="outline" className="text-xs font-mono">
                      {e.operation}
                    </Badge>
                  </td>
                  <td className="px-2.5 py-2.5 whitespace-nowrap">
                    <Badge variant="outline" className="text-xs bg-red-100 text-red-800 border-red-300 font-bold uppercase tracking-wider">
                      HASH MISMATCH
                    </Badge>
                  </td>
                  <td className="px-2.5 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-800 border border-red-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-600 inline-block animate-pulse" />
                      TAMPERING_DETECTED
                    </span>
                  </td>
                  <td className="px-2.5 py-2.5 whitespace-nowrap text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenAlert(e)}
                      className="h-7 text-xs gap-1 border-red-200 hover:bg-red-50 text-red-700 font-medium px-2.5"
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
