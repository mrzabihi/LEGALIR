// ============================================================
// LEGALIR — Auth Hooks
// ============================================================
// React hooks for authentication operations.
// Builds on the auth store and auth API client.
// ============================================================

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import {
  requestOtpApi,
  verifyOtpApi,
  logoutApi,
  registerApi,
  passwordLoginApi,
  forgotPasswordRequestApi,
  forgotPasswordVerifyApi,
  resetPasswordApi,
  normalizeMobile,
} from "./api";
import type { OtpRequestResult } from "./otp-provider";
import type { RegistrationIntent } from "@legalir/types";

// ============================================================
// useRequestOtp
// ============================================================

interface UseRequestOtpReturn {
  requestOtp: (mobile: string) => Promise<OtpRequestResult | null>;
  isPending: boolean;
  error: string | null;
}

export function useRequestOtp(): UseRequestOtpReturn {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestOtp = useCallback(async (rawMobile: string): Promise<OtpRequestResult | null> => {
    setError(null);

    const mobile = normalizeMobile(rawMobile);
    if (!mobile) {
      setError("شماره موبایل معتبر نیست. لطفاً با ۰۹ وارد کنید");
      return null;
    }

    setIsPending(true);
    try {
      const response = await requestOtpApi(mobile);
      return {
        challengeId: response.data.challengeId,
        expiresAt: response.data.expiresAt,
        remainingAttempts: response.data.remainingAttempts,
        resendCooldownSeconds: response.data.resendCooldownSeconds,
      };
    } catch (err: unknown) {
      const apiErr = err as { code?: string; message?: string };
      if (apiErr?.code === "RATE_LIMITED") {
        setError("تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی صبر کنید");
      } else if (apiErr?.code === "INVALID_MOBILE") {
        setError("شماره موبایل معتبر نیست");
      } else {
        setError(apiErr?.message ?? "خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید");
      }
      return null;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { requestOtp, isPending, error };
}


// Intent-to-route mapping
const INTENT_ROUTE_MAP: Record<string, string> = {
  chat: "/chat",
  document: "/documents",
  contract: "/new",
  subscribe: "/subscription",
  support: "/chat",
};

function resolveIntendedRoute(intendedRoute: string | null): string {
  if (!intendedRoute) return "/dashboard";
  if (intendedRoute.startsWith("/")) return intendedRoute;
  return INTENT_ROUTE_MAP[intendedRoute] ?? "/dashboard";
}

// ============================================================
// useVerifyOtp
// ============================================================

interface UseVerifyOtpReturn {
  verifyOtp: (challengeId: string, code: string) => Promise<boolean>;
  isPending: boolean;
  error: string | null;
  attemptsLeft: number;
}

export function useVerifyOtp(): UseVerifyOtpReturn {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const intendedRoute = useAuthStore((s) => s.intendedRoute);
  const setIntendedRoute = useAuthStore((s) => s.setIntendedRoute);

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(5);

  const verifyOtp = useCallback(
    async (challengeId: string, code: string): Promise<boolean> => {
      // Client-side validation
      if (code.length !== 6 || !/^\d{6}$/.test(code)) {
        setError("کد تأیید باید ۶ رقم باشد");
        return false;
      }

      setError(null);
      setIsPending(true);

      try {
        const response = await verifyOtpApi(challengeId, code);

        setSession({
          sessionId: response.data.sessionId,
          userId: response.data.user.id,
          mobileE164: response.data.user.mobileE164,
          mobileDisplay: response.data.user.mobileDisplay,
          isNewUser: response.data.isNewUser,
          createdAt: Date.now(),
        });

        // Determine redirect target
        const target = resolveIntendedRoute(intendedRoute);
        setIntendedRoute(null);

        router.push(target);
        return true;
      } catch (err: unknown) {
        const apiErr = err as { code?: string; message?: string };

        switch (apiErr?.code) {
          case "OTP_INVALID": {
            const remaining = Math.max(0, attemptsLeft - 1);
            setAttemptsLeft(remaining);
            if (remaining <= 0) {
              setError("تعداد تلاش بیش از حد. لطفاً ۵ دقیقه صبر کنید");
            } else {
              setError(`کد واردشده صحیح نیست. ${remaining} تلاش باقی‌مانده`);
            }
            break;
          }
          case "OTP_EXPIRED":
            setError("زمان کد به پایان رسیده است. لطفاً کد جدید درخواست کنید");
            break;
          case "OTP_REUSED":
            setError("این کد قبلاً استفاده شده است");
            break;
          case "TOO_MANY_ATTEMPTS":
            setError("تعداد تلاش بیش از حد. لطفاً ۵ دقیقه صبر کنید");
            break;
          case "RATE_LIMITED":
            setError("تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی صبر کنید");
            break;
          default:
            setError(apiErr?.message ?? "خطا در تأیید کد. لطفاً دوباره تلاش کنید");
        }
        return false;
      } finally {
        setIsPending(false);
      }
    },
    [attemptsLeft, intendedRoute, router, setIntendedRoute, setSession]
  );

  return { verifyOtp, isPending, error, attemptsLeft };
}

// ============================================================
// useLogout
// ============================================================

interface UseLogoutReturn {
  logout: () => Promise<void>;
  isPending: boolean;
}

export function useLogout(): UseLogoutReturn {
  const router = useRouter();
  const clearSession = useAuthStore((s) => s.clearSession);
  const [isPending, setIsPending] = useState(false);

  const logout = useCallback(async () => {
    setIsPending(true);
    try {
      await logoutApi();
    } catch {
      // Proceed with local logout even if API fails
    }
    clearSession();
    setIsPending(false);
    router.push("/auth/mobile");
  }, [clearSession, router]);

  return { logout, isPending };
}

// ============================================================
// useRegister
// ============================================================

interface UseRegisterReturn {
  register: (
    mobile: string,
    password: string,
    acceptTerms: boolean,
    intent?: RegistrationIntent
  ) => Promise<boolean>;
  isPending: boolean;
  error: string | null;
}

export function useRegister(): UseRegisterReturn {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const intendedRoute = useAuthStore((s) => s.intendedRoute);
  const setIntendedRoute = useAuthStore((s) => s.setIntendedRoute);

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(
    async (
      rawMobile: string,
      password: string,
      acceptTerms: boolean,
      intent: RegistrationIntent = "PERSONAL"
    ): Promise<boolean> => {
      setError(null);

      const mobile = normalizeMobile(rawMobile);
      if (!mobile) {
        setError("شماره موبایل معتبر نیست. لطفاً با ۰۹ وارد کنید");
        return false;
      }

      if (!password || password.length < 6) {
        setError("رمز عبور باید حداقل ۶ کاراکتر باشد");
        return false;
      }

      if (!acceptTerms) {
        setError("پذیرش شرایط استفاده الزامی است");
        return false;
      }

      setIsPending(true);
      try {
        const response = await registerApi({
          mobile,
          password,
          acceptTerms,
          registrationIntent: intent,
        });

        setSession({
          sessionId: response.data.sessionId,
          userId: response.data.user.id,
          mobileE164: response.data.user.mobileE164,
          mobileDisplay: response.data.user.mobileDisplay,
          isNewUser: response.data.isNewUser,
          createdAt: Date.now(),
        });

        // A brand-new account always enters onboarding; the server decides
        // the exact step. An explicit intended route (deep link) wins.
        const target = intendedRoute
          ? resolveIntendedRoute(intendedRoute)
          : "/onboarding";
        setIntendedRoute(null);
        router.push(target);
        return true;
      } catch (err: unknown) {
        const apiErr = err as { code?: string; message?: string; fieldErrors?: { path: string; reason: string }[] };
        if (apiErr?.fieldErrors?.length) {
          setError(apiErr.fieldErrors[0]?.reason ?? "خطا در ثبت‌نام. لطفاً دوباره تلاش کنید");
        } else if (apiErr?.code === "MOBILE_EXISTS") {
          setError("این شماره موبایل قبلاً ثبت‌نام شده است");
        } else if (apiErr?.code === "RATE_LIMITED") {
          setError("تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی صبر کنید");
        } else {
          setError(apiErr?.message ?? "خطا در ثبت‌نام. لطفاً دوباره تلاش کنید");
        }
        return false;
      } finally {
        setIsPending(false);
      }
    },
    [intendedRoute, router, setIntendedRoute, setSession]
  );

  return { register, isPending, error };
}

// ============================================================
// usePasswordLogin
// ============================================================

interface UsePasswordLoginReturn {
  login: (mobile: string, password: string) => Promise<boolean>;
  isPending: boolean;
  error: string | null;
}

export function usePasswordLogin(): UsePasswordLoginReturn {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const intendedRoute = useAuthStore((s) => s.intendedRoute);
  const setIntendedRoute = useAuthStore((s) => s.setIntendedRoute);

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (rawMobile: string, password: string): Promise<boolean> => {
      setError(null);

      const mobile = normalizeMobile(rawMobile);
      if (!mobile) {
        setError("شماره موبایل معتبر نیست. لطفاً با ۰۹ وارد کنید");
        return false;
      }

      if (!password || password.length < 6) {
        setError("رمز عبور باید حداقل ۶ کاراکتر باشد");
        return false;
      }

      setIsPending(true);
      try {
        const response = await passwordLoginApi({ mobile, password });

        setSession({
          sessionId: response.data.sessionId,
          userId: response.data.user.id,
          mobileE164: response.data.user.mobileE164,
          mobileDisplay: response.data.user.mobileDisplay,
          isNewUser: response.data.isNewUser,
          createdAt: Date.now(),
        });

        const target = resolveIntendedRoute(intendedRoute);
        setIntendedRoute(null);
        router.push(target);
        return true;
      } catch (err: unknown) {
        const apiErr = err as { code?: string; message?: string };
        switch (apiErr?.code) {
          case "INVALID_CREDENTIALS":
            setError("شماره موبایل یا رمز عبور اشتباه است");
            break;
          case "ACCOUNT_LOCKED":
            setError("حساب کاربری شما قفل شده است. لطفاً بعداً تلاش کنید");
            break;
          case "RATE_LIMITED":
            setError("تعداد تلاش‌های ناموفق بیش از حد. لطفاً کمی صبر کنید");
            break;
          default:
            setError(apiErr?.message ?? "خطا در ورود. لطفاً دوباره تلاش کنید");
        }
        return false;
      } finally {
        setIsPending(false);
      }
    },
    [intendedRoute, router, setIntendedRoute, setSession]
  );

  return { login, isPending, error };
}

// ============================================================
// useForgotPassword
// ============================================================

interface ForgotPasswordStep1Return {
  requestOtpForReset: (mobile: string) => Promise<{ challengeId: string; expiresAt: string } | null>;
  isPending: boolean;
  error: string | null;
}

export function useForgotPasswordRequest(): ForgotPasswordStep1Return {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestOtpForReset = useCallback(async (rawMobile: string) => {
    setError(null);

    const mobile = normalizeMobile(rawMobile);
    if (!mobile) {
      setError("شماره موبایل معتبر نیست. لطفاً با ۰۹ وارد کنید");
      return null;
    }

    setIsPending(true);
    try {
      const response = await forgotPasswordRequestApi(mobile);
      return {
        challengeId: response.data.challengeId,
        expiresAt: response.data.expiresAt,
      };
    } catch (err: unknown) {
      const apiErr = err as { code?: string; message?: string };
      if (apiErr?.code === "USER_NOT_FOUND") {
        setError("کاربری با این شماره موبایل یافت نشد");
      } else if (apiErr?.code === "RATE_LIMITED") {
        setError("تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی صبر کنید");
      } else {
        setError(apiErr?.message ?? "خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید");
      }
      return null;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { requestOtpForReset, isPending, error };
}

interface ForgotPasswordStep2Return {
  verifyResetOtp: (challengeId: string, code: string) => Promise<string | null>;
  isPending: boolean;
  error: string | null;
}

export function useForgotPasswordVerify(): ForgotPasswordStep2Return {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyResetOtp = useCallback(async (challengeId: string, code: string): Promise<string | null> => {
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError("کد تأیید باید ۶ رقم باشد");
      return null;
    }

    setError(null);
    setIsPending(true);
    try {
      const response = await forgotPasswordVerifyApi({ challengeId, code });
      return response.data.resetToken;
    } catch (err: unknown) {
      const apiErr = err as { code?: string; message?: string };
      switch (apiErr?.code) {
        case "OTP_INVALID":
          setError("کد واردشده صحیح نیست");
          break;
        case "OTP_EXPIRED":
          setError("زمان کد به پایان رسیده است. لطفاً کد جدید درخواست کنید");
          break;
        default:
          setError(apiErr?.message ?? "خطا در تأیید کد. لطفاً دوباره تلاش کنید");
      }
      return null;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { verifyResetOtp, isPending, error };
}

interface ForgotPasswordStep3Return {
  resetPassword: (resetToken: string, password: string) => Promise<boolean>;
  isPending: boolean;
  error: string | null;
}

export function useResetPassword(): ForgotPasswordStep3Return {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetPassword = useCallback(async (resetToken: string, password: string): Promise<boolean> => {
    setError(null);
    setIsPending(true);
    try {
      await resetPasswordApi({ resetToken, password });
      return true;
    } catch (err: unknown) {
      const apiErr = err as { code?: string; message?: string };
      if (apiErr?.code === "INVALID_TOKEN") {
        setError("لینک بازیابی منقضی شده است. لطفاً دوباره درخواست کنید");
      } else if (apiErr?.code === "WEAK_PASSWORD") {
        setError("رمز عبور ضعیف است. لطفاً از ترکیب حروف و اعداد استفاده کنید");
      } else {
        setError(apiErr?.message ?? "خطا در تغییر رمز. لطفاً دوباره تلاش کنید");
      }
      return false;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { resetPassword, isPending, error };
}

// ============================================================
// Password validation helpers
// ============================================================

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
}

export function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.match(/[A-Za-z]/) && password.match(/[0-9]/)) score++;
  if (password.match(/[^A-Za-z0-9]/)) score++;
  if (password.length >= 12) score++;

  const strengthMap: Record<number, PasswordStrength> = {
    0: { score: 0, label: "بسیار ضعیف", color: "#B42318" },
    1: { score: 1, label: "ضعیف", color: "#B7791F" },
    2: { score: 2, label: "متوسط", color: "#B7791F" },
    3: { score: 3, label: "خوب", color: "#2563EB" },
    4: { score: 4, label: "قوی", color: "#1F6F50" },
  };

  const result = strengthMap[score];
  if (result) return result;
  return strengthMap[0]!;
}

export function validatePassword(password: string): string | null {
  if (!password) return "رمز عبور الزامی است";
  if (password.length < 6) return "رمز عبور باید حداقل ۶ کاراکتر باشد";
  if (password.length > 128) return "رمز عبور نمی‌تواند بیش از ۱۲۸ کاراکتر باشد";
  return null;
}

export function validateMobile(rawMobile: string): string | null {
  if (!rawMobile.trim()) return "شماره موبایل الزامی است";
  if (!normalizeMobile(rawMobile)) return "شماره موبایل معتبر نیست. لطفاً با ۰۹ وارد کنید";
  return null;
}

// ============================================================
// useAuth — convenience hook for session state
// ============================================================

export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  return {
    session,
    isAuthenticated: isAuthenticated(),
    isLoading,
    isNewUser: session?.isNewUser ?? false,
  };
}
