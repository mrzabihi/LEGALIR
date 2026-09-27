// ============================================================
// LEGALIR — Consultation case room projection (server-only)
// ============================================================
// Assembles the case-room payload from real rows:
//
//   request     ← legal_requests
//   events      ← legal_request_events (the auditable state history)
//   lawyer      ← lawyer_profiles (via toLawyerDetail)
//   messages    ← message_threads + secure_messages
//   attachments ← documents (metadata only; bytes stream separately)
//
// The viewer is either the client (the request owner) or the assigned
// lawyer. `viewerRole` is decided here, server-side, so the UI never has
// to guess which actions to show. Sender names are resolved from profiles
// — a raw user id is never returned to the client.
// ============================================================

import { getProfile, readTable } from "./db";
import { getLawyerProfileById, toLawyerDetail } from "./lawyer-db";
import { listRequestEvents } from "./legal-request-db";
import { getThreadByRequestId, listMessages } from "./consultation-message-db";
import type {
  ConsultationAttachmentView,
  ConsultationDetail,
  ConsultationMessageView,
  ConsultationViewerRole,
  LegalRequest,
  V1DocumentDetail,
} from "@legalir/types";

/** The client's display name, falling back to a neutral label. */
function displayName(userId: string): string {
  const name = getProfile(userId).displayName?.trim();
  return name && name.length > 0 ? name : "کاربر لگالیر";
}

/** The lawyer's display name for a message they sent. */
function lawyerDisplayName(lawyerId: string): string {
  const profile = getLawyerProfileById(lawyerId);
  return profile?.fullName ?? "وکیل";
}

/**
 * Resolve a message sender's display name. A lawyer's name comes from
 * their professional profile; the client's from their account profile.
 */
function senderName(senderUserId: string, lawyerUserId: string | null): string {
  if (lawyerUserId && senderUserId === lawyerUserId) {
    return lawyerDisplayName(senderUserId);
  }
  return displayName(senderUserId);
}

/** Attachment metadata for the documents linked to a request. */
function buildAttachments(request: LegalRequest): ConsultationAttachmentView[] {
  const ids = request.attachmentDocumentIds ?? [];
  if (ids.length === 0) return [];
  const docs = readTable<V1DocumentDetail>("documents");
  return ids
    .map((id) => docs.find((d) => d.id === id))
    .filter((d): d is V1DocumentDetail => Boolean(d))
    .map((d) => ({
      id: d.id,
      name: d.name,
      mime: d.mime,
      sizeBytes: d.sizeBytes,
      createdAt: d.createdAt,
    }));
}

/**
 * Build the case-room payload for `request` as seen by `viewerUserId`.
 * The caller must have already authorized the viewer (owner or assigned
 * lawyer) — this function assumes access and only decides the role.
 */
export function buildConsultationDetail(
  request: LegalRequest,
  viewerUserId: string
): ConsultationDetail {
  const lawyerProfile = request.selectedLawyerId
    ? getLawyerProfileById(request.selectedLawyerId)
    : undefined;
  const lawyerUserId = lawyerProfile?.userId ?? null;

  const viewerRole: ConsultationViewerRole =
    lawyerUserId && viewerUserId === lawyerUserId ? "lawyer" : "client";

  const thread = getThreadByRequestId(request.id);
  const messages: ConsultationMessageView[] = thread
    ? listMessages(thread.id).map((m) => ({
        id: m.id,
        senderName: senderName(m.senderUserId, lawyerUserId),
        senderRole: m.senderRole,
        isMine: m.senderUserId === viewerUserId,
        body: m.body,
        attachments: m.attachments,
        readAt: m.readAt,
        createdAt: m.createdAt,
      }))
    : [];

  return {
    request,
    events: listRequestEvents(request.id),
    viewerRole,
    lawyer: lawyerProfile ? toLawyerDetail(lawyerProfile) : null,
    messages,
    attachments: buildAttachments(request),
    method: "secure_text",
  };
}

/**
 * True when `userId` may read this request: the owner, or the lawyer the
 * request is assigned to. Used by every case-scoped route so the rule
 * lives in one place.
 */
export function canViewConsultation(request: LegalRequest, userId: string): boolean {
  if (request.userId === userId) return true;
  if (!request.selectedLawyerId) return false;
  const profile = getLawyerProfileById(request.selectedLawyerId);
  return Boolean(profile && profile.userId === userId);
}
