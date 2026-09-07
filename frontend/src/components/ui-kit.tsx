import * as React from "react";
import { Inbox, Search, CheckCircle2, AlertCircle, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/services/types";

// ---------- formatting ----------

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function truncHash(hash: string, chars = 10): string {
  if (!hash) return "—";
  return hash.length <= chars * 2 ? hash : `${hash.slice(0, chars)}…${hash.slice(-6)}`;
}

// ---------- status badge ----------

const POSITIVE = new Set([
  "Available",
  "Active",
  "Eligible",
  "Verified",
  "VERIFIED",
  "SUCCESS",
  "Approved",
  "Completed",
  "Compatible",
  "High",
  "Suitable",
  "Allocated",
  "Matched",
  "Resolved",
]);
const WARNING = new Set([
  "Under Review",
  "Pending Review",
  "Pending",
  "PENDING",
  "Review Required",
  "Review",
  "Moderate",
  "Flagged",
  "Waiting",
  "Medium",
]);
const NEGATIVE = new Set([
  "Unavailable",
  "Suspended",
  "Ineligible",
  "Incompatible",
  "Rejected",
  "REJECTED",
  "Blocked",
  "DENIED",
  "FAILED",
  "Critical",
  "Not Suitable",
  "Low",
  "Archived",
]);

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  const variant = POSITIVE.has(value)
    ? "border-success/30 bg-success/10 text-success"
    : WARNING.has(value)
      ? "border-warning/40 bg-warning/15 text-warning-foreground"
      : NEGATIVE.has(value)
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-secondary text-secondary-foreground";
  return (
    <Badge variant="outline" className={cn("font-medium whitespace-nowrap", variant, className)}>
      {value}
    </Badge>
  );
}

// ---------- page scaffolding ----------

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-normal tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        "shadow-none transition-all duration-200",
        onClick && "cursor-pointer hover:border-primary/40 hover:bg-accent/40 hover:shadow-sm",
      )}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
          <div className="truncate text-sm text-muted-foreground">{label}</div>
          {hint ? <div className="text-xs text-muted-foreground/80">{hint}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  const isAuthError =
    message.toLowerCase().includes("not authenticated") ||
    message.toLowerCase().includes("sign in") ||
    message.toLowerCase().includes("session expired") ||
    message.toLowerCase().includes("unauthorized") ||
    message.toLowerCase().includes("could not validate credentials");

  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      <div>{message}</div>
      {isAuthError && (
        <a
          href="/login"
          className="inline-flex items-center justify-center rounded-md bg-destructive px-3.5 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-sm"
        >
          Sign in to your account →
        </a>
      )}
    </div>
  );
}

// ---------- table helpers ----------

export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <Card className="shadow-none overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </Card>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {children}
      </tr>
    </thead>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3", className)}>{children}</th>;
}

export function TRow({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-border last:border-0 transition-colors hover:bg-muted/40",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle text-foreground", className)}>{children}</td>;
}

// ---------- filters ----------

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}

export function PaginationControls({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-1 pt-4 text-sm text-muted-foreground">
      <span>
        Page {page} of {pages} · {total} records
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// ---------- detail helpers ----------

export function DetailRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-foreground">{children ?? value}</dd>
    </div>
  );
}

// ---------- audit diff helpers ----------

/**
 * Converts camelCase or snake_case keys to a human-readable Title Case label.
 * e.g. "diseaseStage" → "Disease Stage", "primary_diagnosis" → "Primary Diagnosis"
 */
function toReadableLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/**
 * Attempts to parse a string that looks like a JSON object or a Python dict repr.
 * Returns a plain object if successful, otherwise null.
 * Handles both JSON {"key": "val"} and Python {'key': 'val'} formats.
 */
