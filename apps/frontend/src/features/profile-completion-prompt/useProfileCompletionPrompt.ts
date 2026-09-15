// ============================================================
// LEGALIR — Profile Completion Prompt Controller
// ============================================================
// A focused, feature-level controller that owns the eligibility
// state machine for the "complete your profile" incentive modal.
//
// Business rule (single source of truth):
//   IF profile is complete            → never show
//   ELSE IF prompt explicitly disabled → never show
//   ELSE                              → show when entering Dashboard
//
// Two distinct user actions that MUST NOT share a state:
//   - انصراف (cancel)        → closes the modal ONLY (no persistence)
//   - دیگر نشان نده (suppress) → persists a per-user preference
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/useDashboard";
import { usePreferences, useUpdatePreferences } from "@/hooks/usePhase11";

export type PromptPhase =
  | "INITIALIZING"
  | "LOADING_USER"
  | "LOADING_PREFERENCES"
  | "EVALUATING"
  | "OPEN"
  | "CLOSED"
  | "NAVIGATE_PROFILE"
  | "SAVING_PREFERENCE"
  | "ERROR";

export interface ProfileCompletionPromptController {
  phase: PromptPhase;
  /** True when the modal should be rendered (OPEN). */
  open: boolean;
  /** True while the controller is still resolving eligibility. */
  loading: boolean;
  /** True while the suppress preference is being persisted. */
  saving: boolean;
  /** True if persisting the suppress preference failed. */
  error: boolean;
  /** Close the modal only — does NOT persist anything. */
  cancel: () => void;
  /** Navigate to the profile page to complete the profile. */
  goToProfile: () => void;
  /** Persist "don't show again" then close. */
  suppress: () => void;
  /** Retry after an error. */
  retry: () => void;
}

const PROFILE_COMPLETE_THRESHOLD = 100;

export function useProfileCompletionPrompt(): ProfileCompletionPromptController {
  const router = useRouter();
  const me = useMe();
  const preferences = usePreferences();
  const updatePreferences = useUpdatePreferences();

  const [phase, setPhase] = useState<PromptPhase>("INITIALIZING");
  const [suppressError, setSuppressError] = useState(false);

  const profile = me.data?.profile;
  const completionPercent = profile?.completionPercent ?? 0;
  const profileComplete = completionPercent >= PROFILE_COMPLETE_THRESHOLD;
  const promptEnabled = preferences.data?.showProfileCompletionPrompt ?? true;

  // Resolve eligibility once the required data is available.
  useEffect(() => {
    if (me.isLoading) {
      setPhase("LOADING_USER");
      return;
    }
    if (preferences.isLoading) {
      setPhase("LOADING_PREFERENCES");
      return;
    }

    // Data is ready — evaluate.
    setPhase("EVALUATING");

    if (profileComplete) {
      setPhase("CLOSED");
      return;
    }
    if (!promptEnabled) {
      setPhase("CLOSED");
      return;
    }

    setPhase("OPEN");
  }, [me.isLoading, preferences.isLoading, profileComplete, promptEnabled]);

  const cancel = useCallback(() => {
    // انصراف — close the modal only. Does NOT change the persistent preference.
    setPhase("CLOSED");
  }, []);

  const goToProfile = useCallback(() => {
    setPhase("NAVIGATE_PROFILE");
    router.push("/profile");
  }, [router]);

  const suppress = useCallback(() => {
    // دیگر نشان نده — persist the per-user preference, then close.
    setPhase("SAVING_PREFERENCE");
    setSuppressError(false);
    updatePreferences.mutate(
      { showProfileCompletionPrompt: false },
      {
        onSuccess: () => {
          setPhase("CLOSED");
        },
        onError: () => {
          setSuppressError(true);
          setPhase("ERROR");
        },
      }
    );
  }, [updatePreferences]);

  const retry = useCallback(() => {
    setSuppressError(false);
    setPhase("OPEN");
  }, []);

  return useMemo(
    () => ({
      phase,
      open: phase === "OPEN",
      loading: phase === "INITIALIZING" || phase === "LOADING_USER" || phase === "LOADING_PREFERENCES" || phase === "EVALUATING",
      saving: phase === "SAVING_PREFERENCE",
      error: suppressError,
      cancel,
      goToProfile,
      suppress,
      retry,
    }),
    [phase, suppressError, cancel, goToProfile, suppress, retry]
  );
}
