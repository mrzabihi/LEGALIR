"use client";

// ============================================================
// LEGALIR — Registration Step 2 of 2: create the account
// ============================================================
// The existing registration form, reused unchanged. The track chosen in
// step 1 arrives as `?type=` and is validated against the allow-list; an
// unknown/missing value sends the user back to the selection page.
//
// The form is one flow with two labelled sections — «شماره موبایل» and
// «رمز عبور» — rather than a synthetic multi-page wizard: the account is
// created by a single `register()` call, so splitting it further would
// invent steps the backend does not have. Each section has its own heading
// and guidance line, and the step indicator continues the count from step 1.
//
// Validation rules, messages, touched-field semantics and the submit payload
// are unchanged. What moved is where each message *renders*: errors now go to
// the field that produced them (`errorMessage` → `aria-invalid` +
// `aria-describedby`) instead of a detached alert box, and the terms error
// stays on the checkbox group it belongs to.

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TextField, PasswordField, Checkbox, Button } from "@legalir/ui";
import { useRegister, getPasswordStrength } from "@/lib/auth/use-auth";
import { normalizeMobile, MOBILE_ERROR_MESSAGE } from "@/lib/auth/api";
import {
  normalizeRegistrationIntent,
  REGISTRATION_INTENT_FA,
  type RegistrationIntent,
} from "@legalir/types";
import { toPersianDigits } from "@/lib/persian-utils";

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
  if (!normalizeMobile(rawMobile)) return MOBILE_ERROR_MESSAGE;
  return null;
}

function validatePasswordField(password: string): string | null {
  if (!password) return "رمز عبور الزامی است";
  if (password.length < 6) return "رمز عبور باید حداقل ۶ کاراکتر باشد";
  if (password.length > 128) return "رمز عبور نمی‌تواند بیش از ۱۲۸ کاراکتر باشد";
  return null;
}

/** Iran flag + `۹۸+`, shared with the login screen's phone field. */
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