function tryParseObjectValue(val: string): Record<string, string> | null {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    // Try standard JSON first
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // Fall back: convert Python dict repr to JSON
    // Replace single quotes with double quotes (naive but works for simple flat dicts)
    try {
      const jsonLike = trimmed
        .replace(/'/g, '"')
        .replace(/True/g, "true")
        .replace(/False/g, "false")
        .replace(/None/g, "null");
      const parsed = JSON.parse(jsonLike);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Determines whether a diff field represents a structured nested object
 * (e.g. Medical Details, HLA Information, Donation Preferences).
 */
function isStructuredField(fieldLabel: string): boolean {
  const structured = [
    "medical details",
    "hla information",
    "donation preferences",
    "medical info",
    "hla",
  ];
  return structured.some((s) => fieldLabel.toLowerCase().includes(s));
}

/** Renders a structured object diff (e.g. Medical Details) as bullet-point sub-rows */
function StructuredObjectDiff({
  fieldLabel,
  before,
  after,
}: {
  fieldLabel: string;
  before: string;
  after: string;
}) {
  const beforeObj = tryParseObjectValue(before);
  const afterObj = tryParseObjectValue(after);

  if (!beforeObj && !afterObj) {
    // Can't parse — fallback to plain text rendering
    return (
      <p className="font-mono text-slate-600 text-xs">
        <span className="text-slate-500">{before || "—"}</span>{" "}
        <span className="text-blue-500 font-sans font-bold">→</span>{" "}
        <span className="text-blue-700 font-bold">{after || "—"}</span>
      </p>
    );
  }

  // Collect all unique keys across both before and after
  const allKeys = Array.from(
    new Set([
      ...Object.keys(beforeObj ?? {}),
      ...Object.keys(afterObj ?? {}),
    ])
  );

  if (allKeys.length === 0) {
    return (
      <p className="text-slate-500 text-[11px] italic">No sub-field changes recorded.</p>
    );
  }

  return (
    <div className="space-y-1 mt-0.5 pl-1">
      {allKeys.map((key) => {
        const bVal = String((beforeObj ?? {})[key] ?? "");
        const aVal = String((afterObj ?? {})[key] ?? "");
        if (bVal === aVal) return null; // skip unchanged sub-fields
        return (
          <div key={key} className="flex items-start gap-1 text-[11px]">
            <span className="text-slate-400 mt-0.5 shrink-0">•</span>
            <span>
              <span className="font-semibold text-slate-700">{toReadableLabel(key)}:</span>{" "}
              <span className="text-slate-500">{bVal || "—"}</span>{" "}
              <span className="text-blue-500 font-bold">→</span>{" "}
              <span className="text-blue-700 font-bold">{aVal || "—"}</span>
            </span>
          </div>
        );
      }).filter(Boolean)}
    </div>
  );
}

export function HistoryTimeline({ entries = [] }: { entries?: HistoryEntry[] }) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  if (safeEntries.length === 0) {
    return (
      <EmptyState title="No history yet" description="Changes to this record will appear here." />
    );
  }
  const sorted = [...safeEntries].reverse();

  return (
    <ol className="relative space-y-6 border-l-2 border-slate-100 pl-5 ml-2">
      {sorted.map((h, i) => {
        const isCreated = h.action?.toLowerCase() === "created" || h.version === 1;
        const isUpdated = h.action?.toLowerCase() === "updated";
        const isDeleted = h.action?.toLowerCase().includes("delete");
        const isRejected = h.result === "DENIED" || h.result === "FAILED" || h.action?.toLowerCase().includes("reject");
        const isPending = h.result === "PENDING";

        // Dot indicator color
        const dotColor = isRejected || isDeleted
          ? "bg-rose-500 ring-rose-100"
          : isPending
            ? "bg-amber-500 ring-amber-100"
            : isCreated
              ? "bg-emerald-500 ring-emerald-100"
              : "bg-blue-600 ring-blue-100";

        // Action badge styling
        const statusBg = isRejected || isDeleted
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : isPending
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700";

        // Default event descriptions if none provided
        let defaultDescription = isCreated
          ? "Record registered"
          : isDeleted
            ? "Record deleted"
            : "Record updated";

        // Check if there is actual field change information
        const hasDiffs = Array.isArray(h.diffs) && h.diffs.length > 0;
        const hasLegacyChange = Boolean(h.field || (h.before && h.before.trim()) || (h.after && h.after.trim()));

        return (
          <li key={i} className="relative group">
            {/* Timeline Dot */}
            <span
              className={cn(
                "absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 transition-transform group-hover:scale-110",
                dotColor
              )}
            />

            {/* Header: Action + Result Status Badge + Formatted Timestamp */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-slate-900">{h.action || (isCreated ? "Created" : "Updated")}</span>
              {h.result && (
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider", statusBg)}>
                  {h.result}
                </span>
              )}
              <span className="text-xs text-slate-400 font-medium ml-auto">
                {fmtDateTime(h.timestamp)}
              </span>
            </div>

            {/* Actor & Role */}
            <p className="mt-0.5 text-xs text-slate-500 font-medium">
              {h.userName || "Authorized User"} {h.role ? `· ${h.role}` : ""}
            </p>

            {/* Event Description / Reason (Semantic neutral/success vs danger/rejection) */}
            {h.reason ? (
              <p
                className={cn(
                  "mt-1.5 text-xs font-medium",
                  isRejected || isDeleted
                    ? "text-rose-600 bg-rose-50/60 border border-rose-200/60 rounded-lg px-2.5 py-1"
                    : isPending
                      ? "text-amber-700 bg-amber-50/60 border border-amber-200/60 rounded-lg px-2.5 py-1"
                      : "text-slate-700 font-semibold"
                )}
              >
                {isDeleted && <span className="font-semibold text-rose-700 block mb-0.5">Reason:</span>}
                {h.reason}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-700 font-semibold">
                {defaultDescription}
              </p>
            )}

            {/* Changed Fields (Multi-field diffs list) */}
            {hasDiffs ? (
              <div className="mt-2.5 rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs text-slate-700 space-y-2">
                <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                  Changed Fields:
                </span>
                <div className="space-y-1.5 divide-y divide-slate-200/60">
                  {h.diffs?.map((diff, diffIdx) => (
                    <div key={diffIdx} className={diffIdx > 0 ? "pt-1.5" : ""}>
                      <span className="font-semibold text-slate-700 block text-[11px]">{diff.field}</span>
                      {isStructuredField(diff.field) ? (
                        <StructuredObjectDiff
                          fieldLabel={diff.field}
                          before={diff.before || ""}
                          after={diff.after || ""}
                        />
                      ) : (
                        <p className="font-mono text-slate-600 text-xs">
                          <span className="text-slate-500">{diff.before || "—"}</span>{" "}
                          <span className="text-blue-500 font-sans font-bold">→</span>{" "}
                          <span className="text-blue-700 font-bold">{diff.after || "—"}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : hasLegacyChange ? (
              <div className="mt-2.5 rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 text-xs text-slate-700 space-y-1">
                <span className="font-semibold text-slate-800 block text-[11px] uppercase tracking-wider">
                  {h.field ? `Change: ${h.field}` : "Changes:"}
                </span>
                <p className="font-mono text-slate-600">
                  {h.before ? `${h.before}` : "—"} <span className="text-slate-400 font-sans">→</span> {h.after ? `${h.after}` : "—"}
                </p>
              </div>
            ) : null}

            {/* Cryptographic Integrity Verification Badge */}
            <div className="mt-2.5 flex items-center justify-between">
              {h.isVerified !== false ? (
                <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50/90 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span>Integrity verified</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50/90 border border-rose-200/80 px-2.5 py-0.5 rounded-full">
                  <AlertCircle className="h-3 w-3 text-rose-600" />
                  <span>Integrity verification failed</span>
                </div>
              )}

              {h.recordHash && (
                <span className="text-[10px] font-mono text-slate-500 font-medium truncate max-w-[160px]" title={`SHA-256 State Hash: ${h.recordHash}`}>
                  Hash: {h.recordHash.slice(0, 10)}...
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}


