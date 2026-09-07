import { http, ApiError } from "./http";
import type {
  Allocation,
  AdminHospitalDetail,
  AdminOverview,
  AdminRoleWithPermissions,
  AdminSystemSettings,
  AdminUserDetail,
  ApiActivityResponse,
  AuthMonitoringResponse,
  BackendMonitoringResponse,
  BlockchainMonitoringResponse,
  BlockchainTransaction,
  CoordinatorOverview,
  DashboardSummary,
  DatabaseTablesResponse,
  DoctorOverview,
  DoctorDonorDetail,
  DoctorOrganDetail,
  DoctorRecipientDetail,
  DoctorMatchProposal,
  DoctorHistoryItem,
  DockerMonitoringResponse,
  Donor,
  ErrorLogsResponse,
  HistoryEntry,
  Hospital,
  MatchResult,
  MedicalAssessment,
  Organ,
  PostgresqlMonitoringResponse,
  ResetPasswordResult,
  SystemHealthResponse,
  User,
} from "./types";

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ListParams = Record<string, string | number | undefined>;

function qs(params: ListParams): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function toPaged<T>(data: any): Paged<T> {
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page: 1,
      pageSize: Math.max(data.length, 10),
    };
  }
  if (data && Array.isArray(data.items)) {
    return {
      items: data.items,
      total: data.total ?? data.items.length,
      page: data.page ?? 1,
      pageSize: data.pageSize ?? 10,
    };
  }
  return { items: [], total: 0, page: 1, pageSize: 10 };
}

function normalizeSecurityEvent(e: any): SecurityEvent {
  if (!e) return e;
  return {
    id: String(e.id || e.event_code || ""),
    type: (e.type || e.tampering_type || e.event_code || "SECURITY_ALERT") as any,
    actor: e.actor || (e.user_id ? String(e.user_id) : "System"),
    role: e.role || "SYSTEM",
    organization: e.organization || e.source || "ORGANMATCH",
    operation: e.operation || "ACCESS",
    record: e.record || (e.record_id ? String(e.record_id) : "N/A"),
    source: e.source || "INTERNAL",
    status: e.status || "UNRESOLVED",
    reason: e.reason || "Security event detected",
    timestamp: e.timestamp || e.created_at || new Date().toISOString(),
    ip: e.ip || "127.0.0.1",
    sessionId: e.sessionId || "sess_001",
    txId: e.txId || e.fabric_tx_id || "N/A",
  };
}

export function normalizeBlockchainTx(raw: any): BlockchainTransaction {
  if (!raw) return raw;

  // Application-layer IDs — from PostgreSQL (always present)
  const rowId = raw.id || "";
  const fabricTxId = raw.fabric_tx_id || raw.fabricTxId || null;
  const recordId = raw.record_id || raw.recordId || "";
  const recordType = raw.record_type || raw.recordType || "Allocation";
  const operation = raw.operation || "ApproveAllocation";
  const createdAt = raw.created_at || raw.createdAt || new Date().toISOString();
  const confirmedAt = raw.confirmed_at || raw.confirmedAt || null;

  // Payload hash from local DB submission log (NOT the Fabric anchor — used for display only)
  const payloadHash = raw.payload_hash || raw.payloadHash || "";

  // Fabric-derived fields — MUST be null when not retrieved from real Fabric ledger.
  // Never fall back to hardcoded values.
  const blockNumber: number | null = raw.block_number ?? raw.blockNumber ?? raw.blockHeight ?? null;

  // Actor: may be a UUID (actor_id from AssetHash) or resolved username.
  // MUST NOT default to "System" — that would be fabricated.
  const actor: string | null = raw.actor ?? raw.actor_id ?? null;

  // Previous hash: comes from Fabric block header. Cannot be synthesised.
  // MUST NOT default to "000000...".
  const previousHash: string | null = raw.previous_hash ?? raw.previousHash ?? null;

  // Channel / Chaincode: use real DB-stored value; fall back to correct env values,
  // NOT legacy wrong names like "organmatch-channel" or "organmatch-cc".
  const channel = raw.channel || "organ-donation-channel";
  const chaincode = raw.chaincode || "organ-contract";
  const dbStatus = raw.status || "CONFIRMED";

  // Canonical verification state from backend API field
  const rawStatus = (
    raw.verification_status ??
    raw.fabric_anchor_status ??
    raw.verification ??
    ""
  ).toString().trim().toUpperCase();

  let canonicalStatus: "CONFIRMED" | "PENDING_VERIFICATION" | "FABRIC_OFFLINE" | "NOT_ANCHORED" | "TAMPERING_DETECTED";

  if (rawStatus === "CONFIRMED" || rawStatus === "VERIFIED" || rawStatus === "CONFIRMED_ON_LEDGER") {
    canonicalStatus = "CONFIRMED";
  } else if (rawStatus === "FABRIC_OFFLINE") {
    canonicalStatus = "FABRIC_OFFLINE";
  } else if (rawStatus === "NOT_ANCHORED") {
    canonicalStatus = "NOT_ANCHORED";
  } else if (rawStatus === "TAMPERING_DETECTED" || rawStatus === "TAMPERED") {
    canonicalStatus = "TAMPERING_DETECTED";
  } else {
    canonicalStatus = "PENDING_VERIFICATION";
  }

  return {
    id: rowId,
    fabricTxId: fabricTxId || null,
    fabric_tx_id: fabricTxId || null,
    recordId,
    record_id: recordId,
    recordType,
    record_type: recordType,
    operation,
    payloadHash,
    payload_hash: payloadHash,
    channel,
    chaincode,
    status: dbStatus,
    blockNumber,                           // null = UNAVAILABLE
    block_number: blockNumber,
    createdAt,
    created_at: createdAt,
    confirmedAt,
    confirmed_at: confirmedAt,
    actor,                                 // null = UNAVAILABLE
    organization: raw.organization ?? null,
    record: `${recordType} (${recordId ? String(recordId).slice(0, 8) : "—"})`,
    timestamp: createdAt,
    recordHash: payloadHash,
    previousHash,                          // null = UNAVAILABLE
    previous_hash: previousHash,
    blockHeight: blockNumber,              // null = UNAVAILABLE
    verification: canonicalStatus,
    verification_status: canonicalStatus,
    fabricAnchorStatus: canonicalStatus,
    fabric_anchor_status: canonicalStatus,
  };
}

