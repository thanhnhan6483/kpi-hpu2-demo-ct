export interface User {
  id: string;
  username: string;
  password: string;
  fullName: string;
  email: string;
  employeeCode: string;
  unitId: string;
  positionId: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
}

export interface UserRole {
  userId: string;
  roleId: string;
  scopeUnitId?: string;
}

export interface OrganizationalUnit {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  type: 'university' | 'faculty' | 'department' | 'center' | 'division' | 'research';
  managerId: string;
  status: 'active' | 'inactive';
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'inactive';
}

export interface KPICycle {
  id: string;
  academicYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'paused' | 'locked';
  registrationDeadline?: string;
  approvalDeadline?: string;
  progressDeadline?: string;
  selfEvalDeadline?: string;
  managerEvalDeadline?: string;
  councilReviewDeadline?: string;
  complaintDeadline?: string;
  lockDeadline?: string;
}

export interface KPIGroup {
  id: string;
  academicYearId?: string;
  name: string;
  code: string;
  defaultWeight: number;
  targetLevel: 'school' | 'unit' | 'individual';
}

export interface KPIIndicator {
  id: string;
  academicYearId?: string;
  code: string;
  name: string;
  categoryId: string;
  formula: string;
  unit: string;
  direction: 'higher_better' | 'lower_better';
  requiredEvidence: boolean;
  maxScore: number;
  targetValue: number;
  weight: number;
}

export interface KPITemplate {
  id: string;
  name: string;
  targetRole: string;
  targetLevel: string;
  indicatorCount?: number;
  totalWeight?: number;
  status: 'draft' | 'submitted' | 'approved' | 'active' | 'locked';
}

export interface KPITemplateItem {
  id: string;
  templateId: string;
  indicatorId: string;
  weight: number;
  targetValue: number;
  capRate: number;
}

export interface KPIPlan {
  id: string;
  cycleId: string;
  ownerType: 'unit' | 'individual';
  ownerId: string;
  status: 'draft' | 'submitted' | 'approved' | 'in_progress' | 'evaluated' | 'locked';
  submittedAt?: string;
  approvedAt?: string;
}

export interface PlanItemSubTask {
  id: string;
  name: string;
  owner: string;
  dueDate: string;
  evidence: string;
  ratio: number | null;
  status: 'ĐẠT' | 'CHƯA ĐẠT';
}

export interface KPIPlanItem {
  id: string;
  indicatorId: string | null;
  name?: string;
  targetValue: number;
  weight: number;
  dueDate: string;
  children?: PlanItemSubTask[];
}

export interface KPIProgress {
  id: string;
  planItemId: string;
  actualValue: number;
  progressDate: string;
  note: string;
  updatedBy: string;
}

