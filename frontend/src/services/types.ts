import type { Role } from "@/lib/permissions";

export type OrganType = "Heart" | "Lungs" | "Kidney" | "Pancreas";
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
export type OrganStatus = "Available" | "Under Review" | "Matched" | "Allocated" | "Unavailable";
export type AllocationStatus = "Pending Review" | "Approved" | "Rejected" | "Completed";
export type Priority = "High" | "Medium" | "Low";
export type Urgency = "Critical" | "High" | "Moderate" | "Stable";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  organization: string;
  status: "Active" | "Suspended";
  lastLogin: string;
}

export interface Hospital {
  id: string;
  name: string;
  organization: string;
  location: string;
  users: number;
  activeRecords: number;
  status: "Active" | "Suspended";
}

export interface RecordMeta {
  createdBy: string;
  createdAt: string;
  lastEditedBy: string;
  lastEditedAt: string;
  version: number;
  status: "Active" | "Archived";
}

export interface Donor extends RecordMeta {
  id: string;
  donor_code?: string;
  name?: string;
  age: number;
  dateOfBirth?: string;
  gender: "Male" | "Female" | "Other" | "Not specified" | string;
  contactNumber?: string;
  residentialAddress?: string;
  bloodGroup: BloodGroup | "Not recorded" | string;
  donationPreferences?: {
    organs?: string[];
    tissues?: string[];
    other_organs?: string | null;
    other_tissues?: string | null;
    [key: string]: any;
  };
  declarationAcknowledged?: boolean;
  registrationDate?: string;
  organType: OrganType | "Not specified" | string;
  availability: "Available" | "Unavailable" | string;
  organStatus: OrganStatus | string;
  medicalStatus: "Suitable" | "Under Review" | "Not Suitable" | string;
  medicalDetails: string;
  hla: string;
  hospital: string;
  hospitalId: string;
}


export interface Recipient extends RecordMeta {
  id: string;
  recipient_code?: string;
  name?: string;
  age: number;
  dateOfBirth?: string;
  gender: "Male" | "Female" | "Other" | string;
  bloodGroup: BloodGroup | string;
  contactNumber?: string;
  residentialAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  requiredOrgan: OrganType | string;
  medicalCondition: string;
  medicalDetails?: {
    condition?: string;
    primaryDiagnosis?: string;
    diagnosisDetails?: string;
    dateOfDiagnosis?: string;
    diseaseStage?: string;
    comorbidConditions?: string[];
    height?: number;
    weight?: number;
    bmi?: number;
    bloodPressure?: string;
    diabetes?: boolean | string;
    hypertension?: boolean | string;
    allergies?: string;
    currentMedications?: string;
    smokingStatus?: string;
    additionalNotes?: string;
    declarationAcknowledged?: boolean;
    registrationDate?: string;
    [key: string]: any;
  };
  medicalSuitability: "High" | "Moderate" | "Low" | string;
  hla: string;
  priority: Priority | string;
  urgency: Urgency | string;
  hospital: string;
  hospitalId: string;
  matchStatus: "Waiting" | "Matched" | "Allocated" | string;
  history?: HistoryEvent[];
}



export interface Organ {
  id: string;
  organType: OrganType;
  donorId: string;
  bloodGroup: BloodGroup;
  hospital: string;
  status: OrganStatus;
  availability: "Available" | "Unavailable";
  registeredAt: string;
}

export interface MatchComponents {
  blood: number; // out of 25
  medical: number; // out of 30
  hla: number; // out of 25
  priority: number; // out of 20
}

export interface MatchResult {
  id: string;
  donorId: string;
  recipientId: string;
  organType: OrganType;
  rank: number;
  bloodCompatibility: "Compatible" | "Incompatible";
  medicalCompatibility: "High" | "Moderate" | "Low";
  tissueHla: "Compatible" | "Review" | "Incompatible";
  priority: Priority;
  score: number;
  status: "Eligible" | "Review Required" | "Ineligible";
  components: MatchComponents;
  eligibility: Array<{ label: string; passed: boolean }>;
  createdAt: string;
}

