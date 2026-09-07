import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { http } from "@/services/http";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  User,
  Droplets,
  Activity,
  Info,
  AlertCircle,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authed/coordinator/organs/new")({
  head: () => ({
    meta: [
      { title: "Register Harvested Organ — OrganMatch" },
      {
        name: "description",
        content:
          "Register a harvested organ through a verified 3-step workflow.",
      },
    ],
  }),
  component: RegisterHarvestedOrganPage,
});

// ─── Constants ───────────────────────────────────────────────────────────────

const ORGAN_TYPES = [
  { value: "KIDNEY", label: "Kidney" },
  { value: "LIVER", label: "Liver" },
  { value: "HEART", label: "Heart" },
  { value: "LUNG", label: "Lungs" },
  { value: "PANCREAS", label: "Pancreas" },
] as const;

const PAIRED_ORGANS = new Set(["KIDNEY", "LUNG"]);

const LATERALITY_OPTIONS = [
  { value: "LEFT", label: "Left" },
  { value: "RIGHT", label: "Right" },
  { value: "BOTH", label: "Both" },
];

const STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "Available — Ready for Matching" },
  { value: "UNDER_REVIEW", label: "Under Review — Pending Assessment" },
] as const;

const PRESERVATION_METHODS = [
  "Static Cold Storage",
  "Hypothermic Machine Perfusion",
  "Normothermic Machine Perfusion",
  "Hypothermic Oxygenated Machine Perfusion",
  "Other",
] as const;

// ─── Step Indicator ──────────────────────────────────────────────────────────

const STEPS = [
  { label: "Donor Information", icon: User },
  { label: "Organ Harvested Details", icon: Droplets },
  { label: "Clinical & Preservation Details", icon: Activity },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8 select-none">
      {STEPS.map((step, idx) => {
        const done = idx < current;
        const active = idx === current;
        const Icon = step.icon;
        return (
          <div key={idx} className="flex items-center flex-1 last:flex-none">
            {/* Step circle */}
            <div className="flex flex-col items-center gap-1.5 min-w-[120px]">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 border-2 ${
                  done
                    ? "bg-blue-600 border-blue-600 text-white"
                    : active
                      ? "bg-blue-600 border-blue-600 text-white shadow-[0_0_0_4px_rgba(37,99,235,0.15)]"
                      : "bg-white border-gray-300 text-gray-400"
                }`}
              >
                {done ? <CheckCircle2 className="h-4.5 w-4.5" /> : idx + 1}
              </div>
              <span
                className={`text-[11px] font-medium leading-tight text-center ${
                  active
                    ? "text-blue-700"
                    : done
                      ? "text-blue-500"
                      : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mt-[-18px] rounded transition-colors duration-300 ${
                  done ? "bg-blue-500" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateStep1(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!form.donor_id) errors.donor_id = "Please select an associated donor.";
  return errors;
}

function validateStep2(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!form.organ_type) errors.organ_type = "Organ type is required.";
  if (!form.harvested_date) errors.harvested_date = "Harvest date is required.";
  if (!form.harvested_time) errors.harvested_time = "Harvest time is required.";
  if (!form.organ_status) errors.organ_status = "Organ status is required.";
  if (PAIRED_ORGANS.has(form.organ_type) && !form.laterality) {
    errors.laterality = "Laterality is required for this organ type.";
  }
  return errors;
}

function validateStep3(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!form.preservation_method)
    errors.preservation_method = "Preservation method is required.";
  if (!form.clinical_notes || form.clinical_notes.trim().length < 10)
    errors.clinical_notes =
      "Clinical information is required (at least 10 characters).";
  if (form.warm_ischemia_minutes !== "" && isNaN(Number(form.warm_ischemia_minutes)))
    errors.warm_ischemia_minutes = "Must be a valid number.";
  return errors;
}

// ─── Form State ──────────────────────────────────────────────────────────────

interface FormState {
  // Step 1
  donor_id: string;
  // Step 2
  organ_type: string;
  laterality: string;
  harvested_date: string;
  harvested_time: string;
  organ_status: string;
  // Step 3
  warm_ischemia_minutes: string;
  cold_ischemia_time: string;
  preservation_method: string;
  clinical_notes: string;
  additional_notes: string;
}

const INITIAL_FORM: FormState = {
  donor_id: "",
  organ_type: "",
  laterality: "",
  harvested_date: new Date().toISOString().slice(0, 10),
  harvested_time: new Date().toTimeString().slice(0, 5),
  organ_status: "AVAILABLE",
  warm_ischemia_minutes: "",
  cold_ischemia_time: "",
  preservation_method: "",
  clinical_notes: "",
  additional_notes: "",
};

// ─── Read-only info field ─────────────────────────────────────────────────────

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-xs font-medium text-gray-500 block mb-1">
        {label}
      </Label>
      <div className="h-10 px-3 flex items-center rounded-md border border-gray-200 bg-gray-50 text-sm text-gray-700 font-medium">
        {value || <span className="text-gray-400 font-normal">—</span>}
      </div>
    </div>
  );
}

// ─── Inline field error ───────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
      <AlertCircle className="h-3 w-3 flex-shrink-0" />
      {msg}
    </p>
  );
}