export default function RegisterAccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, isPending, error: apiError } = useRegister();

  // The intent is untrusted URL state — normalize it. An invalid value
  // bounces the user back to the selection page.
  const rawType = searchParams.get("type");
  const intent: RegistrationIntent | null = normalizeRegistrationIntent(rawType);

  useEffect(() => {
    if (!intent) router.replace("/auth/register");
  }, [intent, router]);

  // Persist the chosen track so a refresh (or a return from the login page)
  // keeps the user on the same path. This is UI state only — the server
  // re-validates the intent from the query param on submit.
  useEffect(() => {
    if (intent) sessionStorage.setItem("legalir-signup-type", intent);
  }, [intent]);

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
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
    await register(normalized, password, acceptTerms, intent ?? "PERSONAL");
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

  if (!intent) return null;

  return (
    <div className="rounded-large border border-divider bg-surface p-5 shadow-elevation-8 tablet:p-8">
      {/* Step indicator — step 2 of the real two-step registration flow. */}
      <p className="mb-4 text-center text-caption text-neutral-500">
        گام {toPersianDigits(2)} از {toPersianDigits(2)}
      </p>

      {/* Header + the chosen track, with the way back to change it. */}
      <div className="mb-6 text-center">
        <h1 className="text-h2 text-neutral-900">ایجاد حساب کاربری</h1>
        <p className="mt-2 text-body-2 text-neutral-500">
          مسیر انتخابی:{" "}
          <span className="font-medium text-primary-700">
            {REGISTRATION_INTENT_FA[intent]}
          </span>
        </p>
        <button
          type="button"
          onClick={() => router.push("/auth/register")}
          className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-small px-2 text-caption text-neutral-500 transition-colors hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
          تغییر نوع حساب
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* ---- Section 1: the phone number ---- */}
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-1 w-full p-0 text-labelLarge text-neutral-900">
            شماره موبایل
          </legend>
          <p className="mb-2 text-caption leading-6 text-neutral-500">
            شماره موبایل شما نام کاربری حساب است.
          </p>

          <TextField
            id="mobile"
            name="mobile"
            label="شماره موبایل"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={mobile}
            onChange={handleMobileChange}
            onBlur={() => touchField("mobile")}
            errorMessage={fieldErrors.mobile}
            fullWidth
            inputDir="ltr"
            disabled={isPending}
            autoFocus
            leadingIcon={<IranPrefix />}
          />
        </fieldset>

        {/* ---- Section 2: the password ---- */}
        <fieldset className="m-0 mt-6 min-w-0 border-0 p-0">
          <legend className="mb-1 w-full p-0 text-labelLarge text-neutral-900">
            رمز عبور
          </legend>
          <p className="mb-2 text-caption leading-6 text-neutral-500">
            دست‌کم ۶ کاراکتر — تکرار آن را در فیلد دوم وارد کنید.
          </p>

          <div className="space-y-3">
            <div>
              <PasswordField
                id="password"
                name="password"
                label="رمز عبور"
                autoComplete="new-password"
                value={password}
                onChange={handlePasswordChange}
                onBlur={() => touchField("password")}
                errorMessage={fieldErrors.password}
                fullWidth
                disabled={isPending}
              />

              {/* Password Strength Meter — four segments, label in words so
                  the meaning never depends on the colour alone. */}
              {password.length > 0 && (
                <div className="mt-1 space-y-1.5">
                  <div className="flex gap-1" dir="ltr" aria-hidden="true">
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
            </div>

            <PasswordField
              id="confirmPassword"
              name="confirmPassword"
              label="تکرار رمز عبور"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              onBlur={() => touchField("confirmPassword")}
              errorMessage={fieldErrors.confirmPassword}
              fullWidth
              disabled={isPending}
            />
          </div>
        </fieldset>

        {/* ---- Consent ---- */}
        <div className="mt-5">
          <div className="flex items-start gap-2">
            <Checkbox
              id="accept-terms"
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                if (e.target.checked) clearFieldError("terms");
              }}
              aria-describedby={fieldErrors.terms ? "terms-error" : undefined}
              aria-invalid={!!fieldErrors.terms}
              disabled={isPending}
              // The box's own <label> is only as wide as the 20px visual, so
              // it needed a 44px band of its own — the pad paints one without
              // moving the box or the sentence beside it.
              className="mt-0.5 touch-target-pad"
            />
            {/* A second <label> for the same control, so clicking the sentence
                toggles the box. The two links stay navigable: interactive
                descendants do not trigger label activation. */}
            <label
              htmlFor="accept-terms"
              className="cursor-pointer select-none text-body-2 leading-7 text-neutral-600"
            >
              {/* These two links sit inside a sentence, so they keep the
                  inline box that lets the sentence wrap. `.touch-target-pad`
                  paints a 44px-tall invisible overlay over each one instead of
                  growing the line — the tap area meets the target-size floor
                  without the underline drifting away from its words. */}
              با ثبت‌نام،{" "}
              <Link
                href="/terms"
                className="touch-target-pad text-primary-700 underline underline-offset-2 transition-colors hover:text-primary-800"
              >
                شرایط استفاده
              </Link>{" "}
              و{" "}
              <Link
                href="/privacy-policy"
                className="touch-target-pad text-primary-700 underline underline-offset-2 transition-colors hover:text-primary-800"
              >
                حریم خصوصی
              </Link>{" "}
              را می‌پذیرم
            </label>
          </div>
          {fieldErrors.terms && (
            <p id="terms-error" className="mt-1 text-caption text-error" role="alert">
              {fieldErrors.terms}
            </p>
          )}
        </div>

        {/* API Error */}
        {displayApiError && (
          <div
            className="mt-4 flex items-start gap-2 rounded-medium bg-error-container px-4 py-3 text-body-2 text-error"
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
            <span>{displayApiError}</span>
          </div>
        )}

        {/* Submit Button — the spinner carries progress, the label stays
            the action's name so it never reads as a different verb. */}
        <Button
          type="submit"
          size="large"
          fullWidth
          loading={isPending}
          disabled={!isFormValid || isPending}
          className="mt-5"
        >
          ثبت‌نام
        </Button>

        {/* Link to Login */}
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-1 text-center text-body-2 text-neutral-500">
          قبلاً ثبت‌نام کرده‌اید؟
          <Link
            href="/auth/mobile"
            className="inline-flex min-h-11 items-center rounded-small px-1 font-medium text-primary-700 underline underline-offset-2 transition-colors hover:text-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            ورود به حساب کاربری
          </Link>
        </p>
      </form>
    </div>
  );
}
