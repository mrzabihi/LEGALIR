"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TextField } from "@legalir/ui";
import { useRequestOtp } from "@/lib/auth/use-auth";
import { normalizeMobile } from "@/lib/auth/api";
import { useAuthStore } from "@/stores/auth-store";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { requestOtp, isPending, error: apiError } = useRequestOtp();
  const setIntendedRoute = useAuthStore((s) => s.setIntendedRoute);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [mobile, setMobile] = useState("");
  const [validationError, setValidationError] = useState("");

  // Capture intent from query params on mount
  useEffect(() => {
    const intent = searchParams.get("intent");
    if (intent) {
      setIntendedRoute(intent);
    }
  }, [searchParams, setIntendedRoute]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow Persian digits, +, digits, and whitespace; strip everything else
    const cleaned = raw.replace(/[^\d۰-۹٠-٩\s+()-]/g, "");
    setMobile(cleaned);
    setValidationError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    // Validate before submission
    const normalized = normalizeMobile(mobile);
    if (!normalized) {
      setValidationError("شماره موبایل معتبر نیست. لطفاً با ۰۹ وارد کنید");
      return;
    }

    const result = await requestOtp(mobile);
    if (result) {
      // Navigate to verify with challenge info in query params
      const params = new URLSearchParams();
      params.set("mobile", normalized);
      params.set("challengeId", result.challengeId);
      params.set("expiresAt", result.expiresAt);
      params.set("remainingAttempts", String(result.remainingAttempts));
      params.set("cooldown", String(result.resendCooldownSeconds));
      router.push(`/auth/verify?${params.toString()}`);
    }
  };

  const displayError = validationError || apiError;
  const normalized = normalizeMobile(mobile);
  const isValidMobile = normalized !== null;

  return (
    <div className="rounded-xl bg-surface border border-neutral-200 shadow-sm p-8">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          id="mobile"
          name="mobile"
          label="شماره موبایل"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={mobile}
          onChange={handleMobileChange}
          errorMessage={displayError || undefined}
          fullWidth
          inputDir="ltr"
          disabled={isPending}
          autoFocus
        />

        <button
          type="submit"
          disabled={!isValidMobile || isPending}
          className="w-full rounded-medium bg-primary-700 text-white py-3 text-button hover:bg-primary-800 transition-colors touch-target disabled:opacity-50 disabled:cursor-not-allowed shadow-elevation-1"
        >
          {isPending ? "در حال ارسال..." : "ارسال کد تأیید"}
        </button>

        {isPending && (
          <p className="text-body-2 text-neutral-500 text-center" aria-live="polite">
            در حال ارسال کد تأیید...
          </p>
        )}
      </form>
    </div>
  );
}
