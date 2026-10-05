// ============================================================
// LEGALIR — Case access resolution (server-only)
// ============================================================
// Resolves what a caller may do on a specific case. This is the single
// authorization gate for every case route: a route must call
// `resolveCaseAccess` and return 404 when it yields null, so the existence
// of a foreign case is never leaked.
//
// Access is granted by EITHER:
//   • the caller owns the case (legacy `user_id` match), or
//   • the caller holds an ACTIVE `case_members` row for this case.
//
// Membership on one case NEVER grants access to another case. A `pending`
// member (a lawyer awaiting acceptance) sees only a minimal summary and can
// never read documents or private notes.
// ============================================================

import { getCaseById, getActiveCaseMember, type DbCase, type DbCaseMember } from "@/lib/case-db";
import type { CaseMemberRole } from "@legalir/types";

export interface CaseAccess {
  case: DbCase;
  /** The active membership row, when access is via membership (not ownership). */
  member: DbCaseMember | null;
  role: CaseMemberRole;
  isOwner: boolean;
  /** May mutate shared case information (title, stage, tasks, deadlines). */
  canWrite: boolean;
  /** May invite/revoke members and change the owner. */
  canManageMembers: boolean;
  /** May read the case's documents. */
  canReadDocuments: boolean;
  /** May read private notes authored by others. */
  canReadPrivateNotes: boolean;
  /** May be assigned tasks. */
  canBeAssigned: boolean;
}

/**
 * Resolve the caller's access to a case. Returns null when the caller has
 * no access — callers MUST translate null into a 404, never a 403.
 */
export function resolveCaseAccess(userId: string, caseId: string): CaseAccess | null {
  const c = getCaseById(caseId);
  if (!c) return null;

  // Ownership always wins and is independent of any membership row.
  if (c.user_id === userId) {
    return {
      case: c,
      member: null,
      role: "owner",
      isOwner: true,
      canWrite: true,
      canManageMembers: true,
      canReadDocuments: true,
      canReadPrivateNotes: true,
      canBeAssigned: true,
    };
  }

  const member = getActiveCaseMember(caseId, userId);
  if (!member) return null;

  const role = member.role;
  const scopes = member.scopes ?? [];
  const hasScope = (s: string) => scopes.length === 0 || scopes.includes(s);

  switch (role) {
    case "lawyer":
      return {
        case: c,
        member,
        role,
        isOwner: false,
        canWrite: true,
        canManageMembers: false,
        canReadDocuments: hasScope("documents"),
        canReadPrivateNotes: false,
        canBeAssigned: true,
      };
    case "limited":
      return {
        case: c,
        member,
        role,
        isOwner: false,
        // A limited collaborator may only act on explicitly delegated scopes.
        canWrite: scopes.length > 0,
        canManageMembers: false,
        canReadDocuments: hasScope("documents"),
        canReadPrivateNotes: false,
        canBeAssigned: true,
      };
    case "viewer":
      return {
        case: c,
        member,
        role,
        isOwner: false,
        canWrite: false,
        canManageMembers: false,
        canReadDocuments: hasScope("documents"),
        canReadPrivateNotes: false,
        canBeAssigned: false,
      };
    case "pending":
      // Awaiting acceptance — minimal summary only, no documents, no writes.
      return {
        case: c,
        member,
        role,
        isOwner: false,
        canWrite: false,
        canManageMembers: false,
        canReadDocuments: false,
        canReadPrivateNotes: false,
        canBeAssigned: false,
      };
    default:
      return null;
  }
}

/** True when the caller may read a private note authored by `authorUserId`. */
export function canReadPrivateNote(access: CaseAccess, authorUserId: string, viewerUserId: string): boolean {
  if (access.isOwner) return true;
  if (authorUserId === viewerUserId) return true;
  return access.canReadPrivateNotes;
}