export function normalizeDonor(raw: any): Donor {
  if (!raw) return raw;
  const d = raw.donor || raw;
  const hlaRaw = typeof d.hla === "string" 
    ? d.hla 
    : (d.hla_information?.raw || d.hla_information?.antigens || (typeof d.hla_information === "object" && Object.keys(d.hla_information || {}).length > 0 ? JSON.stringify(d.hla_information) : ""));
  
  const medNotes = typeof d.medicalDetails === "string" 
    ? d.medicalDetails 
    : (d.medical_details?.notes || d.medical_details?.details || (typeof d.medical_details === "object" && Object.keys(d.medical_details || {}).length > 0 ? JSON.stringify(d.medical_details) : ""));

  const medStatus = d.medical_suitability || d.medicalStatus || d.medical_details?.status || (d.status === "ACTIVE" ? "Not Assessed" : d.status) || "Not Assessed";

  const history = Array.isArray(d.history) ? d.history.map((h: any) => ({
    version: h.version,
    action: h.action,
    userId: h.user_id,
    userName: h.user_name || "Authorized User",
    role: h.role || "Staff",
    field: h.field,
    before: h.before,
    after: h.after,
    diffs: Array.isArray(h.diffs) ? h.diffs : [],
    result: h.result === "ALLOW" ? "SUCCESS" : h.result,
    reason: h.reason,
    timestamp: h.timestamp,
    recordHash: h.record_hash,
    isVerified: h.is_verified ?? true,
  })) : [];

  return {
    id: String(d.id || d.donor_code || ""),
    donor_code: d.donor_code || d.donorCode || d.id || "",
    name: d.name || "Anonymous Donor",
    age: typeof d.age === "number" ? d.age : Number(d.age || 0),
    dateOfBirth: d.date_of_birth || d.dateOfBirth || undefined,
    gender: d.gender || "Not specified",
    contactNumber: d.contact_number || d.contactNumber || undefined,
    residentialAddress: d.residential_address || d.residentialAddress || undefined,
    bloodGroup: d.bloodGroup || (d.blood_group === "Unknown" ? "Not provided" : d.blood_group) || "Not provided",
    donationPreferences: d.donation_preferences || d.donationPreferences || {},
    declarationAcknowledged: d.declaration_acknowledged ?? d.declarationAcknowledged ?? true,
    registrationDate: d.registration_date || d.registrationDate || d.created_at || d.createdAt,
    organType: d.organType || d.required_organ || "Not specified",
    availability: d.availability || (d.status === "ACTIVE" ? "Available" : "Unavailable"),
    organStatus: d.organStatus || (d.status === "ACTIVE" ? "Available" : "Assigned"),
    medicalStatus: medStatus,
    medicalDetails: d.medical_notes || medNotes || "No clinical notes recorded.",
    hla: hlaRaw || "Not provided",
    hospital: d.hospital_name || d.hospital || (d.hospital_id ? "Hospital Facility" : "Unassigned Hospital"),
    hospitalId: String(d.hospitalId || d.hospital_id || ""),
    createdAt: d.createdAt || d.created_at || new Date().toISOString(),
    lastEditedAt: d.lastEditedAt || d.updated_at || d.created_at || new Date().toISOString(),
    lastEditedBy: d.updated_by_name || d.created_by_name || "Authorized User",
    lastEditedRole: d.updated_by_role || d.created_by_role || "Hospital Coordinator",
    createdBy: d.created_by_name || "Authorized User",
    createdByRole: d.created_by_role || "Hospital Coordinator",
    history: history,
  };
}


