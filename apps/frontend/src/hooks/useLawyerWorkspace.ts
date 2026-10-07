// ============================================================
// LEGALIR — Lawyer Workspace React Query Hook (PART 24)
// ============================================================
// The workspace is derived server-side from real events, so it is a
// plain query. A 403 (non-lawyer) is surfaced as an error the page turns
// into an onboarding prompt — it is not retried.
// ============================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchLawyerWorkspace, setMyLawyerAvatar } from "@/lib/api/v1";

export function useLawyerWorkspace() {
  return useQuery({
    queryKey: ["lawyer", "workspace"],
    queryFn: fetchLawyerWorkspace,
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * Change the signed-in lawyer's OWN professional portrait. The write targets
 * the same profile row the admin panel edits, so — after the workspace and the
 * public `["lawyers"]` keys are invalidated — the new portrait shows on the
 * marketplace card, the profile and every consultation surface.
 */
export function useSetMyLawyerAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      avatarUrl?: string | null;
      avatarType?: "demo" | "real";
      regenerate?: boolean;
      avatarData?: string;
      avatarFileName?: string;
      avatarFormat?: string;
    }) => setMyLawyerAvatar(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["lawyer", "workspace"] });
      void qc.invalidateQueries({ queryKey: ["lawyers"] });
    },
  });
}
