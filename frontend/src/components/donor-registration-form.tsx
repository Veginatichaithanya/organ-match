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

export interface DonorRegistrationFormValues {
  name: string;
  dateOfBirth: string; // ISO format: YYYY-MM-DD
  gender: "Male" | "Female" | "Other" | "";
  bloodGroup: string;
  contactNumber: string;
  residentialAddress: string;
  donationPreferences: {
    organs: string[];
    tissues: string[];
    other_organs?: string;
    other_tissues?: string;
  };
  declarationAcknowledged: boolean;
  registrationDate: string; // ISO format: YYYY-MM-DD
}

interface DonorRegistrationFormProps {
  initial?: Partial<DonorRegistrationFormValues> | any;
  submitLabel?: string;
  submitting?: boolean;
  onSubmit: (values: DonorRegistrationFormValues) => void;
  onCancel?: () => void;
  currentStep?: number;
  onStepChange?: (step: number) => void;
  errorMessage?: string | null;
  mode?: "create" | "edit";
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

const ORGAN_OPTIONS = [
  { id: "Kidney", label: "Kidney", icon: Activity, description: "Renal donation" },
  { id: "Liver", label: "Liver", icon: Layers, description: "Hepatic donation" },
  { id: "Heart", label: "Heart", icon: Heart, description: "Cardiac donation" },
  { id: "Pancreas", label: "Pancreas", icon: Flame, description: "Pancreatic donation" },
  { id: "Other Organs", label: "Other Organs", icon: Sparkles, description: "Lungs, Small Bowel, etc." },
];

const TISSUE_OPTIONS = [
  { id: "Corneas", label: "Corneas", icon: Eye, description: "Ocular tissue" },
  { id: "Bone", label: "Bone", icon: Bone, description: "Musculoskeletal graft" },
  { id: "Heart Valves", label: "Heart Valves", icon: Shield, description: "Valvular homograft" },
  { id: "Skin", label: "Skin", icon: Layers, description: "Dermal allograft" },
  { id: "Other Tissues", label: "Other Tissues", icon: Sparkles, description: "Tendons, Cartilage, etc." },
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
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 7.5V3" />
      <path d="M9.5 5h5" />
      <path d="M15.5 15.5L19 19" />
      <path d="M16 19h3v-3" />
      <path d="M8.5 15.5L5 19" />
      <path d="M8 19H5v-3" />
    </svg>
  );
}

