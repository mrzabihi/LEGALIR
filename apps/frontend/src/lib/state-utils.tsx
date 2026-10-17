// ============================================================
// LEGALIR — Phase 12: Unified State Utilities
// Empty, Loading, Error, Forbidden, Offline, Retry states
// ============================================================

import type { ReactNode } from "react";
import { Button } from "@legalir/ui";

// --- Offline State ---

export function OfflineState() {
  return (
    <div
      role="alert"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <div className="rounded-large bg-surface p-8 shadow-elevation-4 max-w-md">
        <div className="text-5xl mb-4" aria-hidden="true">
          &#x1F4E1;
        </div>
        <h2 className="text-h2 text-on-surface mb-2">
          اتصال اینترنت قطع است
        </h2>
        <p className="text-body-2 text-muted mb-6">
          لطفاً اتصال اینترنت خود را بررسی کنید و دوباره تلاش کنید
        </p>
        <Button onClick={() => window.location.reload()}>تلاش مجدد</Button>
      </div>
    </div>
  );
}

// --- Forbidden State ---

export interface ForbiddenStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ForbiddenState({
  title = "دسترسی محدود",
  message = "شما دسترسی لازم برای مشاهده این بخش را ندارید. لطفاً اشتراک خود را ارتقا دهید.",
  actionLabel,
  onAction,
}: ForbiddenStateProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-large bg-surface p-8 shadow-elevation-4 max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning-container flex items-center justify-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            className="text-warning"
            aria-hidden="true"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
              fill="currentColor"
            />
          </svg>
        </div>
        <h2 className="text-h2 text-on-surface mb-2">{title}</h2>
        <p className="text-body-2 text-muted mb-6">{message}</p>
        {actionLabel && onAction && <Button onClick={onAction}>{actionLabel}</Button>}
      </div>
    </div>
  );
}

// --- Generic Not Found State ---

export interface NotFoundStateProps {
  title?: string;
  message?: string;
}

export function NotFoundState({
  title = "صفحه یافت نشد",
  message = "متأسفانه صفحه مورد نظر شما در سیستم موجود نیست. لطفاً مسیر دیگری را امتحان کنید.",
}: NotFoundStateProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-large bg-surface p-8 shadow-elevation-4 max-w-md">
        <div className="text-5xl mb-4 text-muted" aria-hidden="true">
          ۴۰۴
        </div>
        <h2 className="text-h2 text-on-surface mb-2">{title}</h2>
        <p className="text-body-2 text-muted">{message}</p>
      </div>
    </div>
  );
}

// --- Skeleton Page (generic loading grid) ---

export function SkeletonPageGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="p-4 tablet:p-6 max-w-6xl mx-auto" aria-busy="true" aria-label="در حال بارگذاری">
      <div className="h-8 w-48 rounded-medium bg-surface-container mb-6 animate-pulse" />
      <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="rounded-large border border-divider bg-surface p-6 animate-pulse"
          >
            <div className="mb-3 h-5 w-24 rounded-small bg-surface-container" />
            <div className="mb-2 h-4 w-full rounded-small bg-surface-container" />
            <div className="mb-2 h-4 w-3/4 rounded-small bg-surface-container" />
            <div className="h-4 w-1/2 rounded-small bg-surface-container" />
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Skeleton List (for list pages) ---

export function SkeletonPageList({ count = 5 }: { count?: number }) {
  return (
    <div className="p-4 tablet:p-6 max-w-4xl mx-auto" aria-busy="true" aria-label="در حال بارگذاری">
      <div className="h-8 w-48 rounded-medium bg-surface-container mb-6 animate-pulse" />
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="rounded-large border border-divider bg-surface p-5 animate-pulse"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-surface-container shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-5 bg-surface-container rounded w-2/3" />
                <div className="h-4 bg-surface-container rounded w-1/3" />
                <div className="h-4 bg-surface-container rounded w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Retry Banner (inline) ---

export interface RetryBannerProps {
  message: string;
  onRetry: () => void;
}

export function RetryBanner({ message, onRetry }: RetryBannerProps) {
  return (
    <div
      role="alert"
      className="rounded-large bg-error-container border border-error p-4 flex items-center justify-between gap-4"
    >
      <p className="text-body-2 text-error">{message}</p>
      {/* A retry inside an error banner is the recovery action, not a
          destructive one — `filled` keeps the brand recovery language while
          the surrounding banner carries the error colour. */}
      <Button onClick={onRetry} size="small" className="shrink-0">
        تلاش مجدد
      </Button>
    </div>
  );
}

// --- Route Wrapper: combines all state handling ---

export interface RouteStateWrapperProps {
  isLoading?: boolean;
  isError?: boolean;
  isForbidden?: boolean;
  isEmpty?: boolean;
  errorMessage?: string;
  forbiddenMessage?: string;
  onRetry?: () => void;
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode;
  emptyFallback?: ReactNode;
  forbiddenFallback?: ReactNode;
  children: ReactNode;
}

export function RouteStateWrapper({
  isLoading,
  isError,
  isForbidden,
  isEmpty,
  errorMessage = "خطا در دریافت اطلاعات. لطفاً دوباره تلاش کنید.",
  forbiddenMessage,
  onRetry,
  loadingFallback,
  errorFallback,
  emptyFallback,
  forbiddenFallback,
  children,
}: RouteStateWrapperProps) {
  if (isLoading) {
    return loadingFallback ?? <SkeletonPageGrid />;
  }

  if (isForbidden) {
    return forbiddenFallback ?? (
      <ForbiddenState message={forbiddenMessage} />
    );
  }

  if (isError) {
    if (errorFallback) return <>{errorFallback}</>;
    return (
      <div className="p-4 tablet:p-6">
        <RetryBanner message={errorMessage} onRetry={onRetry ?? (() => undefined)} />
      </div>
    );
  }

  if (isEmpty) {
    return emptyFallback ? <>{emptyFallback}</> : <>{children}</>;
  }

  return <>{children}</>;
}
