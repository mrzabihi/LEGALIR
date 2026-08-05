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
import { requestOtpApi, verifyOtpApi, logoutApi, normalizeMobile } from "./api";
import type { OtpRequestResult } from "./otp-provider";

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
        const target = intendedRoute ?? "/dashboard";
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
