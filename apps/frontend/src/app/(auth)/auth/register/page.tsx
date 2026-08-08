"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRegister, getPasswordStrength } from "@/lib/auth/use-auth";
import { normalizeMobile } from "@/lib/auth/api";

type FieldName = "mobile" | "password" | "confirmPassword";

interface FieldErrors {
  mobile?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

interface TouchedFields {
  mobile?: boolean;
  password?: boolean;
  confirmPassword?: boolean;
}

function validateMobileField(rawMobile: string): string | null {
  if (!rawMobile.trim()) return "شماره موبایل الزامی است";
  if (!normalizeMobile(rawMobile)) return "شماره موبایل معتبر نیست. لطفاً با ۰۹ وارد کنید";
  return null;
}

function validatePasswordField(password: string): string | null {
  if (!password) return "رمز عبور الزامی است";
  if (password.length < 6) return "رمز عبور باید حداقل ۶ کاراکتر باشد";
  if (password.length > 128) return "رمز عبور نمی‌تواند بیش از ۱۲۸ کاراکتر باشد";
  return null;
}

export default function RegisterPage() {
  const { register, isPending, error: apiError } = useRegister();

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});

  const strength = getPasswordStrength(password);

  const clearFieldError = useCallback((field: FieldName | "terms") => {
    setFieldErrors((prev) => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const validateAndSetError = useCallback(
    (field: FieldName | "terms") => {
      if (field === "mobile") {
        const err = validateMobileField(mobile);
        if (err) setFieldErrors((p) => ({ ...p, mobile: err }));
        else clearFieldError("mobile");
      } else if (field === "password") {
        const err = validatePasswordField(password);
        if (err) setFieldErrors((p) => ({ ...p, password: err }));
        else clearFieldError("password");
      } else if (field === "confirmPassword") {
        if (!confirmPassword) {
          setFieldErrors((p) => ({ ...p, confirmPassword: "تکرار رمز عبور الزامی است" }));
        } else if (confirmPassword !== password) {
          setFieldErrors((p) => ({ ...p, confirmPassword: "رمز عبور و تکرار آن مطابقت ندارند" }));
        } else {
          clearFieldError("confirmPassword");
        }
      }
    },
    [mobile, password, confirmPassword, clearFieldError]
  );

  const touchField = useCallback(
    (field: FieldName | "terms") => {
      setTouched((prev) => {
        if (field === "terms") return prev; // "terms" is handled by checkbox
        return { ...prev, [field]: true };
      });
      validateAndSetError(field);
    },
    [validateAndSetError]
  );

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleaned = raw.replace(/[^\d۰-۹٠-٩\s+()-]/g, "");
    setMobile(cleaned);
    if (touched.mobile) {
      const err = validateMobileField(cleaned);
      if (err) setFieldErrors((p) => ({ ...p, mobile: err }));
      else clearFieldError("mobile");
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (touched.password) {
      const err = validatePasswordField(e.target.value);
      if (err) setFieldErrors((p) => ({ ...p, password: err }));
      else clearFieldError("password");
    }
    // Clear confirm mismatch if confirm was touched
    if (touched.confirmPassword && e.target.value !== confirmPassword) {
      setFieldErrors((p) => ({ ...p, confirmPassword: "رمز عبور و تکرار آن مطابقت ندارند" }));
    } else if (touched.confirmPassword) {
      clearFieldError("confirmPassword");
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (touched.confirmPassword) {
      if (!e.target.value) {
        setFieldErrors((p) => ({ ...p, confirmPassword: "تکرار رمز عبور الزامی است" }));
      } else if (e.target.value !== password) {
        setFieldErrors((p) => ({ ...p, confirmPassword: "رمز عبور و تکرار آن مطابقت ندارند" }));
      } else {
        clearFieldError("confirmPassword");
      }
    }
  };

  const isFormValid =
    normalizeMobile(mobile) !== null &&
    password.length >= 6 &&
    password.length <= 128 &&
    password === confirmPassword &&
    acceptTerms &&
    Object.keys(fieldErrors).length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Touch all fields
    setTouched({ mobile: true, password: true, confirmPassword: true });

    // Run all validations
    const errors: FieldErrors = {};
    const mobileErr = validateMobileField(mobile);
    if (mobileErr) errors.mobile = mobileErr;
    const passErr = validatePasswordField(password);
    if (passErr) errors.password = passErr;
    if (!confirmPassword) errors.confirmPassword = "تکرار رمز عبور الزامی است";
    else if (confirmPassword !== password) errors.confirmPassword = "رمز عبور و تکرار آن مطابقت ندارند";
    if (!acceptTerms) errors.terms = "پذیرش شرایط استفاده الزامی است";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const normalized = normalizeMobile(mobile)!;
    await register(normalized, password, acceptTerms);
    // If successful, the hook handles session + redirect internally.
    // If failed, apiError will be set and displayed.
  };

  // Map API fieldErrors to local fieldErrors
  useEffect(() => {
    if (apiError) {
      if (apiError.includes("موبایل")) {
        setFieldErrors((p) => ({ ...p, mobile: apiError }));
      }
    }
  }, [apiError]);

  const displayApiError = apiError && !fieldErrors.mobile ? apiError : null;

  return (
    <div className="rounded-large bg-neutral-0/95 backdrop-blur-sm p-8 shadow-elevation-8 border border-neutral-200/50">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-h2 text-neutral-900 mb-2">ثبت‌نام در LEGALIR</h1>
        <p className="text-body-2 text-neutral-500">
          حساب کاربری جدید بسازید و از خدمات حقوقی هوشمند استفاده کنید
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Mobile Phone Field */}
        <div>
          <label htmlFor="mobile" className="block text-body-2 text-neutral-700 font-medium mb-2">
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
              id="mobile"
              name="mobile"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={mobile}
              onChange={handleMobileChange}
              onBlur={() => touchField("mobile")}
              placeholder="۰۹xxxxxxxxx"
              aria-describedby={fieldErrors.mobile ? "mobile-error" : undefined}
              aria-invalid={!!fieldErrors.mobile}
              className="w-full rounded-medium border border-neutral-300 bg-neutral-50 pr-20 pl-4 py-3.5 text-body-1 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent transition-colors text-left dir-ltr"
              dir="ltr"
              disabled={isPending}
              autoFocus
            />
          </div>
          {fieldErrors.mobile && (
            <p id="mobile-error" className="mt-2 text-caption text-error" role="alert">
              {fieldErrors.mobile}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="password" className="block text-body-2 text-neutral-700 font-medium mb-2">
            رمز عبور
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={handlePasswordChange}
              onBlur={() => touchField("password")}
              placeholder="حداقل ۶ کاراکتر"
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              aria-invalid={!!fieldErrors.password}
              className="w-full rounded-medium border border-neutral-300 bg-neutral-50 pr-4 pl-11 py-3.5 text-body-1 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent transition-colors text-left dir-ltr"
              dir="ltr"
              disabled={isPending}
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

          {/* Password Strength Meter */}
          {password.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="flex gap-1 dir-ltr" dir="ltr">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-1.5 flex-1 rounded-full transition-colors duration-200"
                    style={{
                      backgroundColor: i < strength.score ? strength.color : "#E5E7EB",
                    }}
                  />
                ))}
              </div>
              <p className="text-caption" style={{ color: strength.color }}>
                قدرت رمز عبور: {strength.label}
              </p>
            </div>
          )}

          {fieldErrors.password && (
            <p id="password-error" className="mt-2 text-caption text-error" role="alert">
              {fieldErrors.password}
            </p>
          )}

          {password.length > 0 && password.length < 6 && (
            <p className="mt-1 text-caption text-neutral-400">
              رمز عبور باید حداقل ۶ کاراکتر باشد
            </p>
          )}
        </div>

        {/* Confirm Password Field */}
        <div>
          <label htmlFor="confirmPassword" className="block text-body-2 text-neutral-700 font-medium mb-2">
            تکرار رمز عبور
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              onBlur={() => touchField("confirmPassword")}
              placeholder="رمز عبور را دوباره وارد کنید"
              aria-describedby={fieldErrors.confirmPassword ? "confirm-password-error" : undefined}
              aria-invalid={!!fieldErrors.confirmPassword}
              className="w-full rounded-medium border border-neutral-300 bg-neutral-50 pr-4 pl-11 py-3.5 text-body-1 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent transition-colors text-left dir-ltr"
              dir="ltr"
              disabled={isPending}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((p) => !p)}
              className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400 hover:text-neutral-600 transition-colors touch-target-min"
              aria-label={showConfirmPassword ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
              tabIndex={-1}
            >
              {showConfirmPassword ? (
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
          {fieldErrors.confirmPassword && (
            <p id="confirm-password-error" className="mt-2 text-caption text-error" role="alert">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        {/* Terms Acceptance Checkbox */}
        <div className="pt-1">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => {
                  setAcceptTerms(e.target.checked);
                  if (e.target.checked) clearFieldError("terms");
                }}
                aria-describedby={fieldErrors.terms ? "terms-error" : undefined}
                aria-invalid={!!fieldErrors.terms}
                className="sr-only"
                disabled={isPending}
              />
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  acceptTerms
                    ? "bg-primary-700 border-primary-700"
                    : "border-neutral-300 group-hover:border-neutral-400"
                }`}
              >
                {acceptTerms && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-body-2 text-neutral-600 select-none">
              با ثبت‌نام،{" "}
              <Link href="/terms" className="text-primary-700 underline underline-offset-2 hover:text-primary-800 transition-colors">
                شرایط استفاده
              </Link>{" "}
              و{" "}
              <Link href="/privacy" className="text-primary-700 underline underline-offset-2 hover:text-primary-800 transition-colors">
                حریم خصوصی
              </Link>{" "}
              را می‌پذیرم
            </span>
          </label>
          {fieldErrors.terms && (
            <p id="terms-error" className="mt-2 text-caption text-error" role="alert">
              {fieldErrors.terms}
            </p>
          )}
        </div>

        {/* API Error */}
        {displayApiError && (
          <div
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
            <span>{displayApiError}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isFormValid || isPending}
          className="w-full rounded-medium bg-primary-700 text-white py-3.5 text-button font-semibold hover:bg-primary-800 active:bg-primary-900 transition-all duration-200 touch-target disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-700 shadow-elevation-3 hover:shadow-elevation-4"
        >
          {isPending ? (
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
              در حال ثبت‌نام...
            </span>
          ) : (
            "ثبت‌نام"
          )}
        </button>

        {/* Link to Login */}
        <p className="text-center text-body-2 text-neutral-500 pt-2">
          قبلاً ثبت‌نام کرده‌اید؟{" "}
          <Link
            href="/auth/mobile"
            className="text-primary-700 font-medium underline underline-offset-2 hover:text-primary-800 transition-colors"
          >
            ورود به حساب کاربری
          </Link>
        </p>
      </form>
    </div>
  );
}
