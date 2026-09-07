import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/lib/auth-context";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Donor, Recipient } from "@/services/types";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
const ORGAN_TYPES = ["Heart", "Lungs", "Kidney", "Pancreas"] as const;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-slate-500 mt-1">{hint}</p> : null}
    </div>
  );
}

function useHospitals() {
  const { user, ready } = useAuth();
  return useQuery({
    queryKey: ["hospitals", "all"],
    queryFn: () => (api.hospitals ? api.hospitals({ pageSize: 100 }) : api.listHospitals?.({ pageSize: 100 })),
    enabled: ready && !!user,
  });
}

export interface DonorFormValues {
  name: string;
  age: number;
  gender: Donor["gender"];
  bloodGroup: Donor["bloodGroup"];
  organType: Donor["organType"];
  availability: Donor["availability"];
  medicalStatus: Donor["medicalStatus"];
  medicalDetails: string;
  hla: string;
  hospitalId: string;
  hospital: string;
}

export function DonorForm({
  initial,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Donor>;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: DonorFormValues) => void;
  onCancel?: () => void;
}) {
  const { user } = useAuth();
  const { data: hospitals } = useHospitals();

  const isCoordinator = user?.role === "HOSPITAL_COORDINATOR" || !!user?.hospital_id;
  const assignedHospitalId = user?.hospital_id || initial?.hospitalId || "";
  const assignedHospitalName = user?.organization || user?.hospital_name || initial?.hospital || "Assigned Hospital";

  const [v, setV] = React.useState<DonorFormValues>({
    name: initial?.name ?? "",
    age: initial?.age ?? 35,
    gender: initial?.gender ?? "Male",
    bloodGroup: initial?.bloodGroup ?? "O+",
    organType: initial?.organType ?? "Kidney",
    availability: initial?.availability ?? "Available",
    medicalStatus: initial?.medicalStatus ?? "Suitable",
    medicalDetails: initial?.medicalDetails ?? "",
    hla: initial?.hla ?? "",
    hospitalId: initial?.hospitalId ?? user?.hospital_id ?? "",
    hospital: initial?.hospital ?? user?.organization ?? user?.hospital_name ?? "",
  });
  const set = <K extends keyof DonorFormValues>(k: K, val: DonorFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  return (
    <form
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const effectiveHospitalId = isCoordinator ? assignedHospitalId : (v.hospitalId || assignedHospitalId);
        const hospitalList = Array.isArray(hospitals?.items) ? hospitals.items : (Array.isArray(hospitals) ? hospitals : []);
        const h = hospitalList.find((x: any) => x.id === effectiveHospitalId);
        const effectiveHospitalName = isCoordinator ? assignedHospitalName : (h?.name ?? v.hospital ?? assignedHospitalName);
        onSubmit({
          ...v,
          hospitalId: effectiveHospitalId,
          hospital: effectiveHospitalName,
        });
      }}
    >
      <div className="sm:col-span-2">
        <Field label="Full Name">
          <Input
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Donor's full name"
          />
        </Field>
      </div>
      <Field label="Age">
        <Input
          type="number"
          min={0}
          max={120}
          value={v.age}
          onChange={(e) => set("age", Number(e.target.value))}
          required
        />
      </Field>
      <Field label="Gender">
        <Select
          value={v.gender}
          onValueChange={(x) => set("gender", x as DonorFormValues["gender"])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["Male", "Female", "Other"].map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Blood group">
        <Select
          value={v.bloodGroup}
          onValueChange={(x) => set("bloodGroup", x as DonorFormValues["bloodGroup"])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLOOD_GROUPS.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Organ type">
        <Select
          value={v.organType}
          onValueChange={(x) => set("organType", x as DonorFormValues["organType"])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORGAN_TYPES.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Availability">
        <Select
          value={v.availability}
          onValueChange={(x) => set("availability", x as DonorFormValues["availability"])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["Available", "Unavailable"].map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Medical status">
        <Select
          value={v.medicalStatus}
          onValueChange={(x) => set("medicalStatus", x as DonorFormValues["medicalStatus"])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["Suitable", "Under Review", "Not Suitable"].map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="HLA profile">
        <Input
          value={v.hla}
          onChange={(e) => set("hla", e.target.value)}
          placeholder="e.g. A2,A24;B7,B44;DR4,DR7"
          required
        />
      </Field>
      {isCoordinator ? (
        <Field
          label="Hospital"
          hint="Donors registered by you will automatically belong to your assigned hospital."
        >
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-800 text-sm font-medium h-9">
            <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
            <span>{assignedHospitalName}</span>
            <Badge variant="outline" className="ml-auto text-[10px] font-semibold bg-blue-50 text-blue-700 border-blue-200 shrink-0">
              Assigned
            </Badge>
          </div>
        </Field>
      ) : (
        <Field label="Hospital">
          <Select value={v.hospitalId} onValueChange={(x) => set("hospitalId", x)}>
            <SelectTrigger>
              <SelectValue placeholder="Select hospital" />
            </SelectTrigger>
            <SelectContent>
              {(hospitals?.items ?? []).map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      <div className="sm:col-span-2">
        <Field label="Medical details">
          <Textarea
            value={v.medicalDetails}
            onChange={(e) => set("medicalDetails", e.target.value)}
            rows={3}
            placeholder="Relevant clinical notes…"
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export interface RecipientFormValues {
  name: string;
  age: number;
  gender: Recipient["gender"];
  bloodGroup: Recipient["bloodGroup"];
  requiredOrgan: Recipient["requiredOrgan"];
  medicalCondition: string;
  medicalSuitability: Recipient["medicalSuitability"];
  hla: string;
  priority: Recipient["priority"];
  urgency: Recipient["urgency"];
  hospitalId: string;
  hospital: string;
}

export function RecipientForm({
  initial,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Recipient>;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: RecipientFormValues) => void;
  onCancel?: () => void;
}) {
  const { user } = useAuth();
  const { data: hospitals } = useHospitals();

  const isCoordinator = user?.role === "HOSPITAL_COORDINATOR" || !!user?.hospital_id;
  const assignedHospitalId = user?.hospital_id || initial?.hospitalId || "";
  const assignedHospitalName = user?.organization || user?.hospital_name || initial?.hospital || "Assigned Hospital";

  const [v, setV] = React.useState<RecipientFormValues>({
    name: initial?.name ?? "",
    age: initial?.age ?? 40,
    gender: initial?.gender ?? "Female",
    bloodGroup: initial?.bloodGroup ?? "A+",
    requiredOrgan: initial?.requiredOrgan ?? "Kidney",
    medicalCondition: initial?.medicalCondition ?? "",
    medicalSuitability: initial?.medicalSuitability ?? "High",
    hla: initial?.hla ?? "",
    priority: initial?.priority ?? "Medium",
    urgency: initial?.urgency ?? "Moderate",
    hospitalId: initial?.hospitalId ?? user?.hospital_id ?? "",
    hospital: initial?.hospital ?? user?.organization ?? user?.hospital_name ?? "",
  });
  const set = <K extends keyof RecipientFormValues>(k: K, val: RecipientFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  return (
    <form
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const effectiveHospitalId = isCoordinator ? assignedHospitalId : (v.hospitalId || assignedHospitalId);
        const h = hospitals?.items.find((x) => x.id === effectiveHospitalId);
        const effectiveHospitalName = isCoordinator ? assignedHospitalName : (h?.name ?? v.hospital ?? assignedHospitalName);
        onSubmit({
          ...v,
          hospitalId: effectiveHospitalId,
          hospital: effectiveHospitalName,
        });
      }}
    >
      <div className="sm:col-span-2">
        <Field label="Full Name">
          <Input
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Recipient's full name"
          />
        </Field>
      </div>
      <Field label="Age">
        <Input
          type="number"
          min={0}
          max={120}
          value={v.age}
          onChange={(e) => set("age", Number(e.target.value))}
          required
        />
      </Field>
      <Field label="Gender">
        <Select
          value={v.gender}
          onValueChange={(x) => set("gender", x as RecipientFormValues["gender"])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["Male", "Female", "Other"].map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Blood group">
        <Select
          value={v.bloodGroup}
          onValueChange={(x) => set("bloodGroup", x as RecipientFormValues["bloodGroup"])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLOOD_GROUPS.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Required organ">
        <Select
          value={v.requiredOrgan}
          onValueChange={(x) => set("requiredOrgan", x as RecipientFormValues["requiredOrgan"])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORGAN_TYPES.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Priority">
        <Select
          value={v.priority}
          onValueChange={(x) => set("priority", x as RecipientFormValues["priority"])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["High", "Medium", "Low"].map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Urgency">
        <Select
          value={v.urgency}
          onValueChange={(x) => set("urgency", x as RecipientFormValues["urgency"])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["Critical", "High", "Moderate", "Stable"].map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Medical suitability">
        <Select
          value={v.medicalSuitability}
          onValueChange={(x) =>
            set("medicalSuitability", x as RecipientFormValues["medicalSuitability"])
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["High", "Moderate", "Low"].map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="HLA profile">
        <Input
          value={v.hla}
          onChange={(e) => set("hla", e.target.value)}
          placeholder="e.g. A2,A24;B7,B44;DR4,DR7"
          required
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Medical condition">
          <Textarea
            value={v.medicalCondition}
            onChange={(e) => set("medicalCondition", e.target.value)}
            rows={3}
            placeholder="Diagnosis and clinical context…"
            required
          />
        </Field>
      </div>
      {isCoordinator ? (
        <Field
          label="Hospital"
          hint="Recipients registered by you will automatically belong to your assigned hospital."
        >
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-800 text-sm font-medium h-9">
            <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
            <span>{assignedHospitalName}</span>
            <Badge variant="outline" className="ml-auto text-[10px] font-semibold bg-blue-50 text-blue-700 border-blue-200 shrink-0">
              Assigned
            </Badge>
          </div>
        </Field>
      ) : (
        <Field label="Hospital">
          <Select value={v.hospitalId} onValueChange={(x) => set("hospitalId", x)}>
            <SelectTrigger>
              <SelectValue placeholder="Select hospital" />
            </SelectTrigger>
            <SelectContent>
              {(hospitals?.items ?? []).map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      <div className="flex justify-end gap-2 sm:col-span-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
