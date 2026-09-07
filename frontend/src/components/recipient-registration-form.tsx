import * as React from "react";
import {
  Calendar as CalendarIcon,
  Check,
  Heart,
  Activity,
  Layers,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  UserRound,
  MapPin,
  ChevronDown,
  Eye,
  Bone,
  Flame,
  Shield,
  Loader2,
  CheckCircle2,
  FileCheck2,
  Clock,
  Building2,
  Pencil,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Standard Date formatting helper (e.g., "15 Aug 1990")
function formatDisplayDate(date: Date | undefined): string {
  if (!date) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isDateInFuture(date: Date | undefined): boolean {
  if (!date) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date.getTime() > today.getTime();
}

export interface RecipientRegistrationFormValues {
  // Step 1: Patient Details
  name: string;
  dateOfBirth: string; // ISO: YYYY-MM-DD
  gender: "Male" | "Female" | "Other" | "";
  bloodGroup: string;
  contactNumber: string;
  residentialAddress: string;
  city: string;
  state: string;
  pincode: string;

  // Step 2: Medical Information
  requiredOrganTissue: string;
  primaryDiagnosis: string;
  diagnosisDetails: string;
  dateOfDiagnosis: string; // ISO: YYYY-MM-DD
  diseaseStage: string;
  comorbidConditions: string[];
  height: string; // cm
  weight: string; // kg
  bmi: string; // auto-calculated
  bloodPressure: string;
  diabetes: "Yes" | "No" | "";
  hypertension: "Yes" | "No" | "";
  allergies: string;
  currentMedications: string;
  smokingStatus: string;
  additionalNotes: string;

  // Step 3: Declaration & Metadata
  declarationAcknowledged: boolean;
  registrationDate: string;
  age?: number;
}

interface RecipientRegistrationFormProps {
  initial?: Partial<RecipientRegistrationFormValues> | any;
  submitLabel?: string;
  submitting?: boolean;
  onSubmit: (values: RecipientRegistrationFormValues) => void;
  onCancel?: () => void;
  currentStep?: number;
  onStepChange?: (step: number) => void;
  errorMessage?: string | null;
  mode?: "create" | "edit";
  hospitalName?: string;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

const ORGAN_OPTIONS = [
  { id: "Kidney", label: "Kidney", icon: Activity, description: "Renal transplant" },
  { id: "Liver", label: "Liver", icon: Layers, description: "Hepatic transplant" },
  { id: "Heart", label: "Heart", icon: Heart, description: "Cardiac transplant" },
  { id: "Lung", label: "Lung", icon: Activity, description: "Pulmonary transplant" },
  { id: "Pancreas", label: "Pancreas", icon: Flame, description: "Pancreatic transplant" },
];

const STAGE_OPTIONS = [
  "Stage 1 - Mild",
  "Stage 2 - Moderate",
  "Stage 3 - Significant",
  "Stage 4 - Severe",
  "Stage 5 - Critical",
];

const COMORBID_OPTIONS = [
  "Hypertension",
  "Diabetes Mellitus (Type 1)",
  "Diabetes Mellitus (Type 2)",
  "Cardiovascular Disease",
  "Coronary Artery Disease",
  "Chronic Kidney Disease",
  "Anemia",
  "Dyslipidemia",
  "Asthma / COPD",
  "Hypothyroidism",
];

const SMOKING_STATUS_OPTIONS = [
  "Non-smoker",
  "Former smoker",
  "Current smoker",
  "Unknown",
];

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Chandigarh",
  "Puducherry",
  "Jammu and Kashmir",
  "Ladakh",
];

// Clean SVGs for Gender Symbols
function MaleSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="10" cy="14" r="5" />
      <path d="M19 5L13.6 10.4" />
      <path d="M19 5h-5" />
      <path d="M19 5v5" />
    </svg>
  );
}

function FemaleSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="9" r="5" />
      <path d="M12 14v7" />
      <path d="M9 18h6" />
    </svg>
  );
}

function OtherGenderSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 16v5" />
      <path d="M9 19h6" />
      <path d="M19 5L15 9" />
      <path d="M19 5h-4" />
      <path d="M19 5v4" />
    </svg>
  );
}

