"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRequestOtp, usePasswordLogin } from "@/lib/auth/use-auth";
import { normalizeMobile } from "@/lib/auth/api";
import { useAuthStore } from "@/stores/auth-store";

type LoginTab = "password" | "otp";

export default function MobileLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // OTP hooks
  const { requestOtp, isPending: isOtpPending, error: otpError } = useRequestOtp();
  // Password hooks
  const { login, isPending: isPasswordPending, error: passwordError } = usePasswordLogin();

  const setIntendedRoute = useAuthStore((s) => s.setIntendedRoute);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Login tab — default to password for returning users (check localStorage for saved preference)
  const [activeTab, setActiveTab] = useState<LoginTab>(() => {
    // Check if user has a preference stored
    if (typeof window !== "undefined") {
      return (localStorage.getItem("legalir-login-tab") as LoginTab) || "password";
    }
    return "password";
  });

  // OTP state
  const [otpMobile, setOtpMobile] = useState("");
  const [otpValidationError, setOtpValidationError] = useState("");

  // Password state
  const [passwordMobile, setPasswordMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordValidationError, setPasswordValidationError] = useState("");

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

  // Persist tab preference
  const handleTabChange = useCallback((tab: LoginTab) => {
    setActiveTab(tab);
    localStorage.setItem("legalir-login-tab", tab);
    // Clear errors on tab switch
    setOtpValidationError("");
    setOtpValidationError("");
    setPasswordValidationError("");
  }, []);

  // ---- OTP Handlers ----
  const handleOtpMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleaned = raw.replace(/[^\d۰-۹٠-٩\s+()-]/g, "");
    setOtpMobile(cleaned);
    setOtpValidationError("");
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpValidationError("");

    const normalized = normalizeMobile(otpMobile);
    if (!normalized) {
      setOtpValidationError("شماره موبایل معتبر نیست. لطفاً با ۰۹ وارد کنید");
      return;
    }

    const result = await requestOtp(otpMobile);
    if (result) {
      const params = new URLSearchParams();
      params.set("mobile", normalized);
      params.set("challengeId", result.challengeId);
      params.set("expiresAt", result.expiresAt);
      params.set("remainingAttempts", String(result.remainingAttempts));
      params.set("cooldown", String(result.resendCooldownSeconds));
      router.push(`/auth/verify?${params.toString()}`);
    }
  };

  // ---- Password Handlers ----
  const handlePasswordMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleaned = raw.replace(/[^\d۰-۹٠-٩\s+()-]/g, "");
    setPasswordMobile(cleaned);
    setPasswordValidationError("");
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setPasswordValidationError("");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordValidationError("");

    const normalized = normalizeMobile(passwordMobile);
    if (!normalized) {
      setPasswordValidationError("شماره موبایل معتبر نیست. لطفاً با ۰۹ وارد کنید");
      return;
    }

    if (!password) {
      setPasswordValidationError("رمز عبور را وارد کنید");
      return;
    }

    await login(normalized, password);
  };

  // ---- Computed values ----
  const otpNormalized = normalizeMobile(otpMobile);
  const isValidOtpMobile = otpNormalized !== null;
  const otpDisplayError = otpValidationError || otpError;

  const passwordNormalized = normalizeMobile(passwordMobile);
  const isValidPasswordMobile = passwordNormalized !== null;
  const isPasswordFormValid = isValidPasswordMobile && password.length > 0;
  const passwordDisplayError = passwordValidationError || passwordError;

  return (
    <div className="rounded-2xl bg-white p-8 md:p-10 shadow-2xl border border-neutral-100">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-h2 text-primary-900 mb-2">ورود به حساب کاربری</h1>
        <p className="text-body-2 text-neutral-500">
          برای استفاده از خدمات حقوقی LEGALIR وارد شوید
        </p>
      </div>

      {/* Tab / Segmented Control */}
      <div className="flex rounded-xl bg-neutral-100 p-1.5 mb-8" role="tablist" aria-label="نحوه ورود">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "password"}
          onClick={() => handleTabChange("password")}
          className={`flex-1 rounded-lg py-3 text-body-2 font-medium transition-all duration-200 ${
            activeTab === "password"
              ? "bg-white text-primary-800 shadow-sm"
              : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          ورود با رمز عبور
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "otp"}
          onClick={() => handleTabChange("otp")}
          className={`flex-1 rounded-lg py-3 text-body-2 font-medium transition-all duration-200 ${
            activeTab === "otp"
              ? "bg-white text-primary-800 shadow-sm"
              : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          ورود با کد یکبارمصرف
        </button>
      </div>

      {/* ---- Password Login Form ---- */}
      {activeTab === "password" && (
        <form onSubmit={handlePasswordSubmit} noValidate className="animate-fade-in space-y-5" key="password-tab">
          {/* Mobile Phone Field */}
          <div>
            <label htmlFor="password-mobile" className="block text-body-2 text-neutral-700 font-medium mb-2">
              شماره موبایل
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <div className="flex items-center gap-1.5 text-neutral-400">
                  <svg
                    width="22"
                    height="16"
                    viewBox="0 0 22 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="rounded-sm"
                    aria-hidden="true"
                  >
                    <rect y="0" width="22" height="5.33" fill="#239543" />
                    <rect y="5.33" width="22" height="5.33" fill="#FFFFFF" />
                    <rect y="10.67" width="22" height="5.33" fill="#DA0000" />
                  </svg>
                  <span className="text-body-2 text-neutral-400">۹۸+</span>
                </div>
              </div>
              <input
                id="password-mobile"
                name="password-mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={passwordMobile}
                onChange={handlePasswordMobileChange}
                placeholder="۰۹xxxxxxxxx"
                className="w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 pr-20 pl-4 py-3.5 text-body-1 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all text-left dir-ltr"
                dir="ltr"
                disabled={isPasswordPending}
                autoFocus
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="login-password" className="block text-body-2 text-neutral-700 font-medium">
                رمز عبور
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-caption text-primary-700 underline underline-offset-2 hover:text-primary-800 transition-colors"
              >
                رمز عبور را فراموش کرده‌اید؟
              </Link>
            </div>
            <div className="relative">
              <input
                id="login-password"
                name="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="رمز عبور خود را وارد کنید"
                className="w-full rounded-medium border border-neutral-300 bg-neutral-50 pr-4 pl-11 py-3.5 text-body-1 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent transition-colors text-left dir-ltr"
                dir="ltr"
                disabled={isPasswordPending}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400 hover:text-neutral-600 transition-colors touch-target-min"
                aria-label={showPassword ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {passwordDisplayError && (
            <div
              id="password-error"
              className="flex items-center gap-2 rounded-medium bg-error-container/30 border border-error/20 px-4 py-3 text-body-2 text-error"
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
              <span>{passwordDisplayError}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isPasswordFormValid || isPasswordPending}
            className="w-full rounded-medium bg-primary-700 text-white py-3.5 text-button font-semibold hover:bg-primary-800 active:bg-primary-900 transition-all duration-200 touch-target disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-700 shadow-elevation-3 hover:shadow-elevation-4"
          >
            {isPasswordPending ? (
              <span className="flex items-center justify-center gap-2">
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
                در حال ورود...
              </span>
            ) : (
              "ورود"
            )}
          </button>
        </form>
      )}

      {/* ---- OTP Login Form ---- */}
      {activeTab === "otp" && (
        <form onSubmit={handleOtpSubmit} noValidate className="animate-fade-in space-y-5" key="otp-tab">
          {/* Phone Input with Iran prefix */}
          <div>
            <label htmlFor="otp-mobile" className="block text-body-2 text-neutral-700 font-medium mb-2">
              شماره موبایل
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <div className="flex items-center gap-1.5 text-neutral-400">
                  <svg
                    width="22"
                    height="16"
                    viewBox="0 0 22 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="rounded-sm"
                    aria-hidden="true"
                  >
                    <rect y="0" width="22" height="5.33" fill="#239543" />
                    <rect y="5.33" width="22" height="5.33" fill="#FFFFFF" />
                    <rect y="10.67" width="22" height="5.33" fill="#DA0000" />
                  </svg>
                  <span className="text-body-2 text-neutral-400">۹۸+</span>
                </div>
              </div>
              <input
                id="otp-mobile"
                name="otp-mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={otpMobile}
                onChange={handleOtpMobileChange}
                placeholder="۰۹xxxxxxxxx"
                aria-describedby={otpDisplayError ? "otp-mobile-error" : undefined}
                aria-invalid={!!otpDisplayError}
                className="w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 pr-20 pl-4 py-3.5 text-body-1 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all text-left dir-ltr"
                dir="ltr"
                disabled={isOtpPending}
              />
            </div>
          </div>

          {/* Error Message */}
          {otpDisplayError && (
            <div
              id="otp-mobile-error"
              className="flex items-center gap-2 rounded-medium bg-error-container/30 border border-error/20 px-4 py-3 text-body-2 text-error"
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
              <span>{otpDisplayError}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isValidOtpMobile || isOtpPending}
            className="w-full rounded-medium bg-primary-700 text-white py-3.5 text-button font-semibold hover:bg-primary-800 active:bg-primary-900 transition-all duration-200 touch-target disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-700 shadow-elevation-3 hover:shadow-elevation-4"
          >
            {isOtpPending ? (
              <span className="flex items-center justify-center gap-2">
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
                در حال ارسال...
              </span>
            ) : (
              "ارسال کد تأیید"
            )}
          </button>
        </form>
      )}

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-neutral-200">
        <Link
          href="/auth/register"
          className="text-body-2 text-primary-700 font-medium hover:text-primary-800 transition-colors"
        >
          ساخت حساب جدید
        </Link>
        <Link
          href="/auth/forgot-password"
          className="text-body-2 text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          بازیابی رمز عبور
        </Link>
      </div>
      <p className="text-center text-caption text-neutral-400 mt-6">
        با ورود، شرایط استفاده و حریم خصوصی را می‌پذیرم
      </p>
    </div>
  );
}