export function DonorRegistrationForm({
  initial,
  submitLabel,
  submitting = false,
  onSubmit,
  onCancel,
  currentStep: externalStep,
  onStepChange,
  errorMessage,
  mode = "create",
}: DonorRegistrationFormProps) {
  // Step state: 1, 2, 3
  const [internalStep, setInternalStep] = React.useState<number>(1);
  const currentStep = externalStep !== undefined ? externalStep : internalStep;

  const setStep = (s: number) => {
    setInternalStep(s);
    onStepChange?.(s);
  };

  // Helper to parse initial DOB
  const parseInitialDate = (dStr: any): Date | undefined => {
    if (!dStr) return undefined;
    if (dStr instanceof Date) return dStr;
    const parsed = new Date(dStr);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  };

  // Extract initial phone without +91
  const extractPhone = (phoneStr?: string): string => {
    if (!phoneStr) return "";
    return phoneStr.replace(/\D/g, "").slice(-10);
  };

  const initialPreferences = initial?.donationPreferences || initial?.donation_preferences || {};

  // Form State
  const [name, setName] = React.useState(initial?.name || "");
  const [dob, setDob] = React.useState<Date | undefined>(
    parseInitialDate(initial?.dateOfBirth || initial?.date_of_birth)
  );
  const [gender, setGender] = React.useState<"Male" | "Female" | "Other" | "">(
    (initial?.gender as any) || ""
  );
  const [bloodGroup, setBloodGroup] = React.useState<string>(
    initial?.bloodGroup || (initial?.blood_group && initial?.blood_group !== "Unknown" && initial?.blood_group !== "Not recorded" ? initial?.blood_group : "") || ""
  );
  const [contactNumber, setContactNumber] = React.useState(
    extractPhone(initial?.contactNumber || initial?.contact_number)
  );
  const [residentialAddress, setResidentialAddress] = React.useState(
    initial?.residentialAddress || initial?.residential_address || ""
  );

  const [selectedOrgans, setSelectedOrgans] = React.useState<string[]>(
    Array.isArray(initialPreferences.organs) ? initialPreferences.organs : []
  );
  const [selectedTissues, setSelectedTissues] = React.useState<string[]>(
    Array.isArray(initialPreferences.tissues) ? initialPreferences.tissues : []
  );
  const [otherOrgans, setOtherOrgans] = React.useState(
    initialPreferences.other_organs || ""
  );
  const [otherTissues, setOtherTissues] = React.useState(
    initialPreferences.other_tissues || ""
  );

  const [declarationAcknowledged, setDeclarationAcknowledged] = React.useState(
    initial?.declarationAcknowledged ?? initial?.declaration_acknowledged ?? false
  );
  const [regDate, setRegDate] = React.useState<Date>(
    parseInitialDate(initial?.registrationDate || initial?.registration_date || initial?.createdAt || initial?.created_at) || new Date()
  );

  // Live Running Time Clock State
  const [currentTime, setCurrentTime] = React.useState<Date>(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format time for Asia/Kolkata / User Local Timezone
  const formattedTime = currentTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  // Date picker popover open states
  const [dobOpen, setDobOpen] = React.useState(false);
  const [regDateOpen, setRegDateOpen] = React.useState(false);

  // Field Touched / Validation tracking
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const markTouched = (field: string) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  // Validation Rules
  const isNameValid = name.trim().length >= 2;
  const isDobValid = !!dob && !isDateInFuture(dob);
  const isGenderValid = !!gender;
  const isBloodGroupValid = !!bloodGroup && BLOOD_GROUPS.includes(bloodGroup as any);
  
  // Clean phone string (digits only for Indian 10-digit mobile)
  const phoneDigits = contactNumber.replace(/\D/g, "");
  const isContactValid = phoneDigits.length === 10;
  
  const isAddressValid = residentialAddress.trim().length >= 3;

  // Step 1 Validity
  const isStep1Valid = isNameValid && isDobValid && isGenderValid && isBloodGroupValid && isContactValid && isAddressValid;


  // Step 2 Validity
  const hasPreferences = selectedOrgans.length > 0 || selectedTissues.length > 0;
  const isOtherOrgansValid =
    !selectedOrgans.includes("Other Organs") || otherOrgans.trim().length > 0;
  const isOtherTissuesValid =
    !selectedTissues.includes("Other Tissues") || otherTissues.trim().length > 0;
  const isStep2Valid = hasPreferences && isOtherOrgansValid && isOtherTissuesValid;

  // Step 3 Validity
  const isDeclarationValid = declarationAcknowledged === true;
  const isRegDateValid = !!regDate && !isDateInFuture(regDate);
  const isStep3Valid = isDeclarationValid && isRegDateValid;

  const isFormValid = isStep1Valid && isStep2Valid && isStep3Valid;

  // Toggle organ selection
  const toggleOrgan = (id: string) => {
    setSelectedOrgans((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Toggle tissue selection
  const toggleTissue = (id: string) => {
    setSelectedTissues((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    if (currentStep === 1) {
      markTouched("name");
      markTouched("dob");
      markTouched("gender");
      markTouched("bloodGroup");
      markTouched("contactNumber");
      markTouched("residentialAddress");
      if (isStep1Valid) {
        setStep(2);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else if (currentStep === 2) {
      markTouched("preferences");
      if (selectedOrgans.includes("Other Organs")) markTouched("otherOrgans");
      if (selectedTissues.includes("Other Tissues")) markTouched("otherTissues");
      if (isStep2Valid) {
        setStep(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    markTouched("name");
    markTouched("dob");
    markTouched("gender");
    markTouched("bloodGroup");
    markTouched("contactNumber");
    markTouched("residentialAddress");
    markTouched("preferences");
    markTouched("declaration");

    if (!isFormValid || submitting) return;

    // Standardize Indian phone number with +91 if not present
    const formattedPhone = contactNumber.startsWith("+")
      ? contactNumber.trim()
      : `+91 ${contactNumber.trim()}`;

    const values: DonorRegistrationFormValues = {
      name: name.trim(),
      dateOfBirth: dob ? toIsoDate(dob) : "",
      gender: gender as any,
      bloodGroup: bloodGroup,
      contactNumber: formattedPhone,
      residentialAddress: residentialAddress.trim(),
      donationPreferences: {
        organs: selectedOrgans,
        tissues: selectedTissues,
        other_organs: selectedOrgans.includes("Other Organs") ? otherOrgans.trim() : undefined,
        other_tissues: selectedTissues.includes("Other Tissues") ? otherTissues.trim() : undefined,
      },
      declarationAcknowledged,
      registrationDate: toIsoDate(regDate),
    };

    onSubmit(values);
  };

  const organCount = selectedOrgans.length;
  const tissueCount = selectedTissues.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto">
      {/* Global Server/Submission Error Banner (Preserves entered form state) */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-sm animate-in fade-in-50 duration-200">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-rose-950">Registration could not be completed</h4>
            <p className="text-xs text-rose-700 leading-relaxed font-medium">{errorMessage}</p>
            <p className="text-[11px] text-rose-600 font-semibold pt-1">
              Your form data has been preserved. Please correct any highlighted fields or try again.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FORM CARD CONTAINER */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* ========================================================================= */}
        {/* 1. PERSONAL DETAILS SECTION (Step 1) */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <section className="p-6 sm:p-8 space-y-6 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold tracking-wider text-blue-600 uppercase">
                1. PERSONAL DETAILS
              </h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                Step 1 of 3
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="donor-name" className="text-xs font-bold text-slate-800">
                  Full Name <span className="text-rose-500">*</span>
                </Label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <UserRound className="w-4.5 h-4.5" />
                  </div>
                  <Input
                    id="donor-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => markTouched("name")}
                    placeholder="Enter donor full name"
                    className={cn(
                      "h-12 pl-11 bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-100 transition-all rounded-xl text-sm font-medium",
                      touched.name && !isNameValid && "border-rose-400 focus:ring-rose-100"
                    )}
                    required
                  />
                </div>
                {touched.name && !isNameValid && (
                  <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" /> Full Name is required (minimum 2 characters).
                  </p>
                )}
              </div>

              {/* Date of Birth */}
              <div className="space-y-2">
                <Label htmlFor="donor-dob" className="text-xs font-bold text-slate-800">
                  Date of Birth <span className="text-rose-500">*</span>
                </Label>
                <Popover open={dobOpen} onOpenChange={setDobOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="donor-dob"
                      type="button"
                      variant="outline"
                      onBlur={() => markTouched("dob")}
                      className={cn(
                        "w-full h-12 justify-between text-left font-medium bg-white border-slate-200 hover:bg-slate-50/80 rounded-xl transition-all text-sm",
                        !dob ? "text-slate-400" : "text-slate-800",
                        touched.dob && !isDobValid && "border-rose-400 text-rose-600"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <CalendarIcon className="h-4.5 w-4.5 text-slate-400 shrink-0" />
                        <span>{dob ? formatDisplayDate(dob) : "15 Aug 1990"}</span>
                      </div>
                      <CalendarIcon className="h-4.5 w-4.5 text-slate-400 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white border border-slate-200 shadow-2xl rounded-2xl" align="start">
                    <Calendar
                      mode="single"
                      selected={dob}
                      onSelect={(date) => {
                        setDob(date);
                        setDobOpen(false);
                        markTouched("dob");
                      }}
                      disabled={(date) => isDateInFuture(date) || date < new Date("1900-01-01")}
                      captionLayout="dropdown"
                      startMonth={new Date(1920, 0)}
                      endMonth={new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {touched.dob && !isDobValid && (
                  <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" /> Valid date of birth in the past is required.
                  </p>
                )}
              </div>

              {/* Gender Selection Cards */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-800">
                  Gender <span className="text-rose-500">*</span>
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {/* Male Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setGender("Male");
                      markTouched("gender");
                    }}
                    className={cn(
                      "relative h-24 rounded-2xl border p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer select-none group",
                      gender === "Male"
                        ? "border-blue-600 bg-blue-50/70 text-blue-700 ring-2 ring-blue-500/20 shadow-xs scale-[1.02]"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 text-slate-700 hover:scale-[1.01]"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-2.5 right-2.5 w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors",
                        gender === "Male" ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"
                      )}
                    >
                      {gender === "Male" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <MaleSymbol className={cn("w-6 h-6 transition-transform group-hover:scale-110", gender === "Male" ? "text-blue-600" : "text-blue-500")} />
                    <span className={cn("text-xs font-bold", gender === "Male" ? "text-blue-900" : "text-slate-800")}>
                      Male
                    </span>
                  </button>

                  {/* Female Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setGender("Female");
                      markTouched("gender");
                    }}
                    className={cn(
                      "relative h-24 rounded-2xl border p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer select-none group",
                      gender === "Female"
                        ? "border-pink-500 bg-pink-50/70 text-pink-700 ring-2 ring-pink-500/20 shadow-xs scale-[1.02]"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 text-slate-700 hover:scale-[1.01]"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-2.5 right-2.5 w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors",
                        gender === "Female" ? "border-pink-600 bg-pink-600" : "border-slate-300 bg-white"
                      )}
                    >
                      {gender === "Female" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <FemaleSymbol className={cn("w-6 h-6 transition-transform group-hover:scale-110", gender === "Female" ? "text-pink-600" : "text-pink-500")} />
                    <span className={cn("text-xs font-bold", gender === "Female" ? "text-pink-900" : "text-slate-800")}>
                      Female
                    </span>
                  </button>

                  {/* Other Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setGender("Other");
                      markTouched("gender");
                    }}
                    className={cn(
                      "relative h-24 rounded-2xl border p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer select-none group",
                      gender === "Other"
                        ? "border-purple-600 bg-purple-50/70 text-purple-700 ring-2 ring-purple-500/20 shadow-xs scale-[1.02]"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 text-slate-700 hover:scale-[1.01]"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-2.5 right-2.5 w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors",
                        gender === "Other" ? "border-purple-600 bg-purple-600" : "border-slate-300 bg-white"
                      )}
                    >
                      {gender === "Other" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <OtherGenderSymbol className={cn("w-6 h-6 transition-transform group-hover:scale-110", gender === "Other" ? "text-purple-600" : "text-purple-500")} />
                    <span className={cn("text-xs font-bold", gender === "Other" ? "text-purple-900" : "text-slate-800")}>
                      Other
                    </span>
                  </button>
                </div>
                {touched.gender && !isGenderValid && (
                  <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" /> Please select a gender.
                  </p>
                )}
              </div>

              {/* Blood Group Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="donor-blood-group" className="text-xs font-bold text-slate-800">
                  Blood Group <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={bloodGroup}
                  onValueChange={(val) => {
                    setBloodGroup(val);
                    markTouched("bloodGroup");
                  }}
                >
                  <SelectTrigger
                    id="donor-blood-group"
                    onBlur={() => markTouched("bloodGroup")}
                    className={cn(
                      "h-12 bg-white border-slate-200 text-slate-800 focus:border-blue-600 focus:ring-blue-100 transition-all rounded-xl text-sm font-medium",
                      !bloodGroup && "text-slate-400",
                      touched.bloodGroup && !isBloodGroupValid && "border-rose-400 focus:ring-rose-100 text-rose-600"
                    )}
                  >
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 rounded-xl shadow-xl">
                    {BLOOD_GROUPS.map((bg) => (
                      <SelectItem key={bg} value={bg} className="text-sm font-medium focus:bg-blue-50 focus:text-blue-700 cursor-pointer">
                        {bg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {touched.bloodGroup && !isBloodGroupValid && (
                  <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" /> Please select a blood group.
                  </p>
                )}
              </div>

              {/* Contact Number with Indian +91 Flag Selector */}
              <div className="space-y-2">
                <Label htmlFor="donor-contact" className="text-xs font-bold text-slate-800">
                  Contact Number <span className="text-rose-500">*</span>
                </Label>
                <div className="relative flex items-center">
                  {/* Indian Flag +91 Prefix Box */}
                  <div className="h-12 px-3.5 bg-slate-50 border border-r-0 border-slate-200 rounded-l-xl flex items-center gap-2 text-slate-700 text-sm font-semibold select-none shrink-0">
                    <span className="text-base leading-none">🇮🇳</span>
                    <span>+91</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <Input
                    id="donor-contact"
                    type="tel"
                    maxLength={10}
                    value={contactNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setContactNumber(val);
                    }}
                    onBlur={() => markTouched("contactNumber")}
                    placeholder="98765 43210"
                    className={cn(
                      "h-12 bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-100 transition-all rounded-r-xl rounded-l-none text-sm font-medium",
                      touched.contactNumber && !isContactValid && "border-rose-400 focus:ring-rose-100"
                    )}
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Enter a valid 10-digit mobile number
                </p>
                {touched.contactNumber && !isContactValid && (
                  <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="h-3 w-3" /> Please enter a valid 10-digit Indian mobile number.
                  </p>
                )}
              </div>

              {/* Residential Address */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="donor-address" className="text-xs font-bold text-slate-800">
                  Residential Address <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Textarea
                    id="donor-address"
                    rows={2}
                    value={residentialAddress}
                    onChange={(e) => setResidentialAddress(e.target.value)}
                    onBlur={() => markTouched("residentialAddress")}
                    placeholder="45, Green Park Colony, Lajpat Nagar 2, New Delhi, Delhi - 110024, India"
                    className={cn(
                      "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:ring-blue-100 resize-none transition-all rounded-xl p-3.5 pr-10 text-sm font-medium",
                      touched.residentialAddress && !isAddressValid && "border-rose-400 focus:ring-rose-100"
                    )}
                    required
                  />
                  <div className="absolute top-3.5 right-3.5 text-slate-400 pointer-events-none">
                    <MapPin className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Please provide your complete residential address
                </p>
                {touched.residentialAddress && !isAddressValid && (
                  <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="h-3 w-3" /> Residential address is required.
                  </p>
                )}
              </div>
            </div>

            {/* Step 1 Next Action Button */}
            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              {onCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="h-11 px-5 text-xs font-semibold text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </Button>
              ) : <div />}

              <Button
                type="button"
                onClick={handleNext}
                disabled={!isStep1Valid}
                className={cn(
                  "group h-11 px-7 text-xs font-bold rounded-xl transition-all duration-200 flex items-center gap-2 shadow-sm",
                  isStep1Valid
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 hover:shadow-md hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                )}
              >
                <span>Next: Donation Preferences</span>
                <span className="text-base transition-transform duration-200 group-hover:translate-x-1">→</span>
              </Button>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* 2. DONATION PREFERENCES SECTION (Step 2) */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <section className="p-6 sm:p-8 space-y-6 animate-in fade-in-50 duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold tracking-wider text-blue-600 uppercase">
                  2. DONATION PREFERENCES
                </h2>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                  Step 2 of 3
                </span>
              </div>

              {/* Selection Counter Badge */}
              <div
                className={cn(
                  "px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all shrink-0 self-start sm:self-auto",
                  hasPreferences
                    ? "bg-blue-50 text-blue-700 border-blue-200 shadow-xs"
                    : "bg-slate-50 text-slate-500 border-slate-200"
                )}
              >
                <Check className={cn("h-3.5 w-3.5 stroke-[2.5]", hasPreferences ? "text-blue-600" : "text-slate-400")} />
                <span>
                  Selected: <strong className="text-blue-950 font-bold">{organCount}</strong> organs · <strong className="text-blue-950 font-bold">{tissueCount}</strong> tissues
                </span>
              </div>
            </div>

            {/* Subsection: Organs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-blue-600" />
                  Organs <span className="text-[11px] font-normal text-slate-400">(You can select one or more)</span>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {ORGAN_OPTIONS.map((opt) => {
                  const isSelected = selectedOrgans.includes(opt.id);
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleOrgan(opt.id)}
                      className={cn(
                        "relative p-3.5 rounded-xl border flex flex-col items-start gap-2.5 transition-all duration-200 text-left select-none group cursor-pointer",
                        isSelected
                          ? "border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20 scale-[1.02]"
                          : "border-slate-200 bg-white hover:bg-slate-50/80 hover:border-slate-300 hover:scale-[1.01]"
                      )}
                    >
                      <div className="w-full flex items-center justify-between">
                        <div
                          className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200",
                            isSelected
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-slate-50 border border-slate-200 text-slate-600 group-hover:text-blue-600 group-hover:border-blue-200"
                          )}
                        >
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div
                          className={cn(
                            "w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200",
                            isSelected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-300 bg-white group-hover:border-slate-400"
                          )}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                        </div>
                      </div>
                      <div>
                        <p className={cn("text-xs font-bold tracking-tight", isSelected ? "text-blue-950" : "text-slate-800")}>
                          {opt.label}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                          {opt.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Conditional Other Organs input */}
              {selectedOrgans.includes("Other Organs") && (
                <div className="pt-2 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                  <Label htmlFor="other-organs" className="text-xs font-semibold text-blue-900 flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    Specify Other Organs <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="other-organs"
                    value={otherOrgans}
                    onChange={(e) => setOtherOrgans(e.target.value)}
                    onBlur={() => markTouched("otherOrgans")}
                    placeholder="e.g. Lungs, Small Intestine"
                    className={cn(
                      "h-11 bg-white border-blue-200 focus:border-blue-500 focus:ring-blue-200 transition-all rounded-xl text-sm",
                      touched.otherOrgans && !isOtherOrgansValid && "border-rose-400 focus:ring-rose-200"
                    )}
                    required
                  />
                  {touched.otherOrgans && !isOtherOrgansValid && (
                    <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" /> Please specify which other organs the donor wishes to donate.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Subsection: Tissues */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-blue-600" />
                  Tissues <span className="text-[11px] font-normal text-slate-400">(You can select one or more)</span>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {TISSUE_OPTIONS.map((opt) => {
                  const isSelected = selectedTissues.includes(opt.id);
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleTissue(opt.id)}
                      className={cn(
                        "relative p-3.5 rounded-xl border flex flex-col items-start gap-2.5 transition-all duration-200 text-left select-none group cursor-pointer",
                        isSelected
                          ? "border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20 scale-[1.02]"
                          : "border-slate-200 bg-white hover:bg-slate-50/80 hover:border-slate-300 hover:scale-[1.01]"
                      )}
                    >
                      <div className="w-full flex items-center justify-between">
                        <div
                          className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200",
                            isSelected
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-slate-50 border border-slate-200 text-slate-600 group-hover:text-blue-600 group-hover:border-blue-200"
                          )}
                        >
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div
                          className={cn(
                            "w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200",
                            isSelected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-300 bg-white group-hover:border-slate-400"
                          )}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                        </div>
                      </div>
                      <div>
                        <p className={cn("text-xs font-bold tracking-tight", isSelected ? "text-blue-950" : "text-slate-800")}>
                          {opt.label}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                          {opt.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Conditional Other Tissues input */}
              {selectedTissues.includes("Other Tissues") && (
                <div className="pt-2 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                  <Label htmlFor="other-tissues" className="text-xs font-semibold text-blue-900 flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    Specify Other Tissues <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="other-tissues"
                    value={otherTissues}
                    onChange={(e) => setOtherTissues(e.target.value)}
                    onBlur={() => markTouched("otherTissues")}
                    placeholder="e.g. Tendons, Cartilage, Blood Vessels"
                    className={cn(
                      "h-11 bg-white border-blue-200 focus:border-blue-500 focus:ring-blue-200 transition-all rounded-xl text-sm",
                      touched.otherTissues && !isOtherTissuesValid && "border-rose-400 focus:ring-rose-200"
                    )}
                    required
                  />
                  {touched.otherTissues && !isOtherTissuesValid && (
                    <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" /> Please specify which other tissues the donor wishes to donate.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Step 2 Back & Next Actions */}
            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="group h-11 px-5 text-xs font-semibold text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="text-base transition-transform duration-200 group-hover:-translate-x-1">←</span>
                <span>Back: Personal Details</span>
              </Button>

              <Button
                type="button"
                onClick={handleNext}
                disabled={!isStep2Valid}
                className={cn(
                  "group h-11 px-7 text-xs font-bold rounded-xl transition-all duration-200 flex items-center gap-2 shadow-sm",
                  isStep2Valid
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 hover:shadow-md hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                )}
              >
                <span>Next: Declaration & Date</span>
                <span className="text-base transition-transform duration-200 group-hover:translate-x-1">→</span>
              </Button>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* 3. DECLARATION & ACKNOWLEDGMENT SECTION (Step 3) */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <section className="p-6 sm:p-8 space-y-6 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold tracking-wider text-blue-600 uppercase">
                3. DECLARATION & ACKNOWLEDGMENT
              </h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                Step 3 of 3
              </span>
            </div>

            {/* Declaration Statement Box */}
            <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 text-xs text-slate-700 leading-relaxed space-y-2.5">
              <p className="font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-blue-600" />
                Statutory Donor Consent & Clinical Registry Acknowledgment
              </p>
              <p>
                I, the undersigned donor (or authorized healthcare coordinator acting on verified donor
                instructions), voluntarily register as an organ and tissue donor. I understand that this is
                an expression of willingness for post-mortem donation to save and enhance human lives.
              </p>
              <p>
                I confirm that the personal details and donation preferences recorded herein are truthful,
                accurate, and given freely in accordance with applicable transplantation laws and
                regulatory guidelines.
              </p>
            </div>

            {/* Declaration Checkbox Card */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setDeclarationAcknowledged((prev) => !prev)}
                className={cn(
                  "w-full text-left p-4 rounded-2xl border flex items-start gap-3.5 transition-all duration-300 focus:outline-none focus:ring-2 cursor-pointer select-none",
                  declarationAcknowledged
                    ? "border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-400/20 shadow-xs scale-[1.01]"
                    : "border-slate-200 bg-white hover:bg-slate-50/70 text-slate-800 hover:border-slate-300"
                )}
              >
                <div
                  className={cn(
                    "w-5.5 h-5.5 mt-0.5 rounded-lg border flex items-center justify-center shrink-0 transition-all duration-300",
                    declarationAcknowledged
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-xs scale-110"
                      : "border-slate-300 bg-white hover:border-slate-400"
                  )}
                >
                  {declarationAcknowledged && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold block leading-tight">
                    I have read and understood the declaration above and acknowledge it. <span className="text-rose-500">*</span>
                  </span>
                  {declarationAcknowledged && (
                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5 mt-1.5 animate-in fade-in-50">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Declaration acknowledged
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* Registration Date + Live Running Clock (Asia/Kolkata IST) */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              {/* Date Picker */}
              <div className="space-y-1.5">
                <Label htmlFor="donor-reg-date" className="text-xs font-bold text-slate-800">
                  Registration Date <span className="text-rose-500">*</span>
                </Label>
                <Popover open={regDateOpen} onOpenChange={setRegDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="donor-reg-date"
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full h-11 justify-between text-left font-medium bg-white border-slate-200 hover:bg-slate-50/80 rounded-xl transition-all text-sm",
                        !regDate && "text-slate-400"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <CalendarIcon className="h-4 w-4 text-blue-600 shrink-0" />
                        <span>{regDate ? formatDisplayDate(regDate) : "Select date"}</span>
                      </div>
                      <CalendarIcon className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white border border-slate-200 shadow-xl rounded-xl" align="start">
                    <Calendar
                      mode="single"
                      selected={regDate}
                      onSelect={(date) => {
                        if (date) setRegDate(date);
                        setRegDateOpen(false);
                      }}
                      disabled={(date) => isDateInFuture(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-[11px] text-slate-400">Defaults to authoritative registry date.</p>
              </div>

              {/* Live Running Time Clock with Pulse Indicator */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800">
                    Current Registry Time
                  </Label>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-[10px] font-bold text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Live
                  </span>
                </div>
                <div className="h-11 px-3.5 bg-slate-50/90 border border-slate-200 rounded-xl flex items-center justify-between text-slate-800 text-sm font-mono font-medium shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{formattedTime}</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                    IST
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Timezone: Asia/Kolkata (IST)</p>
              </div>
            </div>

            {/* Step 3 Back & Submit Actions */}
            <div className="pt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="w-full sm:w-auto group h-11 px-5 text-xs font-semibold text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-100 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="text-base transition-transform duration-200 group-hover:-translate-x-1">←</span>
                  <span>Back: Preferences</span>
                </Button>
                {onCancel && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancel}
                    className="w-full sm:w-auto h-11 px-4 text-xs font-semibold text-slate-500 hover:text-slate-700 rounded-xl transition-all"
                  >
                    Cancel
                  </Button>
                )}
              </div>

              <Button
                type="submit"
                disabled={!isFormValid || submitting}
                className={cn(
                  "w-full sm:w-auto h-11 px-8 text-xs font-bold text-white shadow-md transition-all duration-200 rounded-xl flex items-center justify-center gap-2",
                  isFormValid && !submitting
                    ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    : "bg-slate-300 text-slate-500 shadow-none cursor-not-allowed"
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{mode === "edit" ? "Saving..." : "Registering..."}</span>
                  </>
                ) : (
                  <>
                    <span>{submitLabel || (mode === "edit" ? "Save Changes" : "Submit Registration")}</span>
                    <Check className="h-4 w-4 stroke-[2.5]" />
                  </>
                )}
              </Button>
            </div>
          </section>
        )}
      </div>
    </form>
  );
}

