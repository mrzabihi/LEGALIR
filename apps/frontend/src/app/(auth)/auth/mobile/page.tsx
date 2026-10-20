"use client";

// ============================================================
// LEGALIR — Sign in (password or one-time code)
// ============================================================
// Two sign-in methods behind one segmented control. Everything below the
// presentation is the shipped behaviour:
//
//   · `?intent=` is captured into the auth store and honoured after login
//   · the chosen tab is remembered in `legalir-login-tab`
//   · OTP login calls `requestOtp` and forwards to /auth/verify with the
//     challenge id, expiry, remaining attempts and cooldown
//   · password login calls `login(normalized, password)`
//   · request-level failures (network, rate limit, wrong credentials)
//     surface as a general alert; input validation errors attach to the
//     field that produced them
//
// Presentation changes: field-level errors are now handed to the field
// (`errorMessage` → `aria-invalid` + `aria-describedby`) instead of a lone
// box, the recovery link clears the floating label instead of colliding with
// it, the two tabs are a real tablist (ids, `aria-controls`, arrow keys), and
// every inline link is a ≥44px tap target.

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TextField, PasswordField, Button } from "@legalir/ui";
import { useRequestOtp, usePasswordLogin } from "@/lib/auth/use-auth";
import { normalizeMobile, MOBILE_ERROR_MESSAGE } from "@/lib/auth/api";
import { useAuthStore } from "@/stores/auth-store";

type LoginTab = "password" | "otp";

const TAB_ID = {
  password: "login-tab-password",
  otp: "login-tab-otp",
} as const;

const PANEL_ID = {
  password: "login-panel-password",
  otp: "login-panel-otp",
} as const;

/** Iran flag + `۹۸+`, shared by both phone fields. */
function IranPrefix() {
  return (
    <span className="flex items-center gap-1.5">
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
      <span className="text-body-2">۹۸+</span>
    </span>
  );
}

/** The one error presentation for a submitted-but-rejected request. */
function GeneralError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div
      id={id}
      className="flex items-start gap-2 rounded-medium bg-error-container px-4 py-3 text-body-2 text-error"
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
        className="mt-0.5 shrink-0"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

