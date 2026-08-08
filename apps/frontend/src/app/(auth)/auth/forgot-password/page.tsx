"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useForgotPasswordRequest, useForgotPasswordVerify, useResetPassword, getPasswordStrength } from "@/lib/auth/use-auth";
import { normalizeMobile } from "@/lib/auth/api";

const DIGIT_COUNT = 6;

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ["شماره موبایل", "تأیید کد", "رمز جدید", "اتمام"];

export default function ForgotPasswordPage() {
  // Step state
  const [step, setStep] = useState<Step>(1);
  const [_direction, setDirection] = useState<"forward" | "backward">("forward");

  // Step 1 — mobile
  const [mobile, setMobile] = useState("");

  // Step 2 — OTP
  const [challengeId, setChallengeId] = useState("");
  const [_expiresAt, setExpiresAt] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(DIGIT_COUNT).fill(""));

  // Step 3 — new password
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step3Error, setStep3Error] = useState("");

  // Hooks
  const { requestOtpForReset, isPending: isRequesting, error: requestError } = useForgotPasswordRequest();
  const { verifyResetOtp, isPending: isVerifying, error: verifyError } = useForgotPasswordVerify();
  const { resetPassword, isPending: isResetting, error: resetError } = useResetPassword();

  // Digit input refs
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first digit input on step 2
  useEffect(() => {
    if (step === 2) {
      // Delay to allow transition
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // ---- Step 1: Request OTP ----
  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleaned = raw.replace(/[^\d۰-۹٠-٩\s+()-]/g, "");
    setMobile(cleaned);
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeMobile(mobile);
    if (!normalized) return;

    const result = await requestOtpForReset(mobile);
    if (result) {
      setChallengeId(result.challengeId);
      setExpiresAt(result.expiresAt);
      setDirection("forward");
      setStep(2);
    }
  };

  // ---- Step 2: Verify OTP ----
  const getCode = useCallback((newDigits: string[]) => {
    return newDigits.join("");
  }, []);

  // Auto-verify when all digits filled
  useEffect(() => {
    if (step !== 2) return;
    const code = getCode(digits);
    if (code.length === DIGIT_COUNT && !isVerifying && challengeId) {
      verifyResetOtp(challengeId, code).then((token) => {
        if (token) {
          setResetToken(token);
          setDirection("forward");
          setStep(3);
        }
      });
    }
  }, [step, digits, challengeId, isVerifying, verifyResetOtp, getCode]);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      const cleaned = value.replace(/\D/g, "").slice(0, 1);
      const newDigits = [...digits];
      newDigits[index] = cleaned;
      setDigits(newDigits);

      if (cleaned && index < DIGIT_COUNT - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === "ArrowLeft" && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === "ArrowRight" && index < DIGIT_COUNT - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, DIGIT_COUNT);
      if (pasted.length === DIGIT_COUNT && !isVerifying && challengeId) {
        e.preventDefault();
        const newDigits = pasted.split("");
        setDigits(newDigits);
        verifyResetOtp(challengeId, pasted).then((token) => {
          if (token) {
            setResetToken(token);
            setDirection("forward");
            setStep(3);
          }
        });
        inputRefs.current.forEach((ref) => ref?.blur());
      }
    },
    [challengeId, isVerifying, verifyResetOtp]
  );

  // ---- Step 3: New Password ----
  const passwordStrength = getPasswordStrength(password);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setStep3Error("");
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    setStep3Error("");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      setStep3Error("رمز عبور الزامی است");
      return;
    }
    if (password.length < 6) {
      setStep3Error("رمز عبور باید حداقل ۶ کاراکتر باشد");
      return;
    }
    if (password !== confirmPassword) {
      setStep3Error("رمز عبور و تکرار آن مطابقت ندارند");
      return;
    }

    const success = await resetPassword(resetToken, password);
    if (success) {
      setDirection("forward");
      setStep(4);
    }
  };

  // ---- Navigation ----
  const handleBack = () => {
    setDirection("backward");
    if (step === 2) {
      setStep(1);
      setDigits(Array(DIGIT_COUNT).fill(""));
    } else if (step === 3) {
      setStep(2);
      setDigits(Array(DIGIT_COUNT).fill(""));
    }
  };

  // ---- Render ----
  return (
    <div className="rounded-large bg-neutral-0/95 backdrop-blur-sm p-8 shadow-elevation-8 border border-neutral-200/50">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-h2 text-neutral-900 mb-2">بازیابی رمز عبور</h1>
        <p className="text-body-2 text-neutral-500">
          {step === 1 && "شماره موبایل خود را وارد کنید"}
          {step === 2 && "کد ۶ رقمی ارسال‌شده را وارد کنید"}
          {step === 3 && "رمز عبور جدید خود را تعیین کنید"}
          {step === 4 && "رمز عبور با موفقیت تغییر کرد"}
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEP_LABELS.map((label, idx) => {
            const stepNum = (idx + 1) as Step;
            const isActive = stepNum === step;
            const isCompleted = stepNum < step;
            return (
              <div key={label} className="flex items-center">
                {/* Step circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-caption font-bold transition-all duration-300 ${
                      isCompleted
                        ? "bg-success text-white"
                        : isActive
                        ? "bg-primary-700 text-white shadow-elevation-3"
                        : "bg-neutral-200 text-neutral-500"
                    }`}
                  >
                    {isCompleted ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      stepNum
                    )}
                  </div>
                  <span
                    className={`text-[10px] mt-1 hidden tablet:block ${
                      isActive ? "text-primary-700 font-medium" : "text-neutral-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {/* Connector line */}
                {idx < STEP_LABELS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-1 transition-colors duration-300 ${
                      stepNum < step ? "bg-success" : "bg-neutral-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Mobile Input */}
      {step === 1 && (
        <form
          onSubmit={handleRequestOtp}
          noValidate
          className="animate-fade-in space-y-5"
          key="step-1"
        >
          <div>
            <label htmlFor="forgot-mobile" className="block text-body-2 text-neutral-700 font-medium mb-2">
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
                id="forgot-mobile"
                name="forgot-mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={mobile}
                onChange={handleMobileChange}
                placeholder="۰۹xxxxxxxxx"
                className="w-full rounded-medium border border-neutral-300 bg-neutral-50 pr-20 pl-4 py-3.5 text-body-1 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent transition-colors text-left dir-ltr"
                dir="ltr"
                disabled={isRequesting}
                autoFocus
              />
            </div>
          </div>

          {requestError && (
            <div
              className="flex items-center gap-2 rounded-medium bg-error-container/30 border border-error/20 px-4 py-3 text-body-2 text-error"
              role="alert"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{requestError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!normalizeMobile(mobile) || isRequesting}
            className="w-full rounded-medium bg-primary-700 text-white py-3.5 text-button font-semibold hover:bg-primary-800 active:bg-primary-900 transition-all duration-200 touch-target disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-700 shadow-elevation-3 hover:shadow-elevation-4"
          >
            {isRequesting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                در حال ارسال...
              </span>
            ) : (
              "ارسال کد تأیید"
            )}
          </button>

          <div className="text-center">
            <Link
              href="/auth/mobile"
              className="text-caption text-neutral-400 underline underline-offset-2 hover:text-neutral-600 transition-colors"
            >
              بازگشت به صفحه ورود
            </Link>
          </div>
        </form>
      )}

      {/* Step 2: OTP Input */}
      {step === 2 && (
        <div className="animate-fade-in space-y-6" key="step-2">
          <div className="text-center text-body-2 text-neutral-600">
            کد تأیید به شماره <span className="font-medium text-neutral-800 dir-ltr">{mobile}</span> ارسال شد
          </div>

          <div>
            <label className="sr-only">کد تأیید ۶ رقمی</label>
            <div className="flex items-center justify-center gap-2 dir-ltr" dir="ltr" onPaste={handlePaste}>
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  id={`forgot-otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  maxLength={1}
                  disabled={isVerifying}
                  aria-label={`رقم ${index + 1} از ۶`}
                  className="w-12 h-14 rounded-medium border-2 border-neutral-300 bg-neutral-50 text-center text-h2 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                />
              ))}
            </div>
          </div>

          {isVerifying && (
            <div className="flex items-center justify-center gap-2 text-body-2 text-neutral-500" aria-live="polite">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              در حال بررسی کد...
            </div>
          )}

          {verifyError && (
            <div className="flex items-center justify-center gap-2 rounded-medium bg-error-container/30 border border-error/20 px-4 py-3 text-body-2 text-error" role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{verifyError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleBack}
              className="text-body-2 text-neutral-500 underline underline-offset-2 hover:text-neutral-700 transition-colors touch-target-min"
            >
              بازگشت
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setDigits(Array(DIGIT_COUNT).fill(""));
              }}
              className="text-body-2 text-primary-700 font-medium underline underline-offset-2 hover:text-primary-800 transition-colors touch-target-min"
            >
              ویرایش شماره
            </button>
          </div>

          <p className="text-caption text-neutral-400 text-center">
            کد ارسال‌شده تا ۲ دقیقه معتبر است
          </p>
        </div>
      )}

      {/* Step 3: New Password */}
      {step === 3 && (
        <form onSubmit={handleResetPassword} noValidate className="animate-fade-in space-y-5" key="step-3">
          <div>
            <label htmlFor="new-password" className="block text-body-2 text-neutral-700 font-medium mb-2">
              رمز عبور جدید
            </label>
            <div className="relative">
              <input
                id="new-password"
                name="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="حداقل ۶ کاراکتر"
                className="w-full rounded-medium border border-neutral-300 bg-neutral-50 pr-4 pl-11 py-3.5 text-body-1 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent transition-colors text-left dir-ltr"
                dir="ltr"
                disabled={isResetting}
                autoFocus
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

            {password.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <div className="flex gap-1 dir-ltr" dir="ltr">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-1.5 flex-1 rounded-full transition-colors duration-200"
                      style={{ backgroundColor: i < passwordStrength.score ? passwordStrength.color : "#E5E7EB" }}
                    />
                  ))}
                </div>
                <p className="text-caption" style={{ color: passwordStrength.color }}>
                  قدرت رمز عبور: {passwordStrength.label}
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="new-confirm-password" className="block text-body-2 text-neutral-700 font-medium mb-2">
              تکرار رمز عبور جدید
            </label>
            <div className="relative">
              <input
                id="new-confirm-password"
                name="new-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                placeholder="رمز عبور را دوباره وارد کنید"
                className="w-full rounded-medium border border-neutral-300 bg-neutral-50 pr-4 pl-11 py-3.5 text-body-1 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent transition-colors text-left dir-ltr"
                dir="ltr"
                disabled={isResetting}
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
          </div>

          {(step3Error || resetError) && (
            <div className="flex items-center gap-2 rounded-medium bg-error-container/30 border border-error/20 px-4 py-3 text-body-2 text-error" role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{step3Error || resetError}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={isResetting}
              className="flex-1 rounded-medium border-2 border-neutral-200 text-neutral-600 py-3.5 text-button font-medium hover:bg-neutral-50 hover:border-neutral-300 active:bg-neutral-100 transition-all duration-200 touch-target disabled:opacity-50 disabled:cursor-not-allowed"
            >
              بازگشت
            </button>
            <button
              type="submit"
              disabled={!password || !confirmPassword || isResetting}
              className="flex-1 rounded-medium bg-primary-700 text-white py-3.5 text-button font-semibold hover:bg-primary-800 active:bg-primary-900 transition-all duration-200 touch-target disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-700 shadow-elevation-3 hover:shadow-elevation-4"
            >
              {isResetting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  در حال تغییر...
                </span>
              ) : (
                "تغییر رمز عبور"
              )}
            </button>
          </div>
        </form>
      )}

      {/* Step 4: Success */}
      {step === 4 && (
        <div className="animate-fade-in text-center space-y-6" key="step-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-container mb-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <div>
            <h2 className="text-h3 text-neutral-900 mb-2">رمز عبور با موفقیت تغییر کرد</h2>
            <p className="text-body-2 text-neutral-500">
              حالا می‌توانید با رمز عبور جدید وارد حساب کاربری خود شوید
            </p>
          </div>

          <Link
            href="/auth/mobile"
            className="inline-block w-full rounded-medium bg-primary-700 text-white py-3.5 text-button font-semibold hover:bg-primary-800 active:bg-primary-900 transition-all duration-200 touch-target shadow-elevation-3 hover:shadow-elevation-4 text-center"
          >
            رفتن به صفحه ورود
          </Link>
        </div>
      )}
    </div>
  );
}
