// ============================================================
// LEGALIR — /requests/[id] → /consultations/[id] (PART 25)
// ============================================================
// The case room is the canonical detail surface. This route redirects so
// old links keep working; there is exactly one detail UI.
// ============================================================

import { redirect } from "next/navigation";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/consultations/${encodeURIComponent(id)}`);
}
