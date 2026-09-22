"use client";

// ============================================================
// LEGALIR — Onboarding Router
// ============================================================
// The single entry point after registration. It asks the server for the
// onboarding decision and routes on `nextStep` — the client never guesses
// the step from a query string. This makes refresh and deep links safe.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/hooks/useOnboarding";

const NEXT_STEP_ROUTE: Record<string, string> = {
  PERSONAL_PROFILE: "/auth/profile",
  ORGANIZATION: "/onboarding/organization",
  LAWYER: "/onboarding/lawyer",
  DASHBOARD: "/dashboard",
};

export default function OnboardingRouterPage() {
  const router = useRouter();
  const { data, isLoading, isError } = useOnboarding();

  useEffect(() => {
    if (isLoading) return;
    if (isError || !data) {
      // Fail safe: never trap the user on a blank screen.
      router.replace("/dashboard");
      return;
    }
    router.replace(NEXT_STEP_ROUTE[data.nextStep] ?? "/dashboard");
  }, [data, isLoading, isError, router]);

  return (
    <div className="rounded-large bg-neutral-0/95 backdrop-blur-sm p-10 shadow-elevation-8 border border-neutral-200/50 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-700/10 mb-4">
        <svg className="animate-spin h-6 w-6 text-primary-700" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
      <h1 className="text-h3 text-neutral-900 font-bold mb-1">در حال آماده‌سازی حساب شما…</h1>
      <p className="text-body-2 text-neutral-500">لطفاً چند لحظه صبر کنید</p>
    </div>
  );
}
