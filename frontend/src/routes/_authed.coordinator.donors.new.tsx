import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { DonorRegistrationForm, type DonorRegistrationFormValues } from "@/components/donor-registration-form";
import { HeartHandshake } from "lucide-react";

export const Route = createFileRoute("/_authed/coordinator/donors/new")({
  head: () => ({
    meta: [
      { title: "Organ Donor Registration — OrganMatch National Organ Registry" },
      { name: "description", content: "Official organ donor registration workflow under National Organ Registry guidelines." },
    ],
  }),
  component: CoordinatorNewDonorPage,
});

function CoordinatorNewDonorPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = React.useState<number>(1);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (values: DonorRegistrationFormValues) => {
      setErrorMessage(null);
      return api.createDonor(values);
    },
    onSuccess: (created) => {
      // Invalidate relevant queries across the application
      qc.invalidateQueries({ queryKey: ["donors"] });
      qc.invalidateQueries({ queryKey: ["coordinator", "overview"] });
      qc.invalidateQueries({ queryKey: ["organs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });

      toast.success("Donor registered successfully.", {
        description: "Donor record has been securely saved to the registry.",
      });

      navigate({ to: "/coordinator/donors/$donorId", params: { donorId: created.id } });
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      let msg = "Failed to register donor.";
      if (status >= 500) {
        msg = "Registration service is temporarily unavailable. Please try again.";
      } else if (detail) {
        msg = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ") : JSON.stringify(detail);
      } else if (err?.message) {
        msg = err.message;
      }
      
      setErrorMessage(msg);
      toast.error(msg);
    },
  });

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8 animate-in fade-in-50 duration-300">
      {/* ========================================================================= */}
      {/* HEADER SECTION (Matching Reference Design with Dynamic Step Tracking) */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 pb-2">
        <div>
          {/* Logo & Sub-brand */}
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-black tracking-tight text-slate-900 leading-tight">
                Organ<span className="text-blue-600">Match</span>
              </div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                National Organ Registry
              </p>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Organ Donor Registration
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Together, we can save more lives.
          </p>
        </div>

        {/* 3-Step Dynamic Progress Indicator (Reference Design) */}
        <div className="flex items-center gap-3 pt-2">
          {/* Step 1 */}
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center transition-all duration-300 ${
                currentStep === 1
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-4 ring-blue-100"
                  : currentStep > 1
                  ? "bg-emerald-500 text-white shadow-xs"
                  : "bg-slate-100 border border-slate-300 text-slate-600"
              }`}
            >
              {currentStep > 1 ? "✓" : "1"}
            </div>
            <span
              className={`text-[11px] mt-1.5 whitespace-nowrap transition-colors ${
                currentStep === 1 ? "font-bold text-blue-600" : currentStep > 1 ? "font-semibold text-slate-800" : "font-semibold text-slate-400"
              }`}
            >
              Personal Details
            </span>
          </div>

          {/* Connector 1-2 */}
          <div
            className={`w-8 sm:w-12 h-0.5 -mt-4 transition-colors duration-300 ${
              currentStep > 1 ? "bg-emerald-400" : "bg-slate-200"
            }`}
          />

          {/* Step 2 */}
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center transition-all duration-300 ${
                currentStep === 2
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-4 ring-blue-100"
                  : currentStep > 2
                  ? "bg-emerald-500 text-white shadow-xs"
                  : "bg-slate-100 border border-slate-300 text-slate-600"
              }`}
            >
              {currentStep > 2 ? "✓" : "2"}
            </div>
            <span
              className={`text-[11px] mt-1.5 whitespace-nowrap transition-colors ${
                currentStep === 2 ? "font-bold text-blue-600" : currentStep > 2 ? "font-semibold text-slate-800" : "font-semibold text-slate-400"
              }`}
            >
              Preferences
            </span>
          </div>

          {/* Connector 2-3 */}
          <div
            className={`w-8 sm:w-12 h-0.5 -mt-4 transition-colors duration-300 ${
              currentStep > 2 ? "bg-emerald-400" : "bg-slate-200"
            }`}
          />

          {/* Step 3 */}
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center transition-all duration-300 ${
                currentStep === 3
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-4 ring-blue-100"
                  : "bg-slate-100 border border-slate-300 text-slate-600"
              }`}
            >
              3
            </div>
            <span
              className={`text-[11px] mt-1.5 whitespace-nowrap transition-colors ${
                currentStep === 3 ? "font-bold text-blue-600" : "font-semibold text-slate-400"
              }`}
            >
              Declaration
            </span>
          </div>
        </div>
      </div>

      {/* Main Registration Form with step sync & error state */}
      <DonorRegistrationForm
        submitting={createMutation.isPending}
        currentStep={currentStep}
        onStepChange={(s) => {
          setCurrentStep(s);
          setErrorMessage(null);
        }}
        errorMessage={errorMessage}
        onSubmit={(v) => createMutation.mutate(v)}
        onCancel={() => navigate({ to: "/coordinator/donors" })}
      />
    </div>
  );
}





