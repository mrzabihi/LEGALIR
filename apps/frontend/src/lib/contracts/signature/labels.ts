// ============================================================
// LEGALIR — how a signature state reads INSIDE the document
// ============================================================
// `SIGNATURE_PARTICIPANT_STATUS_FA` is the short label for status
// chips and lists («در انتظار», «مشاهده‌شده»). The signature table on
// the printed sheet is talking about a SIGNATURE PLACE, not a workflow
// state, so anything that is not signed yet reads «در انتظار امضا» —
// the same words the renderer already prints for a role with no mark
// at all. One mapping, shared by the A4 preview and the PDF, so the
// screen and the paper can never word the same cell differently.
// ============================================================

import {
  SIGNATURE_PARTICIPANT_STATUS_FA,
  type SignatureParticipantStatus,
} from "@legalir/types";

/** The «وضعیت امضا» cell text for one participant state. */
export const SIGNATURE_CELL_STATUS_FA: Record<SignatureParticipantStatus, string> = {
  ...SIGNATURE_PARTICIPANT_STATUS_FA,
  PENDING: "در انتظار امضا",
  VIEWED: "در انتظار امضا",
};
