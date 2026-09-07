import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileWarning,
  Loader2,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export interface DeleteRecordTarget {
  id: string;
  type: "Donor" | "Recipient" | "Organ" | string;
  code?: string;
  name?: string;
  extraInfo?: string;
}

const EXAMPLE_REASONS = [
  "Test data cleanup",
  "Duplicate record",
  "Incorrect registration",
  "Entered by mistake",
  "Record created for testing",
  "Data correction",
  "Administrative cleanup",
];

interface DeleteConfirmationModalProps {
  target: DeleteRecordTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  isLoading?: boolean;
}

export function DeleteConfirmationModal({
  target,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: DeleteConfirmationModalProps) {
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"input" | "confirm">("input");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!target) return null;

  const trimmedReason = reason.trim();
  const isValidLength = trimmedReason.length >= 10 && trimmedReason.length <= 500;

  const handleClose = () => {
    if (isLoading) return;
    setReason("");
    setStep("input");
    setErrorMessage(null);
    onClose();
  };

  const handleProceedToFinalConfirm = () => {
    if (!trimmedReason || trimmedReason.length < 10) {
      setErrorMessage("Please provide a deletion reason (minimum 10 characters).");
      return;
    }
    if (trimmedReason.length > 500) {
      setErrorMessage("Deletion reason cannot exceed 500 characters.");
      return;
    }
    setErrorMessage(null);
    setStep("confirm");
  };

  const handleExecuteDeletion = async () => {
    try {
      setErrorMessage(null);
      await onConfirm(trimmedReason);
      handleClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to delete record.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden border-rose-200">
        {/* Modal Header */}
        <div className="bg-rose-50/80 border-b border-rose-100 p-5 flex items-start gap-3.5">
          <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-bold text-rose-950">
              Delete {target.type}?
            </DialogTitle>
            <DialogDescription className="text-xs text-rose-900/80 mt-1 font-medium leading-relaxed">
              You are about to permanently delete this record. This action will be recorded in the audit trail.
            </DialogDescription>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Record Details Display */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                Target Record Details
              </span>
              <Badge variant="outline" className="font-bold text-xs bg-white text-slate-800 border-slate-200">
                {target.type}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Record Code / ID</span>
                <span className="font-mono font-bold text-slate-900">
                  {target.code || target.id.slice(0, 8)}
                </span>
              </div>
              {target.name && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Name / Label</span>
                  <span className="font-semibold text-slate-800">{target.name}</span>
                </div>
              )}
              {target.extraInfo && (
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[11px]">Details</span>
                  <span className="text-slate-700">{target.extraInfo}</span>
                </div>
              )}
            </div>
          </div>

          {step === "input" ? (
            /* STEP 1: Reason Input */
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs">
                    Reason for deletion <span className="text-rose-600">*</span>
                  </label>
                  <span
                    className={`text-[11px] font-mono ${
                      trimmedReason.length > 500
                        ? "text-rose-600 font-bold"
                        : trimmedReason.length >= 10
                        ? "text-emerald-600 font-semibold"
                        : "text-slate-400"
                    }`}
                  >
                    {trimmedReason.length} / 500 chars (min 10)
                  </span>
                </div>
                <Textarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Enter the reason for deleting this record..."
                  rows={3}
                  className="text-xs border-slate-200 focus:border-rose-500 focus:ring-rose-200"
                />
              </div>

              {/* Helper Examples */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  Quick Reason Examples:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_REASONS.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => {
                        setReason(ex);
                        setErrorMessage(null);
                      }}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-medium transition-colors cursor-pointer"
                    >
                      + {ex}
                    </button>
                  ))}
                </div>
              </div>

              {errorMessage && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                  {errorMessage}
                </div>
              )}
            </div>
          ) : (
            /* STEP 2: Final Confirmation State */
            <div className="space-y-3.5 pt-1">
              <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2 text-amber-950">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                  <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                  Final Permanent Deletion Confirmation
                </div>
                <p className="text-xs font-semibold">
                  Are you sure you want to permanently delete this record?
                </p>
                <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200 text-xs text-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Documented Reason:</span>
                  <span className="italic font-medium">"{trimmedReason}"</span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                  {errorMessage}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 flex items-center justify-between gap-2">
          {step === "confirm" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep("input")}
              disabled={isLoading}
              className="text-xs gap-1.5 border-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isLoading}
              className="text-xs border-slate-200"
            >
              Cancel
            </Button>
          )}

          <div className="flex items-center gap-2">
            {step === "input" ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleProceedToFinalConfirm}
                disabled={!isValidLength || isLoading}
                className="text-xs font-bold gap-1.5 h-9 px-4 bg-rose-600 hover:bg-rose-700"
              >
                <Trash2 className="h-4 w-4" />
                Delete Record
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="text-xs border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleExecuteDeletion}
                  disabled={isLoading}
                  className="text-xs font-bold gap-1.5 h-9 px-4 bg-rose-600 hover:bg-rose-700"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Confirm Deletion
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
