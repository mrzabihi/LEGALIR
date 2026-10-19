// ============================================================
// LEGALIR — GET / POST /api/v1/judicial/requests/[id]/attachments
// ============================================================
// Alias of the canonical document-linking route. There is exactly ONE
// implementation of "list the picker / link one of my documents" — this file
// only names the resource by its role in the wizard (an attachment) rather
// than by the source table (a document).
//
// New callers should prefer `.../[id]/documents`, which also returns the
// picker's available documents. This alias exists so a client written against
// the "attachments" vocabulary cannot drift into a second implementation.
// ============================================================

export { GET, POST } from "../documents/route";