export default function MobileLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // OTP hooks
  const { requestOtp, isPending: isOtpPending, error: otpError } = useRequestOtp();
  // Password hooks
  const { login, isPending: isPasswordPending, error: passwordError } = usePasswordLogin();

  const setIntendedRoute = useAuthStore((s) => s.setIntendedRoute);

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
  const [otpFieldError, setOtpFieldError] = useState("");

  // Password state
  const [passwordMobile, setPasswordMobile] = useState("");
  const [password, setPassword] = useState("");
  // Split at the source (not by parsing the message later) so each message
  // lands on the field that produced it: the mobile check on the phone field,
  // the empty-password check on the password field. They are mutually
  // exclusive — submit returns after the first failure.
  const [passwordMobileFieldError, setPasswordMobileFieldError] = useState("");
  const [passwordFieldError, setPasswordFieldError] = useState("");

  // Focus management for the tabs: ArrowLeft/ArrowRight move between tabs in
  // RTL reading order and focus follows, the standard tablist contract.
  const passwordTabRef = useRef<HTMLButtonElement | null>(null);
  const otpTabRef = useRef<HTMLButtonElement | null>(null);

  // Capture intent from query params on mount
  useEffect(() => {
    const intent = searchParams.get("intent");
    if (intent) {
      setIntendedRoute(intent);
    }
  }, [searchParams, setIntendedRoute]);

  // Persist tab preference
  const handleTabChange = useCallback((tab: LoginTab) => {
    setActiveTab(tab);
    localStorage.setItem("legalir-login-tab", tab);
    // Clear errors on tab switch
    setOtpFieldError("");
    setPasswordMobileFieldError("");
    setPasswordFieldError("");
  }, []);

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      // RTL: the visual right-hand tab is the first one, so ArrowLeft moves
      // forward and ArrowRight moves back.
      const next: LoginTab =
        event.key === "ArrowLeft"
          ? activeTab === "password"
            ? "otp"
            : "password"
          : activeTab === "otp"
            ? "password"
            : "otp";
      handleTabChange(next);
      (next === "password" ? passwordTabRef : otpTabRef).current?.focus();
    },
    [activeTab, handleTabChange]
  );

  // ---- OTP Handlers ----
  const handleOtpMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleaned = raw.replace(/[^\d۰-۹٠-٩\s+()-]/g, "");
    setOtpMobile(cleaned);
    setOtpFieldError("");
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpFieldError("");

    const normalized = normalizeMobile(otpMobile);
    if (!normalized) {
      setOtpFieldError(MOBILE_ERROR_MESSAGE);
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
    setPasswordMobileFieldError("");
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setPasswordFieldError("");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMobileFieldError("");
    setPasswordFieldError("");

    const normalized = normalizeMobile(passwordMobile);
    if (!normalized) {
      setPasswordMobileFieldError(MOBILE_ERROR_MESSAGE);
      return;
    }

    if (!password) {
      setPasswordFieldError("رمز عبور را وارد کنید");
      return;
    }

    await login(normalized, password);
  };

  // ---- Computed values ----
  const otpNormalized = normalizeMobile(otpMobile);
  const isValidOtpMobile = otpNormalized !== null;

  const passwordNormalized = normalizeMobile(passwordMobile);
  const isValidPasswordMobile = passwordNormalized !== null;
  const isPasswordFormValid = isValidPasswordMobile && password.length > 0;

  const tabClass = (selected: boolean) =>
    [
      // 44px tall at every width — the segmented control is a primary
      // navigation affordance, not a piece of chrome.
      "flex min-h-11 flex-1 items-center justify-center rounded-medium px-3 text-body-2 font-medium transition-colors duration-200",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      selected
        ? "bg-surface text-primary-800 shadow-elevation-1"
        : "text-neutral-500 hover:text-neutral-700",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div className="rounded-large border border-divider bg-surface p-5 shadow-elevation-8 tablet:p-8">
      {/* Header */}
      <div className="mb-6 text-center tablet:mb-7">
        <h1 className="text-h2 text-primary-900">ورود به حساب کاربری</h1>
        <p className="mt-2 text-body-2 text-neutral-500">
          برای استفاده از خدمات حقوقی لیگالیر وارد شوید
        </p>
      </div>

      {/* Tab / Segmented Control */}
      <div
        className="mb-6 flex gap-1 rounded-medium bg-surface-container p-1"
        role="tablist"
        aria-label="نحوه ورود"
      >
        <button
          ref={passwordTabRef}
          id={TAB_ID.password}
          type="button"
          role="tab"
          aria-selected={activeTab === "password"}
          aria-controls={PANEL_ID.password}
          tabIndex={activeTab === "password" ? 0 : -1}
          onClick={() => handleTabChange("password")}
          onKeyDown={handleTabKeyDown}
          className={tabClass(activeTab === "password")}
        >
          ورود با رمز عبور
        </button>
        <button
          ref={otpTabRef}
          id={TAB_ID.otp}
          type="button"
          role="tab"
          aria-selected={activeTab === "otp"}
          aria-controls={PANEL_ID.otp}
          tabIndex={activeTab === "otp" ? 0 : -1}
          onClick={() => handleTabChange("otp")}
          onKeyDown={handleTabKeyDown}
          className={tabClass(activeTab === "otp")}
        >
          ورود با کد یکبارمصرف
        </button>
      </div>

      {/* ---- Password Login Form ---- */}
      {activeTab === "password" && (
        <form
          id={PANEL_ID.password}
          role="tabpanel"
          aria-labelledby={TAB_ID.password}
          onSubmit={handlePasswordSubmit}
          noValidate
          className="animate-fade-in space-y-4"
          key="password-tab"
        >
          {/* Mobile Phone Field */}
          <TextField
            id="password-mobile"
            name="password-mobile"
            label="شماره موبایل"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={passwordMobile}
            onChange={handlePasswordMobileChange}
            errorMessage={passwordMobileFieldError || undefined}
            supportingText={
              passwordMobileFieldError ? undefined : "مثال: ۹۱۲ ۱۲۳ ۴۵۶۷"
            }
            fullWidth
            inputDir="ltr"
            disabled={isPasswordPending}
            autoFocus
            leadingIcon={<IranPrefix />}
          />

          {/* Password Field — the recovery link sits above the field with
              enough clearance for the floated label (it previously landed on
              top of it), and is itself a 44px tap target. */}
          <div>
            <div className="-mt-1 mb-2 flex justify-end">
              <Link
                href="/auth/forgot-password"
                className="inline-flex min-h-11 items-center rounded-small px-1 text-caption font-medium text-primary-700 underline underline-offset-2 transition-colors hover:text-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                رمز عبور را فراموش کرده‌اید؟
              </Link>
            </div>
            <PasswordField
              id="login-password"
              name="login-password"
              label="رمز عبور"
              autoComplete="current-password"
              value={password}
              onChange={handlePasswordChange}
              errorMessage={passwordFieldError || undefined}
              fullWidth
              disabled={isPasswordPending}
            />
          </div>

          {/* General error — the credential pair was rejected, which belongs
              to the form rather than to one field. */}
          {passwordError && <GeneralError id="password-error">{passwordError}</GeneralError>}

          {/* Submit Button — the spinner carries progress, the label stays
              the action's name so it never reads as a different verb. */}
          <Button
            type="submit"
            size="large"
            fullWidth
            loading={isPasswordPending}
            disabled={!isPasswordFormValid || isPasswordPending}
          >
            ورود
          </Button>
        </form>
      )}

      {/* ---- OTP Login Form ---- */}
      {activeTab === "otp" && (
        <form
          id={PANEL_ID.otp}
          role="tabpanel"
          aria-labelledby={TAB_ID.otp}
          onSubmit={handleOtpSubmit}
          noValidate
          className="animate-fade-in space-y-4"
          key="otp-tab"
        >
          {/* Phone Input with Iran prefix */}
          <TextField
            id="otp-mobile"
            name="otp-mobile"
            label="شماره موبایل"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={otpMobile}
            onChange={handleOtpMobileChange}
            errorMessage={otpFieldError || undefined}
            supportingText={
              otpFieldError ? undefined : "کد تأیید به همین شماره پیامک می‌شود"
            }
            fullWidth
            inputDir="ltr"
            disabled={isOtpPending}
            autoFocus
            leadingIcon={<IranPrefix />}
          />

          {/* General error — the request itself failed (network, rate limit,
              unknown number); the number itself may well be valid. */}
          {otpError && <GeneralError id="otp-mobile-error">{otpError}</GeneralError>}

          {/* Submit Button — same spinner-carries-progress rule as above. */}
          <Button
            type="submit"
            size="large"
            fullWidth
            loading={isOtpPending}
            disabled={!isValidOtpMobile || isOtpPending}
          >
            ارسال کد تأیید
          </Button>
        </form>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 border-t border-divider pt-2">
        <Link
          href="/auth/register"
          className="inline-flex min-h-11 items-center rounded-small px-1 text-body-2 font-medium text-primary-700 transition-colors hover:text-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          هنوز حساب ندارید؟ ثبت‌نام کنید
        </Link>
        <Link
          href="/auth/forgot-password"
          className="inline-flex min-h-11 items-center rounded-small px-1 text-body-2 text-neutral-500 transition-colors hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          بازیابی رمز عبور
        </Link>
      </div>
      <p className="mt-2 text-center text-caption leading-6 text-neutral-500">
        با ورود، شرایط استفاده و حریم خصوصی را می‌پذیرم
      </p>
    </div>
  );
}
