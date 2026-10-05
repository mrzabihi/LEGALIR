// ============================================================
// LEGALIR — Case DTO mappers (server-side)
// ============================================================
// Converts snake_case DB rows into the camelCase API shapes. Kept in one
// place so every route returns the same shape and a field rename touches
// exactly one file.
// ============================================================

import type {
  CaseV2,
  CaseEvent,
  CaseTaskV2,
  CaseDeadlineV2,
  CaseParty,
  CaseMember,
  CaseProceeding,
  LawyerEngagement,
  RepresentationRecord,
  CaseMemberRole,
  CaseEventType,
  CaseTaskStatusV2,
  CaseTaskActionType,
  CaseDeadlineKind,
  CaseDeadlineBasis,
  CaseDeadlineReviewState,
  CaseDeadlineOperationalState,
  CaseLegalRole,
  CaseProceedingPath,
  CaseStageKey,
  CaseInfoSource,
  CaseEventVisibility,
  LawyerEngagementState,
  LawyerEngagementKind,
} from "@legalir/types";
import type {
  DbCase,
  DbCaseTimelineEvent,
  DbCaseTask,
  DbCaseDeadline,
  DbCaseParty,
  DbCaseMember,
  DbCaseProceeding,
  DbLawyerEngagement,
  DbRepresentation,
} from "@/lib/case-db";

export function toCaseV2(row: DbCase, viewerRole: CaseMemberRole): CaseV2 {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    category: row.category as CaseV2["category"],
    status: row.status as CaseV2["status"],
    priority: row.priority as CaseV2["priority"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    internalRef: row.internal_ref ?? "",
    lifecycle: row.lifecycle ?? "ACTIVE",
    version: row.version ?? 1,
    viewerRole,
  };
}

export function toEvent(row: DbCaseTimelineEvent): CaseEvent {
  return {
    id: row.id,
    caseId: row.case_id,
    proceedingId: row.proceeding_id ?? null,
    eventType: row.event_type as CaseEventType,
    title: row.title,
    description: row.description,
    occurredAt: row.occurred_at ?? row.created_at,
    recordedAt: row.recorded_at ?? row.created_at,
    recordedByUserId: row.recorded_by_user_id ?? "",
    source: (row.source ?? "user") as CaseInfoSource,
    visibility: (row.visibility ?? "shared") as CaseEventVisibility,
    documentId: row.document_id ?? null,
    taskId: row.task_id ?? null,
    deadlineId: row.deadline_id ?? null,
    contractId: row.contract_id ?? null,
    correlationId: row.correlation_id ?? null,
    metadata: row.metadata ?? {},
  };
}

export function toTaskV2(row: DbCaseTask): CaseTaskV2 {
  return {
    id: row.id,
    caseId: row.case_id,
    proceedingId: row.proceeding_id ?? null,
    stageKey: (row.stage_key ?? null) as CaseStageKey | null,
    title: row.title,
    description: row.description,
    actionType: (row.action_type ?? "general") as CaseTaskActionType,
    status: row.status as CaseTaskStatusV2,
    priority: row.priority as CaseTaskV2["priority"],
    assigneeUserId: row.assignee_user_id ?? null,
    createdByUserId: row.created_by_user_id ?? "",
    dueDate: row.due_date,
    dependsOn: row.depends_on ?? [],
    checklist: row.checklist ?? [],
    result: row.result ?? null,
    resultIsClaim: row.result_is_claim ?? false,
    documentIds: row.document_ids ?? [],
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toDeadlineV2(row: DbCaseDeadline): CaseDeadlineV2 {
  return {
    id: row.id,
    caseId: row.case_id,
    proceedingId: row.proceeding_id ?? null,
    kind: (row.kind ?? "legal") as CaseDeadlineKind,
    title: row.title,
    dueAt: row.due_at,
    dateOnly: row.date_only ?? true,
    basis: (row.basis ?? "manual") as CaseDeadlineBasis,
    reviewState: (row.review_state ?? "user_entered") as CaseDeadlineReviewState,
    operationalState: (row.operational_state ?? "open") as CaseDeadlineOperationalState,
    ruleRef: row.rule_ref ?? null,
    sourceDocumentId: row.source_document_id ?? null,
    reviewedByUserId: row.reviewed_by_user_id ?? null,
    reviewedAt: row.reviewed_at ?? null,
    overrideReason: row.override_reason ?? null,
    announcedDueAt: row.announced_due_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

export function toParty(row: DbCaseParty): CaseParty {
  return {
    id: row.id,
    caseId: row.case_id,
    proceedingId: row.proceeding_id,
    kind: row.kind,
    name: row.name,
    legalRole: row.legal_role as CaseLegalRole,
    nationalId: row.national_id,
    phone: row.phone,
    accountId: row.account_id,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function toMember(row: DbCaseMember): CaseMember {
  return {
    id: row.id,
    caseId: row.case_id,
    accountId: row.account_id,
    role: row.role,
    scopes: row.scopes ?? [],
    status: row.status,
    grantedAt: row.granted_at,
    grantedByUserId: row.granted_by_user_id,
    revokedAt: row.revoked_at,
  };
}

export function toProceeding(row: DbCaseProceeding): CaseProceeding {
  return {
    id: row.id,
    caseId: row.case_id,
    path: row.path as CaseProceedingPath,
    stage: row.stage as CaseStageKey,
    templateVersion: row.template_version,
    authority: row.authority,
    province: row.province,
    city: row.city,
    branch: row.branch,
    judicialNumber: row.judicial_number,
    archiveNumber: row.archive_number,
    trackingCode: row.tracking_code,
    judgmentId: row.judgment_id,
    filedAt: row.filed_at,
    stageSource: row.stage_source as CaseInfoSource,
    stageRecordedAt: row.stage_recorded_at,
    parentProceedingId: row.parent_proceeding_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toEngagement(row: DbLawyerEngagement): LawyerEngagement {
  return {
    id: row.id,
    caseId: row.case_id,
    lawyerProfileId: row.lawyer_profile_id,
    lawyerUserId: row.lawyer_user_id,
    kind: row.kind as LawyerEngagementKind,
    state: row.state as LawyerEngagementState,
    sharedScopes: row.shared_scopes ?? [],
    ownerConsentAt: row.owner_consent_at,
    requestedByUserId: row.requested_by_user_id,
    requestedAt: row.requested_at,
    respondedAt: row.responded_at,
    note: row.note,
  };
}

export function toRepresentation(row: DbRepresentation): RepresentationRecord {
  return {
    id: row.id,
    caseId: row.case_id,
    lawyerProfileId: row.lawyer_profile_id,
    lawyerUserId: row.lawyer_user_id,
    documentType: row.document_type,
    documentId: row.document_id,
    referenceNumber: row.reference_number,
    issuedAt: row.issued_at,
    coveredProceedingIds: row.covered_proceeding_ids ?? [],
    authorityLimits: row.authority_limits,
    validUntil: row.valid_until,
    terminatedAt: row.terminated_at,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
