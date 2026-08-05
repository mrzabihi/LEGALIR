"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVerifyOtp, useRequestOtp } from "@/lib/auth/use-auth";
import { useAuthStore } from "@/stores/auth-store";

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

  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
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

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-verify when 6 digits entered
  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/\D/g, "").slice(0, 6);
      setCode(value);

      if (value.length === 6 && !isVerifying && challengeId) {
        verifyOtp(challengeId, value);
      }
    },
    [challengeId, isVerifying, verifyOtp]
  );

  // Handle paste
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (pasted.length === 6 && !isVerifying && challengeId) {
        e.preventDefault();
        setCode(pasted);
        verifyOtp(challengeId, pasted);
      }
    },
    [challengeId, isVerifying, verifyOtp]
  );

  // Resend OTP
  const handleResend = useCallback(async () => {
    if (!mobile || isRequesting) return;

    const result = await requestOtp(mobile);
    if (result) {
      // Reset state for new challenge
      setCode("");
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

      inputRef.current?.focus();
    }
  }, [mobile, isRequesting, requestOtp, cooldownSeconds, router]);

  // Edit mobile number
  const handleEditMobile = useCallback(() => {
    router.push("/auth/mobile");
  }, [router]);

  const displayError = verifyError || requestError;
  const isLocked = displayError?.includes("بیش از حد");

  return (
    <div className="rounded-large bg-surface p-8 shadow-elevation-4">
      <h1 className="text-h3 text-on-surface mb-2 text-center">تأیید کد</h1>
      <p className="text-body-2 text-muted mb-1 text-center">
        کد ۶ رقمی ارسال‌شده را وارد کنید
      </p>

      {/* Mobile display with edit */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="text-body-2 text-on-surface font-medium dir-ltr">{mobile}</span>
        <button
          type="button"
          onClick={handleEditMobile}
          className="text-caption text-primary underline hover:text-primary-variant transition-colors"
          aria-label="ویرایش شماره موبایل"
        >
          ویرایش
        </button>
      </div>

      <div className="space-y-4">
        {/* OTP Input */}
        <div>
          <label htmlFor="otp-input" className="sr-only">
            کد تأیید ۶ رقمی
          </label>
          <input
            ref={inputRef}
            id="otp-input"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={handleCodeChange}
            onPaste={handlePaste}
            placeholder="------"
            aria-describedby={displayError ? "otp-error" : undefined}
            aria-invalid={!!displayError}
            maxLength={6}
            className="w-full rounded-medium border border-border bg-background px-4 py-4 text-center text-h2 tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-primary dir-ltr"
            dir="ltr"
            disabled={isVerifying || isLocked}
            autoFocus
          />
        </div>

        {/* Error Message */}
        {displayError && (
          <p id="otp-error" className="text-body-2 text-error text-center" role="alert">
            {displayError}
          </p>
        )}

        {/* Loading */}
        {(isVerifying || isRequesting) && (
          <p className="text-body-2 text-muted text-center" aria-live="polite">
            {isVerifying ? "در حال بررسی کد..." : "در حال ارسال مجدد کد..."}
          </p>
        )}

        {/* Countdown / Resend */}
        <div className="text-center pt-2">
          {isLocked ? (
            <p className="text-body-2 text-muted">
              لطفاً ۵ دقیقه صبر کنید و دوباره تلاش کنید
            </p>
          ) : isRequesting ? (
            <span className="text-body-2 text-muted">در حال ارسال...</span>
          ) : canResend ? (
            <button
              type="button"
              onClick={handleResend}
              className="text-body-2 text-primary underline hover:text-primary-variant transition-colors touch-target"
            >
              ارسال مجدد کد
            </button>
          ) : (
            <span className="text-body-2 text-muted">
              ارسال مجدد تا {countdown} ثانیه دیگر
            </span>
          )}
        </div>

        {/* Back to mobile */}
        <div className="text-center">
          <button
            type="button"
            onClick={handleEditMobile}
            className="text-caption text-muted underline hover:text-on-surface transition-colors"
          >
            بازگشت به صفحه ورود
          </button>
        </div>

        <p className="text-caption text-muted text-center">
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
        <div className="rounded-large bg-surface p-8 shadow-elevation-4 text-center">
          <p className="text-body-2 text-muted">در حال بارگذاری...</p>
        </div>
      }
    >
      <OtpVerifyForm />
    </Suspense>
  );
}
