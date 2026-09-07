import { useState } from "react";
import { Check, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface TelemetryRefreshButtonProps {
  label: string;
  onRefresh: () => Promise<any> | void;
  isFetching?: boolean;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export function TelemetryRefreshButton({
  label,
  onRefresh,
  isFetching = false,
  className = "",
  size = "sm",
  variant = "outline",
}: TelemetryRefreshButtonProps) {
  const [isManualLoading, setIsManualLoading] = useState(false);
  const [feedback, setFeedback] = useState<"idle" | "success" | "error">("idle");

  const handleRefresh = async () => {
    if (isManualLoading || isFetching) return;
    setIsManualLoading(true);
    setFeedback("idle");
    try {
      await onRefresh();
      setFeedback("success");
      const actionSubject = label.replace(/^Refresh\s*/i, "").trim() || "Data";
      toast.success(`${actionSubject} updated successfully.`);
      setTimeout(() => {
        setFeedback("idle");
      }, 1500);
    } catch (err: any) {
      setFeedback("error");
      const errorMsg = err?.response?.data?.detail || err?.message || `Failed to refresh ${label.toLowerCase()}.`;
      toast.error(errorMsg);
      setTimeout(() => {
        setFeedback("idle");
      }, 2000);
    } finally {
      setIsManualLoading(false);
    }
  };

  const isLoading = isManualLoading || isFetching;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleRefresh}
      disabled={isLoading}
      aria-busy={isLoading}
      className={`gap-1.5 text-xs transition-all duration-150 cursor-pointer ${
        feedback === "success"
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : feedback === "error"
          ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
      } ${className}`}
    >
      {feedback === "success" ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span>Updated</span>
        </>
      ) : feedback === "error" ? (
        <>
          <AlertCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
          <span>Retry</span>
        </>
      ) : (
        <>
          <RefreshCw
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${
              isLoading ? "animate-spin text-blue-600" : "text-slate-500"
            }`}
          />
          <span>{isLoading ? "Refreshing..." : label}</span>
        </>
      )}
    </Button>
  );
}
