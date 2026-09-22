"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVerifyOtp, useRequestOtp } from "@/lib/auth/use-auth";
import { useAuthStore } from "@/stores/auth-store";
import { OTPInput } from "@legalir/ui";

const DIGIT_COUNT = 6;

function OtpVerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const mobile = searchParams.get("mobile") ?? "";
  const challengeId = searchParams.get("challengeId") ?? "";
  const expiresAtParam = searchParams.get("expiresAt") ?? "";
  const _initialAttempts = Number(searchParams.get("remainingAttempts") ?? "5");
  const cooldownSeconds = Number(searchParams.get("cooldown") ?? "60");

  const { verifyOtp, isPending: isVerifying, error: verifyError } = useVerifyOtp();
  const { requestOtp, isPending: isRequesting, error: requestError } = useRequestOtp();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [digits, setDigits] = useState<string[]>(Array(DIGIT_COUNT).fill(""));
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(false);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calculate initial countdown from expiresAt
  const initialCountdown = Math.max(0, Math.floor((new Date(expiresAtParam).getTime() - Date.now()) / 1000));

  // Start countdown on mount
  useEffect(() => {
    if (initialCountdown > 0) {
      setCountdown(initialCountdown);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCanResend(true);
    }

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [initialCountdown]);

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  // Get the current code string from digits
  const getCode = useCallback((newDigits: string[]) => {
    return newDigits.join("");
  }, []);

  // Handle auto-verify when all digits filled
  useEffect(() => {
    const code = getCode(digits);
    if (code.length === DIGIT_COUNT && !isVerifying && challengeId) {
      verifyOtp(challengeId, code);
    }
  }, [digits, challengeId, isVerifying, verifyOtp, getCode]);

  // Resend OTP
  const handleResend = useCallback(async () => {
    if (!mobile || isRequesting) return;

    const result = await requestOtp(mobile);
    if (result) {
      // Reset state for new challenge
      setDigits(Array(DIGIT_COUNT).fill(""));
      setCountdown(cooldownSeconds);
      setCanResend(false);

      // Update URL with new challenge (smooth, no full navigation)
      const params = new URLSearchParams();
      params.set("mobile", mobile);
      params.set("challengeId", result.challengeId);
      params.set("expiresAt", result.expiresAt);
      params.set("remainingAttempts", String(result.remainingAttempts));
      params.set("cooldown", String(result.resendCooldownSeconds));
      router.replace(`/auth/verify?${params.toString()}`);

      // Restart countdown
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [mobile, isRequesting, requestOtp, cooldownSeconds, router]);

  // Edit mobile number
  const handleEditMobile = useCallback(() => {
    router.push("/auth/mobile");
  }, [router]);

  const displayError = verifyError || requestError;
  const isLocked = displayError?.includes("بیش از حد");

  return (
    <div className="rounded-2xl bg-white p-8 md:p-10 shadow-2xl border border-neutral-100">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-h2 text-primary-900 mb-2">تأیید کد یکبار مصرف</h1>
        <p className="text-body-2 text-neutral-500">
          کد ۶ رقمی ارسال‌شده به شماره زیر را وارد کنید
        </p>
      </div>

      {/* Mobile display with edit */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="flex items-center gap-2 bg-neutral-100 rounded-medium px-4 py-2">
          <span className="text-body-2 text-neutral-700 font-medium dir-ltr">{mobile}</span>
        </div>
        <button
          type="button"
          onClick={handleEditMobile}
          className="text-caption text-primary-700 font-medium underline underline-offset-2 hover:text-primary-800 transition-colors touch-target-min"
          aria-label="ویرایش شماره موبایل"
        >
          ویرایش
        </button>
      </div>

      <div className="space-y-6">
        {/* OTP Digit Inputs */}
        <div className="flex justify-center">
          <OTPInput
            length={DIGIT_COUNT}
            value={getCode(digits)}
            onChange={(next) => setDigits(next.padEnd(DIGIT_COUNT, " ").slice(0, DIGIT_COUNT).split("").map((c) => (c === " " ? "" : c)))}
            disabled={isVerifying || isLocked}
            hasError={Boolean(displayError)}
          />
        </div>

        {/* Loading states */}
        {isVerifying && (
          <div className="flex items-center justify-center gap-2 text-body-2 text-neutral-500" aria-live="polite">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>در حال بررسی کد...</span>
          </div>
        )}

        {/* Error Message */}
        {displayError && (
          <div
            id="otp-error"
            className="flex items-center gap-2 rounded-medium bg-error-container/30 border border-error/20 px-4 py-3 text-body-2 text-error text-center justify-center"
            role="alert"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{displayError}</span>
          </div>
        )}

        {/* Countdown / Resend */}
        <div className="text-center pt-2">
          {isLocked ? (
            <p className="text-body-2 text-neutral-500">
              لطفاً ۵ دقیقه صبر کنید و دوباره تلاش کنید
            </p>
          ) : isRequesting ? (
            <span className="text-body-2 text-neutral-500">در حال ارسال مجدد...</span>
          ) : canResend ? (
            <button
              type="button"
              onClick={handleResend}
              className="text-body-2 text-primary-700 font-medium underline underline-offset-2 hover:text-primary-800 transition-colors touch-target-min"
            >
              ارسال مجدد کد
            </button>
          ) : (
            <span className="text-body-2 text-neutral-500">
              ارسال مجدد تا{" "}
              <span className="font-medium text-neutral-700 tabular-nums">
                {countdown}
              </span>{" "}
              ثانیه دیگر
            </span>
          )}
        </div>

        {/* Back to mobile */}
        <div className="text-center">
          <button
            type="button"
            onClick={handleEditMobile}
            className="text-caption text-neutral-400 underline underline-offset-2 hover:text-neutral-600 transition-colors"
          >
            بازگشت به صفحه ورود
          </button>
        </div>

        {/* Helper text */}
        <p className="text-caption text-neutral-400 text-center">
          کد ارسال‌شده تا ۲ دقیقه معتبر است
        </p>
      </div>
    </div>
  );
}

export default function OtpVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-large bg-neutral-0/95 backdrop-blur-sm p-8 shadow-elevation-8 border border-neutral-200/50 text-center">
          <div className="flex items-center justify-center gap-2 text-body-2 text-neutral-500">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>در حال بارگذاری...</span>
          </div>
        </div>
      }
    >
      <OtpVerifyForm />
    </Suspense>
  );
}