export interface Allocation {
  id: string;
  match_id?: string;
  matchId?: string;
  organ_id?: string;
  organId?: string;
  organ_type?: OrganType | string;
  organType?: OrganType | string;
  organ_code?: string;
  organCode?: string;
  donor_id?: string;
  donorId?: string;
  donor_name?: string;
  donorName?: string;
  donor_code?: string;
  donorCode?: string;
  recipient_id?: string;
  recipientId?: string;
  recipient_name?: string;
  recipientName?: string;
  recipient_code?: string;
  recipientCode?: string;
  match_score?: number;
  matchScore?: number;
  compatibility_score?: number;
  compatibilityScore?: number;
  compatibility_score_pct?: number;
  medicalCompatibility?: string;
  priority?: Priority | string;
  approved_by?: string | null;
  approvedBy?: string | null;
  decision_maker?: string | null;
  decisionMaker?: string | null;
  status: AllocationStatus | string;
  fabric_tx_id?: string | null;
  fabricTxId?: string | null;
  blockchainTx?: string;
  timestamp?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  rejection_reason?: string | null;
  hospital?: string;
}



export interface AuditTransaction {
  id: string;
  userId: string;
  userName: string;
  organization: string;
  operation: string;
  record: string;
  timestamp: string;
  result: "SUCCESS" | "DENIED" | "FAILED";
  blockchainStatus: "VERIFIED" | "PENDING" | "REJECTED";
  recordHash: string;
}

export interface BlockchainTransaction {
  id: string;
  fabricTxId: string | null;          // null when not yet anchored on Fabric
  fabric_tx_id?: string | null;
  recordId: string;
  record_id?: string;
  recordType: string;
  record_type?: string;
  operation: string;
  payloadHash: string;
  payload_hash?: string;
  channel: string;
  chaincode: string;
  status: string;
  blockNumber: number | null;         // null = UNAVAILABLE (not retrieved from Fabric)
  block_number?: number | null;
  createdAt: string;
  created_at?: string;
  confirmedAt?: string | null;
  confirmed_at?: string | null;
  actor?: string | null;              // null = UNAVAILABLE (not retrieved from Fabric)
  organization?: string | null;
  record?: string;
  timestamp?: string;
  recordHash?: string;
  previousHash?: string | null;       // null = UNAVAILABLE (not retrieved from Fabric)
  previous_hash?: string | null;
  blockHeight?: number | null;        // null = UNAVAILABLE
  verification?: string;
  verification_status?: string | null; // "CONFIRMED" | "PENDING_VERIFICATION" | "FABRIC_OFFLINE" | "NOT_ANCHORED" | "TAMPERING_DETECTED"
  fabricAnchorStatus?: string | null; // Canonical status alias
  fabric_anchor_status?: string | null;
}


export interface HistoryFieldDiff {
  field: string;
  before: string;
  after: string;
}

export interface HistoryEntry {
  version: number;
  action: string;
  userId?: string;
  userName?: string;
  role?: string;
  field?: string;
  before?: string;
  after?: string;
  diffs?: HistoryFieldDiff[];
  result?: "SUCCESS" | "DENIED" | "ALLOW" | string;
  reason?: string;
  timestamp: string;
  recordHash?: string;
  previousHash?: string;
  isVerified?: boolean;
}

export interface DashboardSummary {
  stats: {
    donors: number;
    recipients: number;
    availableOrgans: number;
    pendingMatches: number;
    allocations: number;
  };
  recentMatches: Array<{
    donorId: string;
    organType: OrganType;
    topRecipient: string;
    matchScore: number;
    status: string;
    createdAt: string;
  }>;
  recentAllocations: Allocation[];
}

// ─── Admin Types ──────────────────────────────────────────────────────────────

export interface AdminRoleInfo {
  id: string;
  name: string;
  description: string | null;
}

