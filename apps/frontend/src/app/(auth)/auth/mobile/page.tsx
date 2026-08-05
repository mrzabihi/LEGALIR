"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequestOtp } from "@/lib/auth/use-auth";
import { normalizeMobile } from "@/lib/auth/api";
import { useAuthStore } from "@/stores/auth-store";

export default function MobileLoginPage() {
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
    <div className="rounded-large bg-surface p-8 shadow-elevation-4">
      <h1 className="text-h3 text-on-surface mb-2 text-center">ورود به LEGALIR</h1>
      <p className="text-body-2 text-muted mb-6 text-center">
        شماره موبایل خود را وارد کنید
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="mobile" className="block text-body-2 text-on-surface mb-1">
            شماره موبایل
          </label>
          <input
            id="mobile"
            name="mobile"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={mobile}
            onChange={handleMobileChange}
            placeholder="۰۹xxxxxxxxx"
            aria-describedby={displayError ? "mobile-error" : undefined}
            aria-invalid={!!displayError}
            className="w-full rounded-medium border border-border bg-background px-4 py-3 text-body-1 text-on-surface placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary text-left dir-ltr"
            dir="ltr"
            disabled={isPending}
            autoFocus
          />
        </div>

        {displayError && (
          <p id="mobile-error" className="text-body-2 text-error" role="alert">
            {displayError}
          </p>
        )}

        <button
          type="submit"
          disabled={!isValidMobile || isPending}
          className="w-full rounded-medium bg-primary text-white py-3 text-button hover:bg-primary-variant transition-colors touch-target disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "در حال ارسال..." : "ارسال کد تأیید"}
        </button>

        {isPending && (
          <p className="text-body-2 text-muted text-center" aria-live="polite">
            در حال ارسال کد تأیید...
          </p>
        )}

        <p className="text-caption text-muted text-center mt-4">
          با ورود، شرایط استفاده و حریم خصوصی را می‌پذیرم
        </p>
      </form>
    </div>
  );
}