export function normalizeRecipient(raw: any): Recipient {
  if (!raw) return raw;
  const r = raw.recipient || raw;
  const md = r.medical_details || r.medicalDetails || {};
  const hlaRaw = typeof r.hla === "string"
    ? r.hla
    : (r.hla_information?.raw || (typeof r.hla_information === "object" && Object.keys(r.hla_information || {}).length > 0 ? JSON.stringify(r.hla_information) : ""));

  const medCond = typeof r.medicalCondition === "string"
    ? r.medicalCondition
    : (md.condition || md.primaryDiagnosis || md.notes || (typeof md === "object" && Object.keys(md).length > 0 ? JSON.stringify(md) : ""));

  // Calculate dynamic age from Date of Birth if available
  const dobStr = r.date_of_birth || r.dateOfBirth || md.dateOfBirth;
  let computedAge = typeof r.age === "number" ? r.age : Number(r.age || 0);
  if (dobStr) {
    try {
      const parts = String(dobStr).split("T")[0].split("-");
      if (parts.length === 3) {
        const birthDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        if (age >= 0) computedAge = age;
      }
    } catch {
      // fallback to stored age
    }
  }

  const hist = Array.isArray(r.history) ? r.history.map((h: any) => ({
    version: h.version,
    action: h.action,
    userId: h.user_id,
    userName: h.user_name || "Authorized User",
    role: h.role || "Hospital Coordinator",
    field: h.field,
    before: h.before,
    after: h.after,
    diffs: Array.isArray(h.diffs) ? h.diffs : [],
    result: h.result === "ALLOW" ? "SUCCESS" : h.result,
    reason: h.reason,
    timestamp: h.timestamp,
    recordHash: h.record_hash,
    isVerified: h.is_verified ?? true,
  })) : [];

  return {
    id: String(r.id || r.recipient_code || ""),
    recipient_code: r.recipient_code || r.recipientCode || r.id || "",
    name: r.name || r.recipient_code || "Anonymous Patient",
    age: computedAge,
    dateOfBirth: dobStr || undefined,
    gender: r.gender || md.gender || "Not specified",
    bloodGroup: r.bloodGroup || r.blood_group || "Not specified",
    contactNumber: r.contact_number || r.contactNumber || md.contactNumber || undefined,
    residentialAddress: r.residential_address || r.residentialAddress || md.residentialAddress || undefined,
    city: r.city || md.city || undefined,
    state: r.state || md.state || undefined,
    pincode: r.pincode || md.pincode || undefined,
    requiredOrgan: r.requiredOrgan || r.required_organ || "Not specified",
    medicalCondition: medCond || "No medical condition recorded.",
    medicalDetails: md,
    medicalSuitability: r.medical_suitability || r.medicalSuitability || md.suitability || "Moderate",
    hla: hlaRaw || "None specified",
    priority: r.priority || "MEDIUM",
    urgency: r.urgency || "MODERATE",
    hospital: r.hospital_name || r.hospital || (r.hospital_id ? "Assigned Hospital" : "Not assigned"),
    hospitalId: String(r.hospitalId || r.hospital_id || ""),
    matchStatus: r.matchStatus || (r.status === "ACTIVE" ? "Waiting" : "Allocated"),
    createdAt: r.createdAt || r.created_at || new Date().toISOString(),
    lastEditedAt: r.lastEditedAt || r.updated_at || r.created_at || new Date().toISOString(),
    lastEditedBy: r.updated_by_name || r.lastEditedBy || r.updated_by || r.created_by_name || "Hospital Coordinator",
    createdBy: r.created_by_name || r.createdBy || r.created_by || "Hospital Coordinator",
    history: hist,
  };
}



export function normalizeOrgan(raw: any): any {
  if (!raw) return raw;
  const o = raw.organ || raw;
  const md = typeof o.medical_details === "object" ? o.medical_details : (typeof o.medicalDetails === "object" ? o.medicalDetails : {});
  const donorObj = o.donor || raw.donor || null;

  return {
    ...o,
    id: String(o.id || o.organ_code || ""),
    organCode: o.organCode || o.organ_code || o.id || "",
    organ_code: o.organ_code || o.organCode || o.id || "",
    organType: o.organType || o.organ_type || "Not specified",
    organ_type: o.organ_type || o.organType || "Not specified",
    donorId: String(o.donorId || o.donor_id || ""),
    donor_id: String(o.donor_id || o.donorId || ""),
    donorCode: donorObj?.donor_code || donorObj?.donorCode || o.donor_code || (o.donor_id ? `DNR-${String(o.donor_id).slice(0, 8)}` : "Not specified"),
    donorName: donorObj?.name || o.donor_name || undefined,
    donor: donorObj ? {
      id: donorObj.id,
      donor_code: donorObj.donor_code || donorObj.donorCode,
      name: donorObj.name,
      age: donorObj.age,
      blood_group: donorObj.blood_group || donorObj.bloodGroup,
    } : null,
    bloodGroup: o.bloodGroup || o.blood_group || "Not specified",
    blood_group: o.blood_group || o.bloodGroup || "Not specified",
    status: o.status || "AVAILABLE",
    availability: o.availability || (o.status === "AVAILABLE" ? "Available" : o.status || "Available"),
    medical_details: md,
    medicalDetails: typeof o.medicalDetails === "string" ? o.medicalDetails : (md.notes || md.clinical_notes || "Harvested under sterile clinical conditions."),
    laterality: md.laterality || o.laterality || undefined,
    harvestedAt: md.harvested_at || md.harvestedAt || o.harvestedAt || o.harvested_at || o.ischemic_start_time || o.created_at,
    warmIschemiaMinutes: md.warm_ischemia_minutes ?? md.warmIschemiaMinutes ?? o.warm_ischemia_minutes,
    coldIschemiaTime: md.cold_ischemia_time || md.coldIschemiaTime || o.cold_ischemia_time,
    preservationMethod: md.preservation_method || md.preservationMethod || o.preservation_method,
    clinicalNotes: md.notes || md.clinical_notes || md.additional_notes || undefined,
    createdAt: o.createdAt || o.created_at || new Date().toISOString(),
    created_at: o.created_at || o.createdAt || new Date().toISOString(),
  };
}

