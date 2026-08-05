// ============================================================
// LEGALIR — Global Error Conventions
// ============================================================

import type { ReactNode } from "react";

// --- Error display card ---

export interface ErrorDisplayProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  children?: ReactNode;
}

export function ErrorDisplay({
  title = "خطا در دریافت اطلاعات",
  message,
  onRetry,
  children,
}: ErrorDisplayProps) {
  return (
    <div
      role="alert"
      className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <div className="rounded-large bg-surface p-8 shadow-elevation-4 max-w-md">
        <div className="text-error mb-4 text-4xl" aria-hidden="true">
          !
        </div>
        <h2 className="text-h3 text-on-surface mb-2">{title}</h2>
        <p className="text-body-2 text-muted mb-6">{message}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded-medium bg-primary px-6 py-3 text-white font-button hover:opacity-90 transition-opacity touch-target"
            >
              تلاش مجدد
            </button>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

// --- Empty state ---

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = " ", title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-5xl text-muted" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-h3 text-on-surface">{title}</h3>
      <p className="text-body-2 text-muted max-w-sm">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-medium bg-primary px-6 py-3 text-white font-button hover:opacity-90 transition-opacity touch-target mt-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
