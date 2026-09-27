// ============================================================
// LEGALIR — /requests → /consultations (PART 25)
// ============================================================
// The consultation workflow is the canonical surface for legal requests.
// This route is kept only as a redirect so old links and bookmarks keep
// working; there is exactly one list UI.
// ============================================================

import { redirect } from "next/navigation";

export default function RequestsPage() {
  redirect("/consultations");
}