export function normalizeAllocation(raw: any): Allocation {
  if (!raw) return raw;
  const a = raw.allocation || raw;
  const organObj = a.organ || {};
  const donorObj = organObj.donor || a.donor || {};
  const recipientObj = a.recipient || {};
  const matchObj = a.match || {};
  const approverObj = a.approver || {};

  const donorId = String(a.donor_id || a.donorId || donorObj.id || organObj.donor_id || "");
  const donorName = a.donor_name || a.donorName || donorObj.name || undefined;
  const donorCode = a.donor_code || a.donorCode || donorObj.donor_code || (donorId ? `DNR-${donorId.slice(0, 8).toUpperCase()}` : undefined);

  const recipientId = String(a.recipient_id || a.recipientId || recipientObj.id || "");
  const recipientName = a.recipient_name || a.recipientName || recipientObj.name || undefined;
  const recipientCode = a.recipient_code || a.recipientCode || recipientObj.recipient_code || (recipientId ? `REC-${recipientId.slice(0, 8).toUpperCase()}` : undefined);

  const organId = String(a.organ_id || a.organId || organObj.id || "");
  const organType = a.organ_type || a.organType || organObj.organ_type || undefined;
  const organCode = a.organ_code || a.organCode || organObj.organ_code || (organId ? `ORG-${organId.slice(0, 8).toUpperCase()}` : undefined);

  const rawScore = a.match_score ?? a.matchScore ?? a.compatibility_score ?? a.compatibilityScore ?? matchObj.compatibility_score;
  const matchScore = rawScore !== undefined && rawScore !== null
    ? (typeof rawScore === "number" ? rawScore : Number(rawScore))
    : undefined;

  const priority = a.priority || recipientObj.priority || undefined;

  const approverName = a.decision_maker || a.decisionMaker || a.approved_by_name || approverObj.full_name || approverObj.username || (a.approved_by ? String(a.approved_by) : null);

  const createdAt = a.created_at || a.createdAt || a.timestamp || undefined;
  const updatedAt = a.updated_at || a.updatedAt || undefined;
  const fabricTxId = a.fabric_tx_id || a.fabricTxId || a.blockchainTx || undefined;

  return {
    ...a,
    id: String(a.id || ""),
    matchId: String(a.match_id || a.matchId || matchObj.id || ""),
    match_id: String(a.match_id || a.matchId || matchObj.id || ""),
    organId,
    organ_id: organId,
    organType: organType || "Organ",
    organ_type: organType || "Organ",
    organCode,
    organ_code: organCode,
    donorId,
    donor_id: donorId,
    donorName,
    donor_name: donorName,
    donorCode,
    donor_code: donorCode,
    recipientId,
    recipient_id: recipientId,
    recipientName,
    recipient_name: recipientName,
    recipientCode,
    recipient_code: recipientCode,
    matchScore,
    match_score: matchScore,
    compatibility_score: matchScore,
    priority: priority || "MEDIUM",
    approvedBy: approverName,
    approved_by: approverName,
    decisionMaker: approverName,
    decision_maker: approverName,
    status: a.status || "PENDING",
    blockchainTx: fabricTxId || "",
    fabric_tx_id: fabricTxId || null,
    fabricTxId: fabricTxId || null,
    timestamp: createdAt || "",
    createdAt: createdAt || "",
    created_at: createdAt || "",
    updatedAt: updatedAt || "",
    updated_at: updatedAt || "",
    hospital: a.hospital || organObj.hospital || donorObj.hospital || "",
  };
}