export interface AdminUserDetail {
  id: string;
  username: string;
  full_name: string | null;
  email: string;
  status: string;
  must_change_password: boolean;
  hospital_id: string | null;
  hospital_name: string | null;
  role: string | null;
  roles: AdminRoleInfo[];
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminHospitalDetail {
  id: string;
  name: string;
  code: string | null;
  location: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  status: string;
  user_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminOverview {
  total_users: number;
  active_users: number;
  inactive_users: number;
  total_hospitals: number;
  active_hospitals: number;
  total_security_events: number;
  open_tampering_alerts: number;
  total_blockchain_transactions: number;
  recent_security_events: number;
}

export interface AdminPermission {
  id: string;
  name: string;
  description: string | null;
}

export interface AdminRoleWithPermissions {
  id: string;
  name: string;
  description: string | null;
  permissions: AdminPermission[];
}

export interface AdminSystemSettings {
  max_failed_login_attempts: number;
  account_lock_duration_minutes: number;
  access_token_expire_minutes: number;
  refresh_token_expire_days: number;
  matching_algorithm_version: string;
  app_env: string;
  audit_retention_days: number;
  security_monitoring_enabled: boolean;
}

export interface ResetPasswordResult {
  user_id: string;
  username: string;
  temporary_password: string;
  message: string;
}

// ─── Coordinator Types ────────────────────────────────────────────────────────

export interface CoordinatorOverview {
  hospital_id: string | null;
  hospital_name: string;
  active_donors: number;
  available_organs: number;
  active_recipients: number;
  pending_medical_reviews: number;
  active_matches: number;
  pending_allocations: number;
  recent_donors: Array<{
    id: string;
    code: string;
    name: string;
    age: number;
    blood_group: string;
    status: string;
    created_at: string;
  }>;
  recent_organs: Array<{
    id: string;
    code: string;
    organ_type: string;
    blood_group: string;
    status: string;
    created_at: string;
  }>;
  recent_recipients: Array<{
    id: string;
    code: string;
    name: string;
    age: number;
    required_organ: string;
    blood_group: string;
    priority: string;
    urgency: string;
    status: string;
    created_at: string;
  }>;
}

// ─── Doctor Types ─────────────────────────────────────────────────────────────

export type Suitability = "APPROVED" | "NOT_APPROVED" | "NEEDS_REVIEW";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface MedicalAssessment {
  id: string;
  entity_type: "Donor" | "Recipient" | "Organ" | "Match";
  entity_id: string;
  suitability: Suitability;
  risk_level: RiskLevel;
  clinical_notes: string | null;
  recommendation: string | null;
  reviewed_by: string;
  reviewed_at: string;
  created_at: string;
  updated_at: string;
  reviewer_username?: string | null;
}


// ─── System Monitoring Types ──────────────────────────────────────────────────

export type ServiceStatusType = "HEALTHY" | "DEGRADED" | "DOWN" | "NOT_CONFIGURED" | "OFFLINE";

export interface ServiceHealthStatus {
  service: string;
  status: ServiceStatusType;
  latency_ms?: number | null;
  last_checked: string;
  message?: string | null;
  details?: Record<string, any> | null;
}

export interface SystemHealthResponse {
  overall_status: "HEALTHY" | "DEGRADED" | "DOWN";
  last_checked: string;
  backend_response_time_ms: number;
  database_response_time_ms: number;
  active_users_count: number;
  recent_errors_count: number;
  services: ServiceHealthStatus[];
}

export interface PostgresqlMonitoringResponse {
  status: ServiceStatusType;
  version: string;
  database_name: string;
  host: string;
  port: number;
  database_size_bytes: number;
  database_size_human: string;
  number_of_tables: number;
  active_connections: number;
  idle_connections: number;
  max_connections: number;
  response_time_ms: number;
  last_checked: string;
}

export interface TableMetric {
  table_name: string;
  approximate_row_count: number;
  total_size_bytes: number;
  total_size_human: string;
  last_checked: string;
}

export interface DatabaseTablesResponse {
  tables: TableMetric[];
  total_tables: number;
  total_database_size_human: string;
  last_checked: string;
}

export interface BackendMonitoringResponse {
  status: ServiceStatusType;
  api_version: string;
  fastapi_version: string;
  python_version: string;
  uptime_seconds: number;
  response_time_ms: number;
  total_requests_count: number;
  responses_2xx_count: number;
  responses_4xx_count: number;
  responses_5xx_count: number;
  recent_errors: Array<Record<string, any>>;
  last_checked: string;
}

export interface AuthMonitoringResponse {
  jwt_status: ServiceStatusType;
  access_token_service_status: string;
  refresh_token_service_status: string;
  active_users: number;
  failed_login_attempts: number;
  locked_accounts: number;
  recent_auth_errors: Array<Record<string, any>>;
  last_checked: string;
}

export interface DockerContainerStatus {
  container_name: string;
  service_name: string;
  status: string;
  uptime?: string | null;
  health?: string | null;
  restart_count: number;
}

export interface DockerMonitoringResponse {
  service?: string;
  status?: ServiceStatusType;
  docker_status: ServiceStatusType;
  configured?: boolean;
  available?: boolean;
  daemon_connected?: boolean;
  docker_version?: string | null;
  running_containers?: number;
  stopped_containers?: number;
  total_containers?: number;
  message?: string | null;
  containers: DockerContainerStatus[];
  checked_at?: string;
  last_checked: string;
}

export interface BlockchainMonitoringResponse {
  service?: string;
  status: ServiceStatusType;
  configured?: boolean;
  connected?: boolean;
  network_reachable?: boolean;
  is_live_network?: boolean;
  peer_status?: string;
  orderer_status?: string;
  peer_endpoint?: string | null;
  orderer_endpoint?: string | null;
  message?: string | null;
  network: string;
  channel: string;
  chaincode: string;
  chaincode_status?: string | null;
  latest_block?: number | null;
  last_known_block?: number | null;
  last_synced_at?: string | null;
  transaction_count: number;
  local_transaction_count?: number;
  failed_transactions: number;
  last_successful_tx?: string | null;
  last_verification?: string | null;
  checked_at?: string;
  last_checked: string;
}

export interface UnifiedServiceHealthItem {
  name: string;
  type: "docker" | "fabric" | "database" | "backend" | "auth" | string;
  status: ServiceStatusType;
  message: string;
  latency_ms?: number | null;
  metrics?: Record<string, any>;
  checked_at: string;
}

export interface ServicesMonitoringResponse {
  services: UnifiedServiceHealthItem[];
  overall_status: string;
  checked_at: string;
}

export interface ApiActivityItem {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  status_code: number;
  response_time_ms?: number | null;
  username: string;
  role: string;
  request_id?: string | null;
}

export interface ApiActivityResponse {
  items: ApiActivityItem[];
  total: number;
  last_checked: string;
}

export interface ErrorLogItem {
  id: string;
  timestamp: string;
  service: string;
  endpoint?: string | null;
  status_code?: number | null;
  error_type: string;
  reason: string;
  request_id?: string | null;
  username?: string | null;
  resolution_status: string;
}

export interface ErrorLogsResponse {
  items: ErrorLogItem[];
  total: number;
  last_checked: string;
}



// ─── Doctor & Clinical Review Types ──────────────────────────────────────────

export interface PriorityClinicalReview {
  id: string;
  type: "Recipient" | "Donor" | "Organ" | "Match";
  code: string;
  target_label: string;
  organ: string;
  blood_group: string;
  age?: number | null;
  urgency: string;
  priority: string;
  compatibility_score?: number | null;
  created_at: string;
  status: string;
  next_action?: string;
  review_url: string;
}

// Alias for convenience
export type PriorityReviewItem = PriorityClinicalReview;

export interface DoctorOverview {
  hospital_id?: string | null;
  hospital_name: string;
  donors_pending_review: number;
  recipients_pending_review: number;
  organs_available: number;
  matches_pending: number;
  total_assessments_by_me: number;
  recent_assessments: Array<{
    id: string;
    entity_type: string;
    entity_id: string;
    target_code?: string;
    target_name?: string;
    suitability: string;
    risk_level: string;
    clinical_notes?: string;
    recommendation?: string;
    reviewed_at?: string;
  }>;
  priority_reviews: PriorityClinicalReview[];
}

export interface AssessmentTarget {
  id: string;
  code: string;
  type: "Donor" | "Recipient" | "Organ";
  name: string;
  age?: number | null;
  gender?: string | null;
  organ: string;
  blood_group: string;
  priority: string;
  urgency: string;
  status: string;
  suitability?: string | null;
  risk_level?: string | null;
  clinical_notes?: string | null;
  recommendation?: string | null;
  last_review?: string | null;
  assessment_id?: string | null;
  created_at?: string | null;
}



export interface DoctorOrganDetail {
  id: string;
  organ_code: string;
  organ_type: string;
  donor_id: string;
  donor_code?: string;
  donor_name?: string;
  blood_group: string;
  status: string;
  laterality?: string;
  harvest_date?: string | null;
  cold_ischemia_time?: string;
  warm_ischemia_time?: string;
  preservation_method?: string;
  clinical_notes?: string;
  hospital_name?: string;
  medical_details?: Record<string, any>;
  created_at?: string | null;
  updated_at?: string | null;
  assessments?: any[];
  latest_assessment?: any;
}

export interface DoctorRecipientDetail {
  id: string;
  recipient_code: string;
  name: string;
  age: number;
  gender?: string;
  blood_group: string;
  required_organ: string;
  urgency: string;
  priority: string;
  status: string;
  hla_information?: any;
  medical_condition?: string;
  medical_details?: Record<string, any>;
  hospital_id?: string;
  hospital?: string;
  hospital_name?: string;
  registered_on?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  matched_organ?: {
    id: string;
    organ_code: string;
    organ_type: string;
    blood_group: string;
    status: string;
    laterality?: string;
    harvest_date?: string | null;
    cold_ischemia_time?: string;
    warm_ischemia_time?: string;
    preservation_method?: string;
    clinical_notes?: string;
    medical_details?: Record<string, any>;
  } | null;
  match?: {
    id: string;
    match_code: string;
    donor_id?: string | null;
    donor_code?: string;
    donor_name?: string;
    compatibility_score: number;
    rank: number;
    status: string;
    eligibility: string;
    blood_compatibility: string;
    medical_score?: number;
    tissue_score?: number;
    priority_score?: number;
    scoring_breakdown: Record<string, any>;
  } | null;
  assessments?: any[];
  latest_assessment?: any;
}

export interface DoctorDonorDetail {
  id: string;
  donor_code: string;
  name: string;
  age: number;
  gender?: string;
  blood_group: string;
  status: string;
  hla_information?: any;
  medical_details?: Record<string, any>;
  hospital_id?: string;
  hospital?: string;
  hospital_name?: string;
  registered_on?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  organs?: Array<{
    id: string;
    code: string;
    organ_type: string;
    status: string;
  }>;
  assessments?: any[];
  latest_assessment?: any;
}

export interface DoctorMatchProposal {
  id: string;
  match_code: string;
  organ_id: string;
  recipient_id: string;
  donor_id?: string | null;
  donor_code?: string;
  donor_name?: string;
  donor_blood_group?: string;
  organ_type: string;
  organ_code: string;
  recipient_code: string;
  recipient_name: string;
  recipient_blood_group: string;
  recipient_urgency: string;
  recipient_priority: string;
  compatibility_score: number;
  rank: number;
  status: string;
  eligibility?: string;
  blood_compatibility?: string;
  next_action?: string;
  scoring_breakdown: {
    blood?: number;
    medical?: number;
    tissue?: number;
    priority?: number;
    [key: string]: any;
  };
  created_at?: string | null;
  assessments?: any[];
  latest_assessment?: any;
  donor?: {
    id: string;
    code: string;
    name: string;
    age: number;
    gender?: string;
    blood_group: string;
    hla: string;
    medical_details: any;
  };
  organ?: {
    id: string;
    code: string;
    organ_type: string;
    blood_group: string;
    status: string;
    laterality?: string;
    harvest_date?: string | null;
    cold_ischemia_time?: string;
    warm_ischemia_time?: string;
    preservation_method?: string;
    clinical_notes?: string;
    medical_details?: any;
  };
  recipient?: {
    id: string;
    code: string;
    name: string;
    age: number;
    gender?: string;
    blood_group: string;
    required_organ: string;
    hla: string;
    priority: string;
    urgency: string;
    hospital?: string;
    hospital_name?: string;
    registered_on?: string | null;
    condition?: string;
    medical_details?: any;
  };
}

export interface DoctorHistoryItem {
  id: string;
  review_code: string;
  entity_type: string;
  entity_id: string;
  target_code: string;
  target_name: string;
  organ: string;
  blood_group: string;
  decision: string;
  suitability: string;
  risk_level: string;
  recommendation: string;
  clinical_notes: string;
  reviewed_by: string;
  reviewed_at: string;
  created_at: string;
}