export function RecipientRegistrationForm({
  initial,
  submitLabel,
  submitting = false,
  onSubmit,
  onCancel,
  currentStep: controlledStep,
  onStepChange,
  errorMessage,
  mode = "create",
  hospitalName = "Assigned Hospital",
}: RecipientRegistrationFormProps) {
  // Step state (1: Patient Details, 2: Medical Information, 3: Review & Submit)
  const [internalStep, setInternalStep] = React.useState(1);
  const step = controlledStep !== undefined ? controlledStep : internalStep;

  const setStep = (newStep: number) => {
    if (onStepChange) {
      onStepChange(newStep);
    } else {
      setInternalStep(newStep);
    }
  };

  // Helper to parse dates from string or Date
  const parseInitialDate = (dVal: any): Date | undefined => {
    if (!dVal) return undefined;
    if (dVal instanceof Date) return dVal;
    try {
      const parts = String(dVal).split("T")[0].split("-");
      if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
      return new Date(dVal);
    } catch {
      return undefined;
    }
  };

  // Helper to extract phone digits
  const extractPhone = (val?: string): string => {
    if (!val) return "";
    const clean = val.replace(/\D/g, "");
    if (clean.length > 10 && clean.startsWith("91")) {
      return clean.slice(2, 12);
    }
    return clean.slice(-10);
  };

  // Extract initial fields
  const md = initial?.medicalDetails || initial?.medical_details || {};

  // Form Field State
  const [name, setName] = React.useState(initial?.name || "");
  const [dobDate, setDobDate] = React.useState<Date | undefined>(
    parseInitialDate(initial?.dateOfBirth || initial?.date_of_birth || md.dateOfBirth)
  );
  const [gender, setGender] = React.useState<"Male" | "Female" | "Other" | "">(
    initial?.gender || md.gender || "Male"
  );
  const [bloodGroup, setBloodGroup] = React.useState<string>(
    initial?.bloodGroup || initial?.blood_group || ""
  );
  const [phoneDigits, setPhoneDigits] = React.useState<string>(
    extractPhone(initial?.contactNumber || initial?.contact_number || md.contactNumber)
  );
  const [residentialAddress, setResidentialAddress] = React.useState<string>(
    initial?.residentialAddress || initial?.residential_address || md.residentialAddress || ""
  );
  const [city, setCity] = React.useState<string>(
    initial?.city || md.city || ""
  );
  const [state, setState] = React.useState<string>(
    initial?.state || md.state || ""
  );
  const [pincode, setPincode] = React.useState<string>(
    initial?.pincode || md.pincode || ""
  );

  // Step 2 Medical State
  const [requiredOrganTissue, setRequiredOrganTissue] = React.useState<string>(
    initial?.requiredOrgan || initial?.required_organ || md.requiredOrgan || "Kidney"
  );
  const [primaryDiagnosis, setPrimaryDiagnosis] = React.useState<string>(
    initial?.medicalCondition || md.primaryDiagnosis || md.condition || "Chronic Kidney Disease (CKD)"
  );
  const [diagnosisDetails, setDiagnosisDetails] = React.useState<string>(
    md.diagnosisDetails || ""
  );
  const [diagnosisDate, setDiagnosisDate] = React.useState<Date | undefined>(
    parseInitialDate(md.dateOfDiagnosis)
  );
  const [diseaseStage, setDiseaseStage] = React.useState<string>(
    md.diseaseStage || "Stage 4 - Severe"
  );
  const [comorbidConditions, setComorbidConditions] = React.useState<string[]>(
    Array.isArray(md.comorbidConditions) ? md.comorbidConditions : ["Hypertension"]
  );
  const [comorbidSearch, setComorbidSearch] = React.useState("");
  const [height, setHeight] = React.useState<string>(
    md.height ? String(md.height) : "170"
  );
  const [weight, setWeight] = React.useState<string>(
    md.weight ? String(md.weight) : "65"
  );
  const [bloodPressure, setBloodPressure] = React.useState<string>(
    md.bloodPressure || "120/80"
  );
  const [diabetes, setDiabetes] = React.useState<"Yes" | "No" | "">(
    md.diabetes === true || md.diabetes === "Yes" ? "Yes" : "No"
  );
  const [hypertension, setHypertension] = React.useState<"Yes" | "No" | "">(
    md.hypertension === true || md.hypertension === "Yes" ? "Yes" : "Yes"
  );
  const [allergies, setAllergies] = React.useState<string>(
    md.allergies || "Penicillin"
  );
  const [currentMedications, setCurrentMedications] = React.useState<string>(
    md.currentMedications || "Tab. Amlodipine 5mg OD"
  );
  const [smokingStatus, setSmokingStatus] = React.useState<string>(
    md.smokingStatus || "Non-smoker"
  );
  const [additionalNotes, setAdditionalNotes] = React.useState<string>(
    md.additionalNotes || md.notes || "Patient under regular nephrology follow-up."
  );

  // Declaration & Live Timestamp
  const [declarationAcknowledged, setDeclarationAcknowledged] = React.useState<boolean>(
    initial?.declarationAcknowledged ?? true
  );

  // Live IST Clock
  const [currentTimeStr, setCurrentTimeStr] = React.useState<string>("");
  const [currentDateStr, setCurrentDateStr] = React.useState<string>("");

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDateStr(
        now.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        })
      );
      setCurrentTimeStr(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        }) + " IST"
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate age from DOB
  const calculatedAge = React.useMemo(() => {
    if (!dobDate) return initial?.age || 0;
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
      age--;
    }
    return Math.max(0, age);
  }, [dobDate, initial?.age]);

  // Calculate BMI automatically: BMI = weight / (height in meters)^2
  const calculatedBmi = React.useMemo(() => {
    const hNum = parseFloat(height);
    const wNum = parseFloat(weight);
    if (!hNum || !wNum || hNum <= 0 || wNum <= 0) return "";
    const heightInMeters = hNum / 100;
    const bmiVal = wNum / (heightInMeters * heightInMeters);
    return bmiVal.toFixed(1);
  }, [height, weight]);

  // Validation State & Triggers
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  // Validation Errors
  const errors = React.useMemo(() => {
    const errs: Record<string, string> = {};

    // Step 1 Validation
    if (!name.trim()) {
      errs.name = "Full Name is required.";
    }
    if (!dobDate) {
      errs.dob = "Date of Birth is required.";
    } else if (isDateInFuture(dobDate)) {
      errs.dob = "Date of Birth cannot be in the future.";
    }
    if (!gender) {
      errs.gender = "Gender selection is required.";
    }
    if (!bloodGroup) {
      errs.bloodGroup = "Blood group is required.";
    }
    if (!phoneDigits) {
      errs.phone = "Contact number is required.";
    } else if (phoneDigits.length !== 10) {
      errs.phone = "Please enter a valid 10-digit Indian mobile number.";
    }
    if (!residentialAddress.trim()) {
      errs.residentialAddress = "Residential address is required.";
    }
    if (!city.trim()) {
      errs.city = "City is required.";
    }
    if (!state.trim()) {
      errs.state = "State is required.";
    }
    if (!pincode.trim()) {
      errs.pincode = "Pincode is required.";
    } else if (!/^\d{6}$/.test(pincode.trim())) {
      errs.pincode = "Pincode must be exactly 6 digits.";
    }

    // Step 2 Validation
    if (!requiredOrganTissue) {
      errs.requiredOrganTissue = "Please select the required organ/tissue.";
    }
    if (!primaryDiagnosis.trim()) {
      errs.primaryDiagnosis = "Primary diagnosis is required.";
    }
    if (!diagnosisDate) {
      errs.diagnosisDate = "Date of diagnosis is required.";
    } else if (isDateInFuture(diagnosisDate)) {
      errs.diagnosisDate = "Diagnosis date cannot be in the future.";
    }
    if (!height || parseFloat(height) <= 0) {
      errs.height = "Valid height in cm is required.";
    }
    if (!weight || parseFloat(weight) <= 0) {
      errs.weight = "Valid weight in kg is required.";
    }

    return errs;
  }, [
    name,
    dobDate,
    gender,
    bloodGroup,
    phoneDigits,
    residentialAddress,
    city,
    state,
    pincode,
    requiredOrganTissue,
    primaryDiagnosis,
    diagnosisDate,
    height,
    weight,
  ]);

  const isStep1Valid = !(
    errors.name ||
    errors.dob ||
    errors.gender ||
    errors.bloodGroup ||
    errors.phone ||
    errors.residentialAddress ||
    errors.city ||
    errors.state ||
    errors.pincode
  );

  const isStep2Valid = !(
    errors.requiredOrganTissue ||
    errors.primaryDiagnosis ||
    errors.diagnosisDate ||
    errors.height ||
    errors.weight
  );

  const handleNextToStep2 = () => {
    setTouched((prev) => ({
      ...prev,
      name: true,
      dob: true,
      gender: true,
      bloodGroup: true,
      phone: true,
      residentialAddress: true,
      city: true,
      state: true,
      pincode: true,
    }));
    if (isStep1Valid) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNextToStep3 = () => {
    setTouched((prev) => ({
      ...prev,
      requiredOrganTissue: true,
      primaryDiagnosis: true,
      diagnosisDate: true,
      height: true,
      weight: true,
    }));
    if (isStep2Valid) {
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStep1Valid || !isStep2Valid) {
      setTouched({
        name: true,
        dob: true,
        gender: true,
        bloodGroup: true,
        phone: true,
        residentialAddress: true,
        city: true,
        state: true,
        pincode: true,
        requiredOrganTissue: true,
        primaryDiagnosis: true,
        diagnosisDate: true,
        height: true,
        weight: true,
      });
      return;
    }

    const fullPhone = `+91 ${phoneDigits}`;
    const isoDob = dobDate ? toIsoDate(dobDate) : "";
    const isoDiagnosisDate = diagnosisDate ? toIsoDate(diagnosisDate) : "";

    const payload: RecipientRegistrationFormValues = {
      name: name.trim(),
      dateOfBirth: isoDob,
      gender,
      bloodGroup,
      contactNumber: fullPhone,
      residentialAddress: residentialAddress.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      requiredOrganTissue,
      primaryDiagnosis: primaryDiagnosis.trim(),
      diagnosisDetails: diagnosisDetails.trim(),
      dateOfDiagnosis: isoDiagnosisDate,
      diseaseStage,
      comorbidConditions,
      height: height.trim(),
      weight: weight.trim(),
      bmi: calculatedBmi,
      bloodPressure: bloodPressure.trim(),
      diabetes,
      hypertension,
      allergies: allergies.trim(),
      currentMedications: currentMedications.trim(),
      smokingStatus,
      additionalNotes: additionalNotes.trim(),
      declarationAcknowledged,
      registrationDate: toIsoDate(new Date()),
      age: calculatedAge,
    };

    onSubmit(payload);
  };

  // Popover calendar open states
  const [dobCalendarOpen, setDobCalendarOpen] = React.useState(false);
  const [diagnosisCalendarOpen, setDiagnosisCalendarOpen] = React.useState(false);

  // Comorbid condition toggle helper
  const toggleComorbid = (cond: string) => {
    setComorbidConditions((prev) =>
      prev.includes(cond) ? prev.filter((c) => c !== cond) : [...prev, cond]
    );
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden font-sans text-slate-800 transition-all">
      {/* Top Header Stepper Banner */}
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/50 via-white to-slate-50/50 px-6 py-5 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {mode === "edit" ? "Edit Recipient Dossier" : "Register New Recipient"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Add a new patient to the hospital waiting list for organ transplantation.
            </p>
          </div>

          {/* Stepper Component */}
          <div className="flex items-center gap-1 sm:gap-2 select-none self-end sm:self-auto">
            {/* Step 1 Indicator */}
            <button
              type="button"
              onClick={() => setStep(1)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                step === 1
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                  : step > 1
                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "bg-slate-100 text-slate-400"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold",
                  step === 1
                    ? "bg-white text-blue-600"
                    : step > 1
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-500"
                )}
              >
                {step > 1 ? <Check className="h-3 w-3 stroke-[3]" /> : "1"}
              </span>
              <span className="hidden md:inline">Patient Details</span>
            </button>

            {/* Connecting Bar 1 */}
            <div
              className={cn(
                "h-[2px] w-6 sm:w-10 rounded-full transition-colors",
                step >= 2 ? "bg-blue-600" : "bg-slate-200"
              )}
            />

            {/* Step 2 Indicator */}
            <button
              type="button"
              onClick={() => {
                if (isStep1Valid) setStep(2);
                else handleNextToStep2();
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                step === 2
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                  : step > 2
                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "bg-slate-100 text-slate-400"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold",
                  step === 2
                    ? "bg-white text-blue-600"
                    : step > 2
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-500"
                )}
              >
                {step > 2 ? <Check className="h-3 w-3 stroke-[3]" /> : "2"}
              </span>
              <span className="hidden md:inline">Medical Information</span>
            </button>

            {/* Connecting Bar 2 */}
            <div
              className={cn(
                "h-[2px] w-6 sm:w-10 rounded-full transition-colors",
                step >= 3 ? "bg-blue-600" : "bg-slate-200"
              )}
            />

            {/* Step 3 Indicator */}
            <button
              type="button"
              onClick={() => {
                if (isStep1Valid && isStep2Valid) setStep(3);
                else if (!isStep1Valid) handleNextToStep2();
                else handleNextToStep3();
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                step === 3
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                  : "bg-slate-100 text-slate-400"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold",
                  step === 3
                    ? "bg-white text-blue-600"
                    : "bg-slate-200 text-slate-500"
                )}
              >
                3
              </span>
              <span className="hidden md:inline">Review & Submit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="mx-6 sm:mx-8 mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-800 text-sm flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-rose-900">Registration could not be completed</h4>
            <p className="mt-0.5 text-xs sm:text-sm text-rose-700">
              {errorMessage}
            </p>
          </div>
        </div>
      )}

      {/* Main Form Content */}
      <form onSubmit={handleSubmit} className="p-6 sm:p-8">
        {/* ========================================================================= */}
        {/* STEP 1: PATIENT DETAILS                                                  */}
        {/* ========================================================================= */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold tracking-tight text-blue-900 uppercase flex items-center gap-2">
                <span>1. Patient Details</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">* Required fields</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Full Name */}
              <div className="space-y-1.5">
                <Label htmlFor="recipient-name" className="text-xs font-semibold text-slate-700">
                  Full Name <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <UserRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="recipient-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => setTouched((p) => ({ ...p, name: true }))}
                    placeholder="Enter patient full name"
                    className={cn(
                      "pl-10 h-11 bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl transition-all",
                      touched.name && errors.name && "border-rose-300 ring-rose-100"
                    )}
                  />
                </div>
                {touched.name && errors.name && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.name}</p>
                )}
              </div>

              {/* Date of Birth Calendar Picker */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="recipient-dob" className="text-xs font-semibold text-slate-700">
                    Date of Birth <span className="text-rose-500">*</span>
                  </Label>
                  {dobDate && (
                    <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      {calculatedAge} years
                    </span>
                  )}
                </div>
                <Popover open={dobCalendarOpen} onOpenChange={setDobCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="recipient-dob"
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full h-11 justify-start text-left font-normal bg-slate-50/50 border-slate-200 hover:bg-white text-sm rounded-xl px-3.5",
                        !dobDate && "text-slate-400",
                        touched.dob && errors.dob && "border-rose-300 ring-rose-100"
                      )}
                    >
                      <CalendarIcon className="mr-2.5 h-4 w-4 text-slate-400 shrink-0" />
                      {dobDate ? formatDisplayDate(dobDate) : <span>Select date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50 shadow-xl rounded-2xl border-slate-200" align="start">
                    <Calendar
                      mode="single"
                      selected={dobDate}
                      onSelect={(selectedDay) => {
                        if (selectedDay) {
                          setDobDate(selectedDay);
                          setDobCalendarOpen(false);
                          setTouched((p) => ({ ...p, dob: true }));
                        }
                      }}
                      disabled={(d) => isDateInFuture(d)}
                      initialFocus
                      className="p-3"
                    />
                  </PopoverContent>
                </Popover>
                {touched.dob && errors.dob && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.dob}</p>
                )}
              </div>

              {/* Gender Selection Cards */}
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Gender <span className="text-rose-500">*</span>
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Male Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setGender("Male");
                      setTouched((p) => ({ ...p, gender: true }));
                    }}
                    className={cn(
                      "flex items-center justify-center gap-1.5 h-11 px-2.5 rounded-xl border text-xs font-semibold transition-all relative",
                      gender === "Male"
                        ? "border-blue-600 bg-blue-50/80 text-blue-700 shadow-sm ring-2 ring-blue-600/10"
                        : "border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-600"
                    )}
                  >
                    <MaleSymbol className="h-4 w-4 shrink-0 text-blue-600" />
                    <span>Male</span>
                    {gender === "Male" && (
                      <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-600" />
                    )}
                  </button>

                  {/* Female Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setGender("Female");
                      setTouched((p) => ({ ...p, gender: true }));
                    }}
                    className={cn(
                      "flex items-center justify-center gap-1.5 h-11 px-2.5 rounded-xl border text-xs font-semibold transition-all relative",
                      gender === "Female"
                        ? "border-pink-600 bg-pink-50/80 text-pink-700 shadow-sm ring-2 ring-pink-600/10"
                        : "border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-600"
                    )}
                  >
                    <FemaleSymbol className="h-4 w-4 shrink-0 text-pink-600" />
                    <span>Female</span>
                    {gender === "Female" && (
                      <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-pink-600" />
                    )}
                  </button>

                  {/* Other Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setGender("Other");
                      setTouched((p) => ({ ...p, gender: true }));
                    }}
                    className={cn(
                      "flex items-center justify-center gap-1.5 h-11 px-2.5 rounded-xl border text-xs font-semibold transition-all relative",
                      gender === "Other"
                        ? "border-purple-600 bg-purple-50/80 text-purple-700 shadow-sm ring-2 ring-purple-600/10"
                        : "border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-600"
                    )}
                  >
                    <OtherGenderSymbol className="h-4 w-4 shrink-0 text-purple-600" />
                    <span>Other</span>
                    {gender === "Other" && (
                      <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-purple-600" />
                    )}
                  </button>
                </div>
                {touched.gender && errors.gender && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.gender}</p>
                )}
              </div>

              {/* Recipient Code (Auto-generated) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Recipient Code (Auto-generated)
                </Label>
                <div className="h-11 px-3.5 flex items-center rounded-xl bg-slate-100/70 border border-slate-200/80 text-slate-500 font-mono text-xs select-none">
                  REC- <span className="italic ml-2 text-slate-400 font-sans">Will be generated automatically</span>
                </div>
              </div>

              {/* Blood Group Dropdown */}
              <div className="space-y-1.5">
                <Label htmlFor="recipient-blood-group" className="text-xs font-semibold text-slate-700">
                  Blood Group <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={bloodGroup}
                  onValueChange={(val) => {
                    setBloodGroup(val);
                    setTouched((p) => ({ ...p, bloodGroup: true }));
                  }}
                >
                  <SelectTrigger
                    id="recipient-blood-group"
                    className={cn(
                      "h-11 bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl",
                      touched.bloodGroup && errors.bloodGroup && "border-rose-300 ring-rose-100"
                    )}
                  >
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200">
                    {BLOOD_GROUPS.map((bg) => (
                      <SelectItem key={bg} value={bg} className="font-medium text-sm py-2">
                        {bg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {touched.bloodGroup && errors.bloodGroup && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.bloodGroup}</p>
                )}
              </div>

              {/* Contact Number (India +91) */}
              <div className="space-y-1.5">
                <Label htmlFor="recipient-phone" className="text-xs font-semibold text-slate-700">
                  Contact Number <span className="text-rose-500">*</span>
                </Label>
                <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-slate-50/50 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100/80 border-r border-slate-200 text-xs font-semibold text-slate-700 select-none shrink-0">
                    <span className="text-base">🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <Input
                    id="recipient-phone"
                    type="tel"
                    maxLength={10}
                    value={phoneDigits}
                    onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
                    placeholder="98765 43210"
                    className="border-0 shadow-none focus-visible:ring-0 h-11 text-sm bg-transparent rounded-none"
                  />
                </div>
                {touched.phone && errors.phone ? (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.phone}</p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">Enter a valid 10-digit mobile number</p>
                )}
              </div>

              {/* Residential Address */}
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="recipient-address" className="text-xs font-semibold text-slate-700">
                  Residential Address <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="recipient-address"
                    value={residentialAddress}
                    onChange={(e) => setResidentialAddress(e.target.value)}
                    onBlur={() => setTouched((p) => ({ ...p, residentialAddress: true }))}
                    placeholder="e.g. 45, Green Park Colony, Lajpat Nagar 2, New Delhi - 110024, India"
                    className={cn(
                      "pl-10 h-11 bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl transition-all",
                      touched.residentialAddress && errors.residentialAddress && "border-rose-300 ring-rose-100"
                    )}
                  />
                </div>
                {touched.residentialAddress && errors.residentialAddress ? (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.residentialAddress}</p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">Please provide complete residential address</p>
                )}
              </div>

              {/* City */}
              <div className="space-y-1.5">
                <Label htmlFor="recipient-city" className="text-xs font-semibold text-slate-700">
                  City <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="recipient-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    onBlur={() => setTouched((p) => ({ ...p, city: true }))}
                    placeholder="Enter city"
                    className={cn(
                      "pl-10 h-11 bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl",
                      touched.city && errors.city && "border-rose-300 ring-rose-100"
                    )}
                  />
                </div>
                {touched.city && errors.city && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.city}</p>
                )}
              </div>

              {/* State Dropdown */}
              <div className="space-y-1.5">
                <Label htmlFor="recipient-state" className="text-xs font-semibold text-slate-700">
                  State <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={state}
                  onValueChange={(val) => {
                    setState(val);
                    setTouched((p) => ({ ...p, state: true }));
                  }}
                >
                  <SelectTrigger
                    id="recipient-state"
                    className={cn(
                      "h-11 bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl",
                      touched.state && errors.state && "border-rose-300 ring-rose-100"
                    )}
                  >
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 rounded-xl border-slate-200">
                    {INDIAN_STATES.map((st) => (
                      <SelectItem key={st} value={st} className="font-medium text-sm py-2">
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {touched.state && errors.state && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.state}</p>
                )}
              </div>

              {/* Pincode */}
              <div className="space-y-1.5">
                <Label htmlFor="recipient-pincode" className="text-xs font-semibold text-slate-700">
                  Pincode <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="recipient-pincode"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onBlur={() => setTouched((p) => ({ ...p, pincode: true }))}
                  placeholder="e.g. 110024"
                  className={cn(
                    "h-11 bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl font-mono",
                    touched.pincode && errors.pincode && "border-rose-300 ring-rose-100"
                  )}
                />
                {touched.pincode && errors.pincode ? (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.pincode}</p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">6 digit pincode</p>
                )}
              </div>
            </div>

            {/* Bottom Actions for Step 1 */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              {onCancel ? (
                <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl px-5 h-11 text-xs font-semibold">
                  ← Cancel
                </Button>
              ) : <div />}
              <Button
                type="button"
                onClick={handleNextToStep2}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 h-11 text-xs font-bold shadow-md shadow-blue-200 gap-1.5 transition-all"
              >
                <span>Save &amp; Next</span>
                <span>→</span>
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: MEDICAL INFORMATION                                              */}
        {/* ========================================================================= */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold tracking-tight text-blue-900 uppercase flex items-center gap-2">
                <span>2. Medical Information</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">* Required fields</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Required Organ / Tissue Selection */}
              <div className="space-y-1.5">
                <Label htmlFor="recipient-organ" className="text-xs font-semibold text-slate-700">
                  Required Organ/Tissue <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={requiredOrganTissue}
                  onValueChange={(val) => {
                    setRequiredOrganTissue(val);
                    setTouched((p) => ({ ...p, requiredOrganTissue: true }));
                  }}
                >
                  <SelectTrigger
                    id="recipient-organ"
                    className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl"
                  >
                    <SelectValue placeholder="Select required organ" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200">
                    {ORGAN_OPTIONS.map((org) => {
                      const IconComp = org.icon;
                      return (
                        <SelectItem key={org.id} value={org.id} className="py-2">
                          <div className="flex items-center gap-2.5">
                            <IconComp className="h-4 w-4 text-blue-600" />
                            <span className="font-semibold text-slate-800">{org.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {touched.requiredOrganTissue && errors.requiredOrganTissue && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.requiredOrganTissue}</p>
                )}
              </div>

              {/* Primary Diagnosis (Searchable Input) */}
              <div className="space-y-1.5">
                <Label htmlFor="primary-diagnosis" className="text-xs font-semibold text-slate-700">
                  Primary Diagnosis <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="primary-diagnosis"
                    value={primaryDiagnosis}
                    onChange={(e) => setPrimaryDiagnosis(e.target.value)}
                    onBlur={() => setTouched((p) => ({ ...p, primaryDiagnosis: true }))}
                    placeholder="e.g. Chronic Kidney Disease (CKD)"
                    className={cn(
                      "h-11 bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl pr-10",
                      touched.primaryDiagnosis && errors.primaryDiagnosis && "border-rose-300 ring-rose-100"
                    )}
                  />
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
                {touched.primaryDiagnosis && errors.primaryDiagnosis && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.primaryDiagnosis}</p>
                )}
              </div>

              {/* Diagnosis Details (Textarea with counter) */}
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="diagnosis-details" className="text-xs font-semibold text-slate-700">
                    Diagnosis Details
                  </Label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {diagnosisDetails.length}/200
                  </span>
                </div>
                <Input
                  id="diagnosis-details"
                  maxLength={200}
                  value={diagnosisDetails}
                  onChange={(e) => setDiagnosisDetails(e.target.value)}
                  placeholder="Provide details about the primary diagnosis, duration, etc."
                  className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl"
                />
              </div>

              {/* Date of Diagnosis */}
              <div className="space-y-1.5">
                <Label htmlFor="diagnosis-date" className="text-xs font-semibold text-slate-700">
                  Date of Diagnosis <span className="text-rose-500">*</span>
                </Label>
                <Popover open={diagnosisCalendarOpen} onOpenChange={setDiagnosisCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="diagnosis-date"
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full h-11 justify-start text-left font-normal bg-slate-50/50 border-slate-200 hover:bg-white text-sm rounded-xl px-3.5",
                        !diagnosisDate && "text-slate-400",
                        touched.diagnosisDate && errors.diagnosisDate && "border-rose-300 ring-rose-100"
                      )}
                    >
                      <CalendarIcon className="mr-2.5 h-4 w-4 text-slate-400 shrink-0" />
                      {diagnosisDate ? formatDisplayDate(diagnosisDate) : <span>Select date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50 shadow-xl rounded-2xl border-slate-200" align="start">
                    <Calendar
                      mode="single"
                      selected={diagnosisDate}
                      onSelect={(selectedDay) => {
                        if (selectedDay) {
                          setDiagnosisDate(selectedDay);
                          setDiagnosisCalendarOpen(false);
                          setTouched((p) => ({ ...p, diagnosisDate: true }));
                        }
                      }}
                      disabled={(d) => isDateInFuture(d)}
                      initialFocus
                      className="p-3"
                    />
                  </PopoverContent>
                </Popover>
                {touched.diagnosisDate && errors.diagnosisDate && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.diagnosisDate}</p>
                )}
              </div>

              {/* Disease Stage / Severity */}
              <div className="space-y-1.5">
                <Label htmlFor="disease-stage" className="text-xs font-semibold text-slate-700">
                  Disease Stage / Severity
                </Label>
                <Select value={diseaseStage} onValueChange={setDiseaseStage}>
                  <SelectTrigger id="disease-stage" className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl">
                    <SelectValue placeholder="Select stage / severity" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200">
                    {STAGE_OPTIONS.map((stg) => (
                      <SelectItem key={stg} value={stg} className="font-medium text-sm py-2">
                        {stg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Comorbid Conditions Search / Chips */}
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Comorbid Conditions
                </Label>
                <div className="relative">
                  <Select
                    value=""
                    onValueChange={(val) => {
                      if (val && !comorbidConditions.includes(val)) {
                        setComorbidConditions([...comorbidConditions, val]);
                      }
                    }}
                  >
                    <SelectTrigger className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl">
                      <span className="text-slate-400 text-xs truncate">
                        {comorbidConditions.length > 0
                          ? `${comorbidConditions.length} condition(s) selected`
                          : "Search or select conditions"}
                      </span>
                    </SelectTrigger>
                    <SelectContent className="max-h-60 rounded-xl border-slate-200">
                      {COMORBID_OPTIONS.map((cond) => (
                        <SelectItem key={cond} value={cond} className="font-medium text-sm py-2">
                          <div className="flex items-center justify-between w-full">
                            <span>{cond}</span>
                            {comorbidConditions.includes(cond) && (
                              <Check className="h-4 w-4 text-blue-600 ml-2" />
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {comorbidConditions.map((c) => (
                    <span
                      key={c}
                      onClick={() => toggleComorbid(c)}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-100"
                    >
                      {c}
                      <span className="text-blue-400 hover:text-blue-600 ml-0.5">×</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Height (cm) */}
              <div className="space-y-1.5">
                <Label htmlFor="recipient-height" className="text-xs font-semibold text-slate-700">
                  Height (cm) <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="recipient-height"
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    onBlur={() => setTouched((p) => ({ ...p, height: true }))}
                    placeholder="e.g. 170"
                    className={cn(
                      "h-11 bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl pr-10",
                      touched.height && errors.height && "border-rose-300 ring-rose-100"
                    )}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold pointer-events-none">
                    cm
                  </span>
                </div>
                {touched.height && errors.height && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.height}</p>
                )}
              </div>

              {/* Weight (kg) */}
              <div className="space-y-1.5">
                <Label htmlFor="recipient-weight" className="text-xs font-semibold text-slate-700">
                  Weight (kg) <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="recipient-weight"
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    onBlur={() => setTouched((p) => ({ ...p, weight: true }))}
                    placeholder="e.g. 65"
                    className={cn(
                      "h-11 bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl pr-10",
                      touched.weight && errors.weight && "border-rose-300 ring-rose-100"
                    )}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold pointer-events-none">
                    kg
                  </span>
                </div>
                {touched.weight && errors.weight && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.weight}</p>
                )}
              </div>

              {/* Body Mass Index (BMI) - Auto-calculated */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Body Mass Index (BMI)
                </Label>
                <div className="relative h-11 px-3.5 flex items-center justify-between rounded-xl bg-slate-100/70 border border-slate-200/80 text-slate-700 font-semibold text-sm">
                  <span>{calculatedBmi ? `${calculatedBmi}` : "Auto-calculated"}</span>
                  <span className="text-xs text-slate-400 font-normal">kg/m²</span>
                </div>
              </div>

              {/* Blood Pressure */}
              <div className="space-y-1.5">
                <Label htmlFor="blood-pressure" className="text-xs font-semibold text-slate-700">
                  Blood Pressure
                </Label>
                <div className="relative">
                  <Input
                    id="blood-pressure"
                    value={bloodPressure}
                    onChange={(e) => setBloodPressure(e.target.value)}
                    placeholder="e.g. 120/80"
                    className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl pr-14"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold pointer-events-none">
                    mmHg
                  </span>
                </div>
              </div>

              {/* Diabetes Selection (Yes / No) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Diabetes
                </Label>
                <div className="flex items-center gap-3 h-11">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="radio"
                      name="diabetes"
                      checked={diabetes === "Yes"}
                      onChange={() => setDiabetes("Yes")}
                      className="h-4 w-4 text-blue-600 rounded-full border-slate-300 focus:ring-blue-500"
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="radio"
                      name="diabetes"
                      checked={diabetes === "No"}
                      onChange={() => setDiabetes("No")}
                      className="h-4 w-4 text-blue-600 rounded-full border-slate-300 focus:ring-blue-500"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>

              {/* Hypertension Selection (Yes / No) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Hypertension
                </Label>
                <div className="flex items-center gap-3 h-11">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="radio"
                      name="hypertension"
                      checked={hypertension === "Yes"}
                      onChange={() => setHypertension("Yes")}
                      className="h-4 w-4 text-blue-600 rounded-full border-slate-300 focus:ring-blue-500"
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="radio"
                      name="hypertension"
                      checked={hypertension === "No"}
                      onChange={() => setHypertension("No")}
                      className="h-4 w-4 text-blue-600 rounded-full border-slate-300 focus:ring-blue-500"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>

              {/* Allergies */}
              <div className="space-y-1.5">
                <Label htmlFor="recipient-allergies" className="text-xs font-semibold text-slate-700">
                  Allergies (if any)
                </Label>
                <Input
                  id="recipient-allergies"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="e.g. Penicillin, Nuts, etc."
                  className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl"
                />
              </div>

              {/* Current Medications */}
              <div className="space-y-1.5">
                <Label htmlFor="current-medications" className="text-xs font-semibold text-slate-700">
                  Current Medications
                </Label>
                <Input
                  id="current-medications"
                  value={currentMedications}
                  onChange={(e) => setCurrentMedications(e.target.value)}
                  placeholder="e.g. Tab. Amlodipine 5mg OD"
                  className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl"
                />
              </div>

              {/* Smoking Status */}
              <div className="space-y-1.5">
                <Label htmlFor="smoking-status" className="text-xs font-semibold text-slate-700">
                  Smoking Status
                </Label>
                <Select value={smokingStatus} onValueChange={setSmokingStatus}>
                  <SelectTrigger id="smoking-status" className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl">
                    <SelectValue placeholder="Select smoking status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200">
                    {SMOKING_STATUS_OPTIONS.map((sms) => (
                      <SelectItem key={sms} value={sms} className="font-medium text-sm py-2">
                        {sms}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Additional Medical Notes */}
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="additional-notes" className="text-xs font-semibold text-slate-700">
                    Additional Medical Notes
                  </Label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {additionalNotes.length}/300
                  </span>
                </div>
                <Textarea
                  id="additional-notes"
                  maxLength={300}
                  rows={2}
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any additional medical information that may be relevant..."
                  className="bg-slate-50/50 border-slate-200 focus:bg-white text-sm rounded-xl resize-none"
                />
              </div>
            </div>

            {/* Bottom Actions for Step 2 */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="rounded-xl px-5 h-11 text-xs font-semibold"
              >
                ← Back: Patient Details
              </Button>
              <Button
                type="button"
                onClick={handleNextToStep3}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 h-11 text-xs font-bold shadow-md shadow-blue-200 gap-1.5 transition-all"
              >
                <span>Save &amp; Next</span>
                <span>→</span>
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: REVIEW & SUBMIT                                                  */}
        {/* ========================================================================= */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold tracking-tight text-blue-900 uppercase">
                  3. Review &amp; Submit
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Please review all the information carefully before submitting.
                </p>
              </div>
            </div>

            {/* CARD 1: PATIENT DETAILS */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-blue-600" />
                  <span>Patient Details</span>
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="h-8 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Full Name</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">{name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Date of Birth</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                    {dobDate ? formatDisplayDate(dobDate) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Gender</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block flex items-center gap-1">
                    {gender === "Male" && <MaleSymbol className="h-3.5 w-3.5 text-blue-600" />}
                    {gender === "Female" && <FemaleSymbol className="h-3.5 w-3.5 text-pink-600" />}
                    {gender === "Other" && <OtherGenderSymbol className="h-3.5 w-3.5 text-purple-600" />}
                    <span>{gender || "—"}</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Blood Group</span>
                  <span className="font-bold text-blue-700 text-sm mt-0.5 block bg-blue-50 px-2.5 py-0.5 rounded-md inline-block border border-blue-200">
                    {bloodGroup || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Contact Number</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block font-mono">
                    +91 {phoneDigits || "—"}
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <span className="text-slate-400 block font-medium">Recipient Code</span>
                  <span className="font-mono font-bold text-slate-700 text-xs mt-0.5 block">
                    REC-2026-00048 (Auto-generated)
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block font-medium">Residential Address</span>
                  <span className="font-medium text-slate-700 text-xs mt-0.5 block">
                    {residentialAddress || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">City / State / Pincode</span>
                  <span className="font-medium text-slate-700 text-xs mt-0.5 block">
                    {[city, state, pincode].filter(Boolean).join(" / ") || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* CARD 2: MEDICAL INFORMATION */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-600" />
                  <span>Medical Information</span>
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(2)}
                  className="h-8 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Required Organ/Tissue</span>
                  <span className="font-bold text-blue-700 text-sm mt-0.5 block">{requiredOrganTissue}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block font-medium">Primary Diagnosis</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">{primaryDiagnosis}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Date of Diagnosis</span>
                  <span className="font-medium text-slate-800 text-xs mt-0.5 block">
                    {diagnosisDate ? formatDisplayDate(diagnosisDate) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Disease Stage / Severity</span>
                  <span className="font-medium text-slate-800 text-xs mt-0.5 block">{diseaseStage}</span>
                </div>

                <div>
                  <span className="text-slate-400 block font-medium">Height / Weight / BMI</span>
                  <span className="font-medium text-slate-800 text-xs mt-0.5 block">
                    {height} cm / {weight} kg / {calculatedBmi} kg/m²
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Blood Pressure</span>
                  <span className="font-medium text-slate-800 text-xs mt-0.5 block">{bloodPressure} mmHg</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Diabetes</span>
                  <span className="font-semibold text-slate-800 text-xs mt-0.5 block flex items-center gap-1">
                    {diabetes === "Yes" ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                      </span>
                    ) : (
                      <span className="text-slate-600">No</span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Hypertension</span>
                  <span className="font-semibold text-slate-800 text-xs mt-0.5 block flex items-center gap-1">
                    {hypertension === "Yes" ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                      </span>
                    ) : (
                      <span className="text-slate-600">No</span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Smoking Status</span>
                  <span className="font-medium text-slate-800 text-xs mt-0.5 block">{smokingStatus}</span>
                </div>

                <div className="sm:col-span-2">
                  <span className="text-slate-400 block font-medium">Comorbid Conditions</span>
                  <span className="font-medium text-slate-700 text-xs mt-0.5 block">
                    {comorbidConditions.join(", ") || "None recorded"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Allergies (if any)</span>
                  <span className="font-medium text-slate-700 text-xs mt-0.5 block">{allergies || "None"}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block font-medium">Current Medications</span>
                  <span className="font-medium text-slate-700 text-xs mt-0.5 block">{currentMedications || "None"}</span>
                </div>

                <div className="sm:col-span-5">
                  <span className="text-slate-400 block font-medium">Additional Medical Notes</span>
                  <span className="font-medium text-slate-700 text-xs mt-0.5 block">
                    {additionalNotes || "No additional notes."}
                  </span>
                </div>
              </div>
            </div>

            {/* CARD 3: DECLARATION & REGISTRATION METADATA */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Declaration &amp; Registration</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Declaration</span>
                  <div className="mt-1 flex items-center gap-2 text-emerald-700 font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Declaration acknowledged</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block font-medium">Registration Date &amp; Time</span>
                  <div className="mt-1 flex items-center gap-3 text-slate-700 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                      {currentDateStr || "28 Aug 2026"}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {currentTimeStr || "04:45:12 PM IST"}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions for Step 3 */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(2)}
                className="rounded-xl px-5 h-11 text-xs font-semibold"
              >
                ← Back: Medical Information
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 h-11 text-xs font-bold shadow-md shadow-blue-200 gap-2 transition-all"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Submitting Registration...</span>
                  </>
                ) : (
                  <>
                    <span>{submitLabel || "Submit Registration"}</span>
                    <Check className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