export const api = {
  // Auth APIs
  login: (username_or_email: string, password: string) =>
    http.post("/auth/login", { username_or_email, password }).then((r) => r.data),
  refresh: () => http.post("/auth/refresh").then((r) => r.data),
  logout: () => http.post("/auth/logout").then((r) => r.data),
  me: () => http.get("/auth/me").then((r) => r.data),

  // Application Data APIs
  dashboard: () => http.get<DashboardSummary>("/dashboard/").then((r) => r.data),

  donors: (params: ListParams) =>
    http.get(`/donors/${qs(params)}`).then((r) => {
      const paged = toPaged<any>(r.data);
      return { ...paged, items: paged.items.map(normalizeDonor) };
    }),
  listDonors: (params?: ListParams) =>
    http.get(`/donors/${qs(params || {})}`).then((r) => {
      const paged = toPaged<any>(r.data);
      return { ...paged, items: paged.items.map(normalizeDonor) };
    }),
  getDonor: (id: string) => http.get(`/donors/${id}`).then((r) => normalizeDonor(r.data)),
  createDonor: (data: any) => {
    const payload = {
      donor_code: data.donor_code || data.donorCode || data.code || undefined,
      name: data.name,
      age: data.age !== undefined && data.age !== null ? Number(data.age) : undefined,
      date_of_birth: data.date_of_birth || data.dateOfBirth || undefined,
      gender: data.gender || "Not specified",
      contact_number: data.contact_number || data.contactNumber || undefined,
      residential_address: data.residential_address || data.residentialAddress || undefined,
      blood_group: data.blood_group || data.bloodGroup || "Not recorded",
      donation_preferences: data.donation_preferences || data.donationPreferences || {},
      declaration_acknowledged: data.declaration_acknowledged ?? data.declarationAcknowledged ?? true,
      registration_date: data.registration_date || data.registrationDate || undefined,
      hospital_id: data.hospital_id || data.hospitalId || undefined,
      hla_information: typeof data.hla === "string" ? { raw: data.hla } : (data.hla_information || (data.hla ? { raw: data.hla } : {})),
      medical_details: typeof data.medicalStatus === "string" ? { status: data.medicalStatus, notes: data.medicalDetails } : (data.medical_details || (data.medicalStatus ? { status: data.medicalStatus } : {})),
    };
    return http.post("/donors/", payload).then((r) => normalizeDonor(r.data));
  },

  updateDonor: (id: string, data: any) => {
    const payload: any = { ...data };
    if (data.bloodGroup !== undefined) {
      payload.blood_group = data.bloodGroup;
    }
    if (data.dateOfBirth !== undefined) {
      payload.date_of_birth = data.dateOfBirth;
    }
    if (data.contactNumber !== undefined) {
      payload.contact_number = data.contactNumber;
    }
    if (data.residentialAddress !== undefined) {
      payload.residential_address = data.residentialAddress;
    }
    if (data.donationPreferences !== undefined) {
      payload.donation_preferences = data.donationPreferences;
    }
    if (data.declarationAcknowledged !== undefined) {
      payload.declaration_acknowledged = data.declarationAcknowledged;
    }
    if (data.registrationDate !== undefined) {
      payload.registration_date = data.registrationDate;
    }
    if (data.hospitalId !== undefined) {
      payload.hospital_id = data.hospitalId;
    }
    return http.put(`/donors/${id}`, payload).then((r) => normalizeDonor(r.data));
  },
  deleteDonor: (id: string, reason: string) => http.delete(`/donors/${id}`, { data: { reason } }).then((r) => r.data),
  donorHistory: (id: string) =>
    http.get<HistoryEntry[]>(`/donors/${id}/history`).then((r) => r.data),

  recipients: (params: ListParams) =>
    http.get(`/recipients/${qs(params)}`).then((r) => {
      const paged = toPaged<any>(r.data);
      return { ...paged, items: paged.items.map(normalizeRecipient) };
    }),
  listRecipients: (params?: ListParams) =>
    http.get(`/recipients/${qs(params || {})}`).then((r) => {
      const paged = toPaged<any>(r.data);
      return { ...paged, items: paged.items.map(normalizeRecipient) };
    }),
  getRecipient: (id: string) => http.get(`/recipients/${id}`).then((r) => normalizeRecipient(r.data)),
  createRecipient: (data: any) => {
    let organ = (data.required_organ || data.requiredOrgan || data.requiredOrganTissue || "KIDNEY").toUpperCase();
    if (organ === "LUNGS") organ = "LUNG";
    else if (organ === "PANCREATIC") organ = "PANCREAS";

    let priority = (data.priority || "MEDIUM").toUpperCase();
    let urgency = (data.urgency || "MODERATE").toUpperCase();
    if (urgency === "STABLE") urgency = "LOW";

    const medDetails = typeof data.medicalDetails === "object" && data.medicalDetails !== null
      ? { ...data.medicalDetails }
      : (typeof data.medical_details === "object" && data.medical_details !== null ? { ...data.medical_details } : {});

    if (data.medicalCondition && !medDetails.condition) medDetails.condition = data.medicalCondition;
    if (data.primaryDiagnosis && !medDetails.primaryDiagnosis) medDetails.primaryDiagnosis = data.primaryDiagnosis;
    if (data.diagnosisDetails && !medDetails.diagnosisDetails) medDetails.diagnosisDetails = data.diagnosisDetails;
    if (data.dateOfDiagnosis && !medDetails.dateOfDiagnosis) medDetails.dateOfDiagnosis = data.dateOfDiagnosis;
    if (data.diseaseStage && !medDetails.diseaseStage) medDetails.diseaseStage = data.diseaseStage;
    if (data.comorbidConditions && !medDetails.comorbidConditions) medDetails.comorbidConditions = data.comorbidConditions;
    if (data.height !== undefined && !medDetails.height) medDetails.height = data.height;
    if (data.weight !== undefined && !medDetails.weight) medDetails.weight = data.weight;
    if (data.bmi !== undefined && !medDetails.bmi) medDetails.bmi = data.bmi;
    if (data.bloodPressure && !medDetails.bloodPressure) medDetails.bloodPressure = data.bloodPressure;
    if (data.diabetes !== undefined && medDetails.diabetes === undefined) medDetails.diabetes = data.diabetes;
    if (data.hypertension !== undefined && medDetails.hypertension === undefined) medDetails.hypertension = data.hypertension;
    if (data.allergies && !medDetails.allergies) medDetails.allergies = data.allergies;
    if (data.currentMedications && !medDetails.currentMedications) medDetails.currentMedications = data.currentMedications;
    if (data.smokingStatus && !medDetails.smokingStatus) medDetails.smokingStatus = data.smokingStatus;
    if (data.additionalNotes && !medDetails.additionalNotes) medDetails.additionalNotes = data.additionalNotes;
    if (data.gender && !medDetails.gender) medDetails.gender = data.gender;
    if (data.dateOfBirth && !medDetails.dateOfBirth) medDetails.dateOfBirth = data.dateOfBirth;
    if (data.contactNumber && !medDetails.contactNumber) medDetails.contactNumber = data.contactNumber;
    if (data.residentialAddress && !medDetails.residentialAddress) medDetails.residentialAddress = data.residentialAddress;
    if (data.city && !medDetails.city) medDetails.city = data.city;
    if (data.state && !medDetails.state) medDetails.state = data.state;
    if (data.pincode && !medDetails.pincode) medDetails.pincode = data.pincode;
    if (data.declarationAcknowledged !== undefined) medDetails.declarationAcknowledged = data.declarationAcknowledged;
    if (data.registrationDate) medDetails.registrationDate = data.registrationDate;

    const payload = {
      recipient_code: data.recipient_code || data.recipientCode || data.code || undefined,
      name: data.name,
      age: Number(data.age || 0),
      blood_group: (data.blood_group || data.bloodGroup || "").toUpperCase(),
      required_organ: organ,
      hospital_id: data.hospital_id || data.hospitalId || undefined,
      hla_information: typeof data.hla === "string" ? { raw: data.hla } : (data.hla_information || (data.hla ? { raw: data.hla } : {})),
      medical_details: medDetails,
      priority,
      urgency,
    };
    return http.post("/recipients/", payload).then((r) => normalizeRecipient(r.data));
  },
  updateRecipient: (id: string, data: any) => {
    const payload: any = { ...data };
    if (data.bloodGroup !== undefined) payload.blood_group = data.bloodGroup;
    if (data.requiredOrgan !== undefined) payload.required_organ = data.requiredOrgan;
    if (data.hospitalId !== undefined) payload.hospital_id = data.hospitalId;
    return http.put(`/recipients/${id}`, payload).then((r) => normalizeRecipient(r.data));
  },

  deleteRecipient: (id: string, reason: string) => http.delete(`/recipients/${id}`, { data: { reason } }).then((r) => r.data),
  recipientHistory: (id: string) =>
    http.get<HistoryEntry[]>(`/recipients/${id}/history`).then((r) => r.data),

  organs: (params: ListParams) =>
    http.get(`/organs/${qs(params)}`).then((r) => {
      const paged = toPaged<any>(r.data);
      return { ...paged, items: paged.items.map(normalizeOrgan) };
    }),
  listOrgans: (params?: ListParams) =>
    http.get(`/organs/${qs(params || {})}`).then((r) => {
      const paged = toPaged<any>(r.data);
      return { ...paged, items: paged.items.map(normalizeOrgan) };
    }),
  getOrgan: (id: string) => http.get(`/organs/${id}`).then((r) => normalizeOrgan(r.data)),
  createOrgan: (data: Partial<Organ>) =>
    http.post<Organ>("/organs/", data).then((r) => normalizeOrgan(r.data)),
  deleteOrgan: (id: string, reason: string) => http.delete(`/organs/${id}`, { data: { reason } }).then((r) => r.data),
  deleteRecord: (entityType: string, id: string, reason: string) =>
    http.delete(`/coordinator/${entityType}/${id}`, { data: { reason } }).then((r) => r.data),


  hospitals: (params: ListParams) =>
    http.get(`/hospitals/${qs(params)}`).then((r) => toPaged<Hospital>(r.data)),
  listHospitals: (params?: ListParams) =>
    http.get(`/hospitals/${qs(params || {})}`).then((r) => toPaged<Hospital>(r.data)),

  listMatches: (params: ListParams) =>
    http.get(`/matching/matches${qs(params)}`).then((r) => toPaged<MatchResult>(r.data)),
  allocationListMatches: () =>
    http.get("/allocation/matches").then((r) => r.data),
  allocationGetMatch: (matchId: string) =>
    http.get(`/allocation/matches/${matchId}`).then((r) => r.data),
  allocationListAudit: (params?: ListParams) =>
    http.get("/allocation/audit").then((r) => r.data),
  auditList: (params?: ListParams) =>
    http.get("/allocation/audit").then((r) => r.data),
  runMatching: (organ_id: string) =>
    http
      .post<MatchResult[]>("/matching/run", { organ_id })
      .then((r) => r.data),
  coordinatorRunMatching: (organ_id: string) =>
    http
      .post<MatchResult[]>("/matching/run", { organ_id })
      .then((r) => r.data),

  listAllocations: (params: ListParams) =>
    http.get(`/allocations/${qs(params)}`).then((r) => {
      const paged = toPaged<any>(r.data);
      return { ...paged, items: paged.items.map(normalizeAllocation) };
    }),
  getAllocation: (id: string) =>
    http.get(`/allocations/${id}`).then((r) => normalizeAllocation(r.data)),
  createAllocation: (donorId: string, recipientId: string) =>
    http.post<Allocation>("/allocations/", { donorId, recipientId }).then((r) => normalizeAllocation(r.data)),
  approveAllocation: (id: string) =>
    http.post<Allocation>(`/allocations/${id}/approve`).then((r) => normalizeAllocation(r.data)),
  rejectAllocation: (id: string, reason?: string) =>
    http.post<Allocation>(`/allocations/${id}/reject`, reason ? { rejection_reason: reason } : {}).then((r) => normalizeAllocation(r.data)),

  listBlockchain: (params: ListParams) =>
    http.get(`/blockchain/transactions${qs(params)}`).then((r) => {
      const paged = toPaged<any>(r.data);
      return {
        ...paged,
        items: paged.items.map(normalizeBlockchainTx),
      };
    }),
  verifyBlockchainTx: (fabricTxId: string) =>
    http.post(`/blockchain/verify-tx`, { fabric_tx_id: fabricTxId }).then((r) => r.data),

  listUsers: (params: ListParams) =>
    http.get(`/users/${qs(params)}`).then((r) => toPaged<User>(r.data)),
  setUserStatus: (id: string, status: "Active" | "Suspended") =>
    http.put<User>(`/users/${id}/status`, { status }).then((r) => r.data),

  // ─── Admin APIs ──────────────────────────────────────────────────────────────
  adminOverview: () =>
    http.get<AdminOverview>("/admin/overview").then((r) => r.data),

  adminListUsers: () =>
    http.get<AdminUserDetail[]>("/admin/users/").then((r) => r.data),
  adminGetUser: (id: string) =>
    http.get<AdminUserDetail>(`/admin/users/${id}`).then((r) => r.data),
  adminCreateUser: (body: {
    username: string;
    full_name?: string;
    email: string;
    hospital_id?: string | null;
    role_name: string;
    password: string;
  }) => http.post("/admin/users/", body).then((r) => r.data),
  adminUpdateUser: (
    id: string,
    body: { full_name?: string; email?: string; hospital_id?: string | null }
  ) => http.put(`/admin/users/${id}`, body).then((r) => r.data),
  adminSetUserStatus: (id: string, status: string) =>
    http.put(`/admin/users/${id}/status`, { status }).then((r) => r.data),
  adminResetPassword: (id: string, new_password?: string) =>
    http.post<ResetPasswordResult>(`/admin/users/${id}/reset-password`, new_password ? { new_password } : {}).then((r) => r.data),
  adminChangePassword: (id: string, new_password: string) =>
    http.post<{ message: string; user_id: string }>(`/admin/users/${id}/change-password`, { new_password }).then((r) => r.data),
  adminAssignRole: (id: string, role_name: string) =>
    http.post(`/admin/users/${id}/roles`, { role_name }).then((r) => r.data),
  adminRemoveRole: (id: string, role_name: string) =>
    http.delete(`/admin/users/${id}/roles/${role_name}`).then((r) => r.data),

  adminListRoles: () =>
    http.get<AdminRoleWithPermissions[]>("/admin/roles").then((r) => r.data),

  adminListHospitals: () =>
    http.get<AdminHospitalDetail[]>("/admin/hospitals/").then((r) => r.data),
  adminCreateHospital: (body: {
    name: string;
    code?: string;
    location: string;
    contact_email?: string;
    contact_phone?: string;
    address?: string;
  }) => http.post("/admin/hospitals/", body).then((r) => r.data),
  adminUpdateHospital: (
    id: string,
    body: {
      name?: string;
      code?: string;
      location?: string;
      contact_email?: string;
      contact_phone?: string;
      address?: string;
    }
  ) => http.put(`/admin/hospitals/${id}`, body).then((r) => r.data),
  adminSetHospitalStatus: (id: string, status: string) =>
    http.put(`/admin/hospitals/${id}/status`, { status }).then((r) => r.data),

  adminGetSettings: () =>
    http.get<AdminSystemSettings>("/admin/settings").then((r) => r.data),
  adminCleanupDemoData: () =>
    http.post<{ message: string; counts: Record<string, number> }>("/admin/development/cleanup-demo-data").then((r) => r.data),

  // ─── Coordinator APIs ────────────────────────────────────────────────────────
  coordinatorOverview: () =>
    http.get<CoordinatorOverview>("/coordinator/overview").then((r) => r.data),
  coordinatorRunMatching: (organId: string) =>
    http.post<any[]>("/matching/run", { organ_id: organId }).then((r) => r.data),

  // ─── Doctor APIs ─────────────────────────────────────────────────────────────
  doctorOverview: () =>
    http.get<DoctorOverview>("/doctor/overview").then((r) => r.data),

  doctorListTargets: () =>
    http.get<AssessmentTarget[]>("/doctor/targets").then((r) => r.data),

  doctorListDonors: () =>
    http.get<any[]>("/doctor/donors").then((r) => r.data),
  doctorGetDonor: (id: string) =>
    http.get<DoctorDonorDetail>(`/doctor/donors/${id}`).then((r) => r.data),

  doctorListOrgans: () =>
    http.get<any[]>("/doctor/organs").then((r) => r.data),
  doctorGetOrgan: (id: string) =>
    http.get<DoctorOrganDetail>(`/doctor/organs/${id}`).then((r) => r.data),

  doctorListRecipients: () =>
    http.get<any[]>("/doctor/recipients").then((r) => r.data),
  doctorGetRecipient: (id: string) =>
    http.get<DoctorRecipientDetail>(`/doctor/recipients/${id}`).then((r) => r.data),

  doctorListMatches: () =>
    http.get<DoctorMatchProposal[]>("/doctor/matches").then((r) => r.data),
  doctorGetMatch: (id: string) =>
    http.get<DoctorMatchProposal>(`/doctor/matches/${id}`).then((r) => r.data),
  doctorReviewMatch: (
    id: string,
    body: {
      suitability: string;
      risk_level: string;
      recommendation: string;
      clinical_notes?: string;
      rejection_reason?: string;
    }
  ) => http.post<any>(`/doctor/matches/${id}/review`, body).then((r) => r.data),

  doctorListAssessments: (params?: { entity_type?: string; entity_id?: string }) =>
    http.get<MedicalAssessment[]>(`/doctor/assessments${params ? qs(params as any) : ""}`).then((r) => r.data),
  doctorGetAssessment: (id: string) =>
    http.get<MedicalAssessment>(`/doctor/assessments/${id}`).then((r) => r.data),
  doctorCreateAssessment: (body: {
    entity_type: string;
    entity_id: string;
    suitability: string;
    risk_level: string;
    clinical_notes?: string;
    recommendation?: string;
  }) => http.post<MedicalAssessment>("/doctor/assessments", body).then((r) => r.data),
  doctorUpdateAssessment: (
    id: string,
    body: {
      suitability?: string;
      risk_level?: string;
      clinical_notes?: string;
      recommendation?: string;
    }
  ) => http.put<MedicalAssessment>(`/doctor/assessments/${id}`, body).then((r) => r.data),

  doctorListHistory: () =>
    http.get<DoctorHistoryItem[]>("/doctor/history").then((r) => r.data),

  // ─── Allocation Authority APIs ──────────────────────────────────────────────
  allocationOverview: () =>
    http.get<any>("/allocation/overview").then((r) => r.data),
  allocationListOrgans: () =>
    http.get<any[]>("/allocation/organs").then((r) => r.data),
  allocationListMatches: () =>
    http.get<any[]>("/allocation/matches").then((r) => r.data),
  allocationGetMatch: (id: string) =>
    http.get<any>(`/allocation/matches/${id}`).then((r) => r.data),
  allocationQueue: () =>
    http.get<any[]>("/allocation/queue").then((r) => r.data),
  allocationHistory: () =>
    http.get<any[]>("/allocation/history").then((r) => r.data),
  approveAllocation: (id: string) =>
    http.post<any>(`/allocations/${id}/approve`).then((r) => r.data),
  rejectAllocation: (id: string, reason: string) =>
    http.post<any>(`/allocations/${id}/reject`, { rejection_reason: reason }).then((r) => r.data),
  attemptModifyScore: (matchId: string) =>
    http.put<any>(`/allocation/matches/${matchId}/score`).then((r) => r.data),

  // ─── System Monitoring APIs ──────────────────────────────────────────────────
  systemHealth: () =>
    http.get<SystemHealthResponse>("/admin/system/health").then((r) => r.data),
  systemServices: () =>
    http.get<ServicesMonitoringResponse>("/admin/system/services").then((r) => r.data),
  systemPostgresql: () =>
    http.get<PostgresqlMonitoringResponse>("/admin/system/postgresql").then((r) => r.data),
  systemDatabase: () =>
    http.get<DatabaseTablesResponse>("/admin/system/database").then((r) => r.data),
  systemBackend: () =>
    http.get<BackendMonitoringResponse>("/admin/system/backend").then((r) => r.data),
  systemAuthentication: () =>
    http.get<AuthMonitoringResponse>("/admin/system/authentication").then((r) => r.data),
  systemDocker: () =>
    http.get<DockerMonitoringResponse>("/admin/system/docker").then((r) => r.data),
  systemBlockchain: () =>
    http.get<BlockchainMonitoringResponse>("/admin/system/blockchain").then((r) => r.data),
  systemApiActivity: () =>
    http.get<ApiActivityResponse>("/admin/system/api-activity").then((r) => r.data),
  systemErrors: () =>
    http.get<ErrorLogsResponse>("/admin/system/errors").then((r) => r.data),

  /** Returns the SSE stream URL (caller must pass token via ?token= for EventSource) */
  systemStreamUrl: () => {
    const token = localStorage.getItem("access_token") ?? "";
    return `/api/admin/system/stream?token=${encodeURIComponent(token)}`;
  },
};


export { ApiError };