export interface KPIEvidence {
  id: string;
  planItemId: string;
  planItemIds?: string[];
  evidenceType: 'file' | 'url' | 'system_log' | 'survey' | 'email';
  fileUrl?: string;
  externalUrl?: string;
  fileName?: string;
  status: 'pending' | 'submitted' | 'needs_supplement' | 'valid' | 'invalid' | 'locked';
  reviewerNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface KPIEvaluation {
  id: string;
  evaluatorId: string;
  evaluationType: 'self' | 'manager' | 'council';
  score: number;
  comment: string;
  status: 'pending' | 'submitted' | 'approved';
  level?: 'unit' | 'individual';
  personId?: string;
  personName?: string;
  positionCode?: string;
  personUnitId?: string;
}

export interface KPIScore {
  id: string;
  planItemId: string;
  selfScore: number;
  managerScore: number;
  councilScore: number;
  finalScore: number;
}

export interface KPIApproval {
  id: string;
  objectType: 'plan' | 'evidence' | 'evaluation';
  objectId: string;
  approverId: string;
  action: 'approve' | 'reject' | 'request_revision';
  note: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  content: string;
  readStatus: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  objectType: string;
  objectId: string;
  ipAddress: string;
  createdAt: string;
}

export type PlanStatus = 'draft' | 'submitted' | 'needs_revision' | 'approved' | 'in_progress' | 'submitted_result' | 'confirmed' | 'evaluated' | 'locked';

export type EvidenceStatus = 'pending' | 'submitted' | 'needs_supplement' | 'valid' | 'invalid' | 'locked';

export type EvaluationType = 'self' | 'manager' | 'council';

export type GradeLevel = 'xuat_sac' | 'tot' | 'dat' | 'can_cai_thien' | 'khong_dat';

export interface IndividualPlan {
  id: string;
  userId: string;
  cycleId: string;
  positionId: string;
  positionName: string;
  status: 'draft' | 'submitted' | 'approved' | 'committed' | 'in_progress';
  submittedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KHCTTask {
  id: string;
  month: string;
  field: string;
  order: number;
  taskName: string;
  responsibleUnit: string;
  coordinatingUnits: string;
  kpiCodes: string;
  deliverable: string;
  chiTieu?: string;
  deadline: string;
  softwareId?: string;
  taskResult?: string;
  taskStatus?: 'not_started' | 'in_progress' | 'done';
  taskReviewNote?: string;
  resultSource?: 'manual' | 'sync';
  syncInfo?: { sourceId: string; sourceName: string; syncedAt: string };
  status: 'active' | 'inactive';
}

// ====== NEW TYPES FOR MISSING USE CASES ======

export interface DataSource {
  id: string;
  name: string;
  code: string;
  description: string;
  responsibleUnitId: string;
  sourceType: 'api' | 'manual' | 'integrated';
  config: Record<string, string>;
  status: 'active' | 'inactive';
}

export interface KPIStatus {
  id: string;
  name: string;
  code: string;
  description: string;
  color: string;
  sortOrder: number;
  category: 'plan' | 'evaluation' | 'evidence' | 'template';
}

export interface KPIFormula {
  id: string;
  name: string;
  code: string;
  description: string;
  expression: string;
  variables: { name: string; label: string; source: string }[];
  type: 'quantitative' | 'qualitative' | 'rubric';
  status: 'active' | 'inactive';
}

export interface WarningThreshold {
  id: string;
  name: string;
  code: string;
  description: string;
  thresholdType: 'deadline_days' | 'completion_percent' | 'evidence_count' | 'score_gap';
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
  value: number;
  color: string;
  icon: string;
  isSystem: boolean;
  status: 'active' | 'inactive';
}

export interface ReportTemplate {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  config: {
    sections: { title: string; fields: string[] }[];
    filters: { key: string; label: string; type: string; options?: string[] }[];
    format: 'excel' | 'pdf' | 'csv' | 'word';
  };
  isSystem: boolean;
  status: 'active' | 'inactive';
}

export interface TargetGroup {
  id: string;
  name: string;
  code: string;
  description: string;
  level: 'school' | 'unit' | 'department' | 'individual';
  positionIds: string[];
  kpiTemplateId: string;
  status: 'active' | 'inactive';
}

export interface Rubric {
  id: string;
  name: string;
  code: string;
  description: string;
  indicatorId?: string;
  criteria: RubricCriterion[];
  status: 'active' | 'inactive';
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  levels: RubricLevel[];
}

export interface RubricLevel {
  id: string;
  name: string;
  score: number;
  description: string;
}

export interface KPIComplaint {
  id: string;
  cycleId: string;
  objectType: 'individual_evaluation' | 'unit_evaluation' | 'score';
  objectId: string;
  complainantId: string;
  complainantName: string;
  content: string;
  attachments: string[];
  status: 'pending' | 'under_review' | 'accepted' | 'rejected' | 'supplement_needed';
  reviewerId?: string;
  reviewNote?: string;
  reviewedAt?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanVersion {
  id: string;
  planId: string;
  version: number;
  data: Record<string, unknown>;
  changedBy: string;
  changeType: 'create' | 'update' | 'submit' | 'approve' | 'revision' | 'lock' | 'unlock';
  note: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  description: string;
  category: 'bug' | 'feature_request' | 'question' | 'data_issue' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  attachments: string[];
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assigneeId?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface APIConfig {
  id: string;
  name: string;
  code: string;
  description: string;
  baseUrl: string;
  apiKey: string;
  authType: 'api_key' | 'basic' | 'oauth2' | 'none';
  username?: string;
  password?: string;
  systemType: 'hrm' | 'lms' | 'eoffice' | 'khcn' | 'finance' | 'survey' | 'other';
  syncInterval: 'manual' | 'daily' | 'weekly' | 'monthly';
  lastSyncAt?: string;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastError?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface SyncLog {
  id: string;
  apiConfigId: string;
  systemType: string;
  syncType: 'manual' | 'scheduled';
  status: 'running' | 'success' | 'partial' | 'error';
  startedAt: string;
  completedAt?: string;
  recordsTotal: number;
  recordsSuccess: number;
  recordsFailed: number;
  errors: { record: string; message: string }[];
  createdBy: string;
}

export interface SLAConfig {
  id: string;
  name: string;
  processType: 'registration' | 'approval' | 'evidence_review' | 'evaluation' | 'complaint' | 'council_review';
  targetHours: number;
  warningHours: number;
  escalationUserId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardWidgetConfig {
  id: string;
  userId: string;
  widgetKey: string;
  widgetType: 'chart' | 'table' | 'stat' | 'alert' | 'progress' | 'calendar';
  title: string;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledReport {
  id: string;
  name: string;
  reportTemplateId: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semester' | 'yearly';
  config: Record<string, unknown>;
  recipients: string[];
  lastSentAt?: string;
  nextSendAt?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BSCPerspective {
  id: string;
  name: string;
  code: string;
  description: string;
  sortOrder: number;
  color: string;
  status: 'active' | 'inactive';
}

export interface BSCMapLink {
  id: string;
  perspectiveId: string;
  objectiveId: string;
  indicatorId?: string;
  linkType: 'perspective_to_objective' | 'objective_to_indicator';
  weight: number;
  createdAt: string;
}

export interface UnlockRequest {
  id: string;
  objectType: 'cycle' | 'evaluation' | 'score' | 'evidence';
  objectId: string;
  requestedBy: string;
  reason: string;
  scope: string;
  durationHours: number;
  approvedBy?: string;
  approvedAt?: string;
  status: 'pending' | 'approved' | 'rejected';
  note?: string;
  createdAt: string;
}

export interface IndividualPlanItem {
  kpiId: string;
  kpiName: string;
  target: number;
  unit: string;
  weight: number;
  note: string;
}

export interface UnitKPIDetail {
  id: string;
  name: string;
  target: number;
  unit: string;
  weight: number;
  indicatorId: string | null;
}

export interface UnitKPIEntry {
  id: string;
  academicYearId?: string;
  name: string;
  code: string;
  type: string;
  level: string;
  description: string;
  kpiCount: number;
  kpis: UnitKPIDetail[];
}

export interface IndividualKPIDetail {
  id: string;
  name: string;
  target: number;
  unit: string;
  weight: number;
  unitKpiId?: string | null;
}

export interface IndividualKPIEntry {
  id: string;
  academicYearId?: string;
  name: string;
  code: string;
  kpis: IndividualKPIDetail[];
}

export interface Position {
  id: string;
  name: string;
  code: string;
  level: string;
  category: string;
  status: 'active' | 'inactive';
}

export interface JobPosition {
  id: string;
  name: string;
  code: string;
  description: string;
  kpiGroupId: string;
  approvalLevel: string;
  status: 'active' | 'inactive';
}

export interface StrategicObjective {
  id: string;
  name: string;
  description: string;
  field: string;
  leadUnitId: string;
  supportUnitIds: string[];
  status: 'draft' | 'submitted' | 'approved' | 'locked';
  createdAt: string;
  updatedAt: string;
}

// Master catalog types (independent of academic year)
export interface SchoolKPICatalog {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  strategicObjectiveId?: string;
  formula: string;
  unitId: string;
  direction: 'higher_better' | 'lower_better';
  requiredEvidence: boolean;
  maxScore: number;
  status: 'active' | 'inactive';
  target?: string;
  cycle?: string;
}

export interface KPIGroupCatalog {
  id: string;
  code: string;
  name: string;
  defaultWeight: number;
  targetLevel: 'school' | 'unit' | 'individual';
  status: 'active' | 'inactive';
}

export interface UnitKPICatalog {
  id: string;
  code: string;
  name: string;
  unitId: string;
  orgUnitId?: string;
  linkedCatalogId: string | null;
  target?: string;
  cycle?: string;
  status: 'active' | 'inactive';
}

export interface IndividualKPICatalog {
  id: string;
  code: string;
  name: string;
  positionCode: string;
  unitId: string;
  linkedCatalogId: string | null;
  target?: string;
  cycle?: string;
  status: 'active' | 'inactive';
}

export interface KPICascadeAssignment {
  id: string;
  cycleId: string;
  fromLevel: 'school' | 'unit' | 'department';
  fromUnitId: string;
  toLevel: 'unit' | 'department' | 'individual';
  toUnitId: string;
  toUserId?: string;
  indicatorId: string;
  indicatorName: string;
  targetValue: number;
  unit: string;
  weight: number;
  dueDate: string;
  evidenceRequired: boolean;
  note: string;
  status: 'draft' | 'assigned' | 'accepted' | 'rejected' | 'in_progress';
  assignerId: string;
  assignedAt?: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UnitWorkTask {
  id: string;
  khctTaskId: string;
  taskName: string;
  unitId: string;
  unitName: string;
  title: string;
  primaryUserId: string;
  primaryUserName: string;
  chiTieu?: string;
  result?: string;
  resultSource?: 'manual' | 'sync';
  syncInfo?: { sourceId: string; sourceName: string; syncedAt: string };
  reportNote?: string;
  progress?: number;
  assessment?: string;
  reviewNote?: string;
  dueDate: string;
  note: string;
  status: 'assigned' | 'in_progress' | 'done';
  createdAt: string;
  updatedAt: string;
}

export interface UnitWorkReportSubTask {
  title: string;
  chiTieu: string;
  result: string;
  status: string;
  assessment: string;
  dueDate: string;
}

export interface UnitWorkReportRow {
  khctTaskId: string;
  taskName: string;
  responsibleUnit: string;
  kpiCodes: string;
  chiTieu: string;
  deliverable: string;
  deadline: string;
  status: 'done' | 'in_progress' | 'not_started';
  statusLabel: string;
  taskResult: string;
  taskReviewNote?: string;
  resultSource?: 'manual' | 'sync';
  syncInfo?: { sourceId: string; sourceName: string; syncedAt: string };
  evidenceNames?: string[];
  doneSub: number;
  totalSub: number;
  subTasks?: UnitWorkReportSubTask[];
}

export interface UnitWorkReport {
  id: string;
  month: string;
  unitFilterName: string;
  unitIds: string[];
  createdAt: string;
  rows: UnitWorkReportRow[];
  summary: {
    totalTasks: number;
    doneTasks: number;
    inProgressTasks: number;
    notStartedTasks: number;
    totalSub: number;
    doneSub: number;
    completionRate: number;
  };
}