// ─── Info Banner ─────────────────────────────────────────────────────────────

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-800">
      <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
      <span>{children}</span>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  step,
  title,
  icon: Icon,
}: {
  step: number;
  title: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-blue-600" />
      </div>
      <h2 className="text-sm font-semibold text-blue-700">
        {step}. {title}
      </h2>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function RegisterHarvestedOrganPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, ready } = useAuth();

  const [currentStep, setCurrentStep] = useState(0); // 0,1,2
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load hospital donors
  const { data: donorsData, isLoading: donorsLoading } = useQuery({
    queryKey: ["donors", "for_organ_registration"],
    queryFn: () => api.listDonors({ pageSize: 200 }),
    enabled: ready && !!user,
  });

  const donors = donorsData?.items ?? [];

  // Selected donor record
  const selectedDonor = useMemo(
    () => donors.find((d) => d.id === form.donor_id) ?? null,
    [donors, form.donor_id]
  );

  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleDonorSelect = (donorId: string) => {
    setForm((f) => ({ ...f, donor_id: donorId }));
    setErrors((e) => ({ ...e, donor_id: undefined }));
  };

  // ── Navigation ──────────────────────────────────────────────────────────────

  const validateCurrent = (): boolean => {
    let errs: Partial<Record<keyof FormState, string>> = {};
    if (currentStep === 0) errs = validateStep1(form);
    if (currentStep === 1) errs = validateStep2(form);
    if (currentStep === 2) errs = validateStep3(form);
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateCurrent()) setCurrentStep((s) => s + 1);
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep((s) => s - 1);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const registerMutation = useMutation({
    mutationFn: async () => {
      // Validate all three steps before submit
      const s1 = validateStep1(form);
      const s2 = validateStep2(form);
      const s3 = validateStep3(form);
      const allErrors = { ...s1, ...s2, ...s3 };
      if (Object.keys(allErrors).length > 0) {
        setErrors(allErrors);
        throw new Error("Validation failed.");
      }

      // Build ISO datetime for harvest
      const harvestedAt =
        form.harvested_date && form.harvested_time
          ? `${form.harvested_date}T${form.harvested_time}:00`
          : undefined;

      const donorBloodGroup =
        selectedDonor?.bloodGroup || selectedDonor?.blood_group || "";

      const payload: Record<string, unknown> = {
        donor_id: form.donor_id,
        organ_type: form.organ_type.toUpperCase(),
        blood_group: donorBloodGroup,
        organ_status: form.organ_status,
        laterality: PAIRED_ORGANS.has(form.organ_type) ? form.laterality || undefined : undefined,
        harvested_at: harvestedAt,
        warm_ischemia_minutes:
          form.warm_ischemia_minutes !== ""
            ? Number(form.warm_ischemia_minutes)
            : undefined,
        cold_ischemia_time: form.cold_ischemia_time || undefined,
        preservation_method: form.preservation_method || undefined,
        clinical_notes: form.clinical_notes || undefined,
        additional_notes: form.additional_notes || undefined,
        medical_details: {},
      };

      const res = await http.post("/organs/", payload);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organs"] });
      qc.invalidateQueries({ queryKey: ["coordinator", "overview"] });
      toast.success("Harvested organ registered successfully.");
      navigate({ to: "/coordinator/organs" });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ??
        (err instanceof Error && err.message !== "Validation failed."
          ? err.message
          : null) ??
        "Unable to register harvested organ. Please check your connection and try again.";
      setSubmitError(msg);
    },
  });

  const handleSubmit = () => {
    setSubmitError(null);
    registerMutation.mutate();
  };

  // ─── Layout ────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 py-6 w-full max-w-4xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Register Harvested Organ
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Record a newly harvested organ from a donor registered at{" "}
          {user?.organization || "your hospital"}.
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator current={currentStep} />

      {/* ── STEP 1: Donor Information ─────────────────────────────────────── */}
      {currentStep === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          <SectionHeader step={1} title="Donor Information" icon={User} />

          <InfoBanner>
            Select the donor from your hospital's registry. Donor details will
            be auto-filled and cannot be edited.
          </InfoBanner>

          <div className="mt-5 space-y-5">
            {/* Donor dropdown */}
            <div>
              <Label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Associated Donor <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.donor_id}
                onValueChange={handleDonorSelect}
                disabled={donorsLoading}
              >
                <SelectTrigger
                  className={errors.donor_id ? "border-red-400 ring-red-200 ring-1" : ""}
                >
                  <SelectValue
                    placeholder={
                      donorsLoading
                        ? "Loading donors…"
                        : donors.length === 0
                          ? "No donors registered at this hospital"
                          : "Search and select donor…"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72 overflow-y-auto">
                  {donors.map((d) => {
                    const code =
                      d.donor_code || (d.id ? d.id.slice(0, 8) : "—");
                    return (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name || "Anonymous Donor"} ({code})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <FieldError msg={errors.donor_id} />
              {donors.length === 0 && !donorsLoading && (
                <p className="mt-1.5 text-xs text-amber-600">
                  No donors are registered at your hospital yet.{" "}
                  <Link
                    to="/coordinator/donors/new"
                    className="underline font-medium"
                  >
                    Register a donor first.
                  </Link>
                </p>
              )}
            </div>

            {/* Auto-filled donor details */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <ReadOnlyField
                label="Donor Code"
                value={
                  selectedDonor
                    ? selectedDonor.donor_code ||
                      selectedDonor.id?.slice(0, 8) ||
                      "—"
                    : "—"
                }
              />
              <ReadOnlyField
                label="Donor Name"
                value={selectedDonor?.name || "—"}
              />
              <ReadOnlyField
                label="Blood Group"
                value={selectedDonor?.bloodGroup || "—"}
              />
              <ReadOnlyField
                label="Age / Gender"
                value={
                  selectedDonor
                    ? `${selectedDonor.age ?? "—"} · ${selectedDonor.gender ?? "—"}`
                    : "—"
                }
              />
            </div>

            <InfoBanner>
              Donor details are automatically retrieved from the hospital donor
              registry and cannot be modified.
            </InfoBanner>
          </div>

          {/* Footer buttons */}
          <div className="mt-8 flex items-center justify-between pt-5 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/coordinator/organs" })}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleNext} className="gap-1.5">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Organ Harvested Details ──────────────────────────────── */}
      {currentStep === 1 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          <SectionHeader
            step={2}
            title="Organ Harvested Details"
            icon={Droplets}
          />

          <InfoBanner>
            Enter organ harvested information and availability status.
          </InfoBanner>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {/* Organ Type */}
            <div>
              <Label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Organ Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.organ_type}
                onValueChange={(v) => {
                  setField("organ_type", v);
                  // Clear laterality if switching to non-paired organ
                  if (!PAIRED_ORGANS.has(v)) setField("laterality", "");
                }}
              >
                <SelectTrigger
                  className={errors.organ_type ? "border-red-400 ring-red-200 ring-1" : ""}
                >
                  <SelectValue placeholder="Select organ type…" />
                </SelectTrigger>
                <SelectContent>
                  {ORGAN_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError msg={errors.organ_type} />
            </div>

            {/* Laterality — only for paired organs */}
            <div>
              <Label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Laterality{" "}
                {PAIRED_ORGANS.has(form.organ_type) && (
                  <span className="text-red-500">*</span>
                )}
                {!PAIRED_ORGANS.has(form.organ_type) && form.organ_type && (
                  <span className="text-gray-400 font-normal ml-1">
                    (not applicable)
                  </span>
                )}
              </Label>
              <Select
                value={form.laterality}
                onValueChange={(v) => setField("laterality", v)}
                disabled={!PAIRED_ORGANS.has(form.organ_type)}
              >
                <SelectTrigger
                  className={
                    errors.laterality
                      ? "border-red-400 ring-red-200 ring-1"
                      : !PAIRED_ORGANS.has(form.organ_type) && form.organ_type
                        ? "opacity-50"
                        : ""
                  }
                >
                  <SelectValue
                    placeholder={
                      !form.organ_type
                        ? "Select organ type first"
                        : PAIRED_ORGANS.has(form.organ_type)
                          ? "Select laterality…"
                          : "N/A for this organ"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {LATERALITY_OPTIONS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError msg={errors.laterality} />
            </div>

            {/* Harvested Date */}
            <div>
              <Label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Harvested Date <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={form.harvested_date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setField("harvested_date", e.target.value)}
                className={errors.harvested_date ? "border-red-400 ring-red-200 ring-1" : ""}
              />
              <FieldError msg={errors.harvested_date} />
            </div>

            {/* Harvested Time */}
            <div>
              <Label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Harvested Time <span className="text-red-500">*</span>
              </Label>
              <Input
                type="time"
                value={form.harvested_time}
                onChange={(e) => setField("harvested_time", e.target.value)}
                className={errors.harvested_time ? "border-red-400 ring-red-200 ring-1" : ""}
              />
              <FieldError msg={errors.harvested_time} />
            </div>

            {/* Organ Code (read-only) */}
            <div>
              <Label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Organ Code{" "}
                <span className="text-gray-400 font-normal">(Auto-generated)</span>
              </Label>
              <div className="h-10 px-3 flex items-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400 italic">
                Auto-generated on save
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                A unique ORG-XXXXXXXX code will be assigned by the backend.
              </p>
            </div>

            {/* Blood Group (auto-filled from donor) */}
            <div>
              <Label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Blood Group{" "}
                <span className="text-gray-400 font-normal">(Auto-filled from donor)</span>
              </Label>
              <div
                className={`h-10 px-3 flex items-center rounded-md border text-sm font-semibold ${
                  selectedDonor?.bloodGroup
                    ? "border-gray-200 bg-blue-50 text-blue-800"
                    : "border-gray-200 bg-gray-50 text-gray-400"
                }`}
              >
                {selectedDonor?.bloodGroup || "—"}
              </div>
            </div>

            {/* Organ Status */}
            <div className="sm:col-span-2">
              <Label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Organ Status <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.organ_status}
                onValueChange={(v) => setField("organ_status", v)}
              >
                <SelectTrigger
                  className={`max-w-sm ${errors.organ_status ? "border-red-400 ring-red-200 ring-1" : ""}`}
                >
                  <SelectValue placeholder="Select status…" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError msg={errors.organ_status} />
              {form.organ_status === "AVAILABLE" && (
                <p className="mt-1.5 text-xs text-emerald-700 font-medium">
                  ✓ Organ will be immediately available for matching and
                  allocation.
                </p>
              )}
              {form.organ_status === "UNDER_REVIEW" && (
                <p className="mt-1.5 text-xs text-amber-700">
                  Organ will be held pending medical review before allocation.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <InfoBanner>
              The harvested organ will become available for matching and
              allocation according to its verified status and availability.
            </InfoBanner>
          </div>

          {/* Footer buttons */}
          <div className="mt-8 flex items-center justify-between pt-5 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={handleBack} className="gap-1.5">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: "/coordinator/organs" })}
              >
                Cancel
              </Button>
            </div>
            <Button type="button" onClick={handleNext} className="gap-1.5">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Clinical & Preservation Details ───────────────────────── */}
      {currentStep === 2 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          <SectionHeader
            step={3}
            title="Clinical & Preservation Details"
            icon={Activity}
          />

          <InfoBanner>
            Provide clinical and preservation information for the harvested
            organ.
          </InfoBanner>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {/* Warm Ischemia Time */}
            <div>
              <Label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Warm Ischemia Time (minutes)
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={999}
                  placeholder="e.g. 25"
                  value={form.warm_ischemia_minutes}
                  onChange={(e) =>
                    setField("warm_ischemia_minutes", e.target.value)
                  }
                  className={`pr-12 ${errors.warm_ischemia_minutes ? "border-red-400 ring-red-200 ring-1" : ""}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  min
                </span>
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                Time from removal to cold preservation.
              </p>
              <FieldError msg={errors.warm_ischemia_minutes} />
            </div>

            {/* Cold Ischemia Time */}
            <div>
              <Label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Cold Ischemia Time{" "}
                <span className="text-gray-400 font-normal">(estimated)</span>
              </Label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="e.g. 02:30"
                  pattern="^[0-9]{1,3}:[0-5][0-9]$"
                  value={form.cold_ischemia_time}
                  onChange={(e) =>
                    setField("cold_ischemia_time", e.target.value)
                  }
                  className="pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  HH:MM
                </span>
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                Estimated time from preservation to transplant.
              </p>
            </div>

            {/* Preservation Method */}
            <div className="sm:col-span-2">
              <Label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Preservation Method <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.preservation_method}
                onValueChange={(v) => setField("preservation_method", v)}
              >
                <SelectTrigger
                  className={`max-w-sm ${errors.preservation_method ? "border-red-400 ring-red-200 ring-1" : ""}`}
                >
                  <SelectValue placeholder="Select preservation method…" />
                </SelectTrigger>
                <SelectContent>
                  {PRESERVATION_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-gray-400">
                Method used to preserve the organ.
              </p>
              <FieldError msg={errors.preservation_method} />
            </div>

            {/* Clinical Notes */}
            <div className="sm:col-span-2">
              <Label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Clinical / Warm Ischemia Information{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Textarea
                rows={4}
                maxLength={1000}
                placeholder="Enter clinical details, organ condition, procurement notes, ischemia observations…"
                value={form.clinical_notes}
                onChange={(e) => setField("clinical_notes", e.target.value)}
                className={
                  errors.clinical_notes
                    ? "border-red-400 ring-red-200 ring-1"
                    : ""
                }
              />
              <div className="flex items-start justify-between mt-1">
                <FieldError msg={errors.clinical_notes} />
                <span className="text-[11px] text-gray-400 ml-auto">
                  {form.clinical_notes.length} / 1000
                </span>
              </div>
            </div>

            {/* Additional Notes */}
            <div className="sm:col-span-2">
              <Label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Additional Notes{" "}
                <span className="text-gray-400 font-normal">(Optional)</span>
              </Label>
              <Textarea
                rows={3}
                maxLength={500}
                placeholder="Enter any additional notes…"
                value={form.additional_notes}
                onChange={(e) => setField("additional_notes", e.target.value)}
              />
              <div className="flex justify-end mt-1">
                <span className="text-[11px] text-gray-400">
                  {form.additional_notes.length} / 500
                </span>
              </div>
            </div>
          </div>

          {/* Accuracy banner */}
          <div className="mt-4">
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-900">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600" />
              <span>
                <strong>Please ensure all information is accurate.</strong>{" "}
                This record will be used for matching and allocation decisions.
              </span>
            </div>
          </div>

          {/* API error */}
          {submitError && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Footer buttons */}
          <div className="mt-8 flex items-center justify-between pt-5 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={registerMutation.isPending}
                className="gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            </div>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={registerMutation.isPending}
              className="gap-2 min-w-[140px]"
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Registering…
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4" /> Submit Organ
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
