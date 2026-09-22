// ============================================================
// LEGALIR — Lawyer Workspace React Query Hook (PART 24)
// ============================================================
// The workspace is derived server-side from real events, so it is a
// plain query. A 403 (non-lawyer) is surfaced as an error the page turns
// into an onboarding prompt — it is not retried.
// ============================================================

import { useQuery } from "@tanstack/react-query";
import { fetchLawyerWorkspace } from "@/lib/api/v1";

export function useLawyerWorkspace() {
  return useQuery({
    queryKey: ["lawyer", "workspace"],
    queryFn: fetchLawyerWorkspace,
    staleTime: 30_000,
    retry: false,
  });
}
