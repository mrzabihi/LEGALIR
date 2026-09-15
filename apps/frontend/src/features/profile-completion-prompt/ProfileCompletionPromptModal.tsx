// ============================================================
// LEGALIR — Profile Completion Incentive Modal
// ============================================================
// A premium, non-blocking dialog shown on the authenticated
// Dashboard when the user's profile is incomplete and the prompt
// has not been explicitly suppressed.
//
// Actions (distinct, never merged):
//   - انصراف                    → close only (no persistence)
//   - تکمیل پروفایل              → navigate to /profile
//   - دیگر این پیام را نشان نده  → persist per-user preference
// ============================================================

"use client";

import { Dialog, Button } from "@legalir/ui";
import { pointsForEvent } from "@/lib/rewards";
import type { ProfileCompletionPromptController } from "./useProfileCompletionPrompt";

interface Props {
  controller: ProfileCompletionPromptController;
}

export function ProfileCompletionPromptModal({ controller }: Props) {
  const { open, saving, error, cancel, goToProfile, suppress, retry } = controller;

  // Real, product-backed reward value (PROFILE_COMPLETED = 1000).
  const rewardPoints = pointsForEvent("PROFILE_COMPLETED");

  return (
    <Dialog
      open={open}
      onClose={cancel}
      maxWidth="sm"
      title="پروفایلت رو کامل کن"
      description="با تکمیل پروفایل، امتیاز بیشتری می‌گیری و به مزایای بیشتری برای استفاده از قابلیت‌های لیگالیر دسترسی پیدا می‌کنی."
      actions={
        <>
          <Button variant="text" onClick={cancel} disabled={saving}>
            انصراف
          </Button>
          <Button
            variant="filled"
            onClick={goToProfile}
            disabled={saving}
            className="!bg-white !text-primary-800 hover:!bg-neutral-100 shadow-elevation-1"
          >
            تکمیل پروفایل
          </Button>
        </>
      }
    >
      {/* Close (exit) button — top-left of the card, red */}
      <button
        type="button"
        onClick={cancel}
        disabled={saving}
        aria-label="بستن"
        className="absolute top-3 left-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-error/30 bg-error/5 text-error shadow-elevation-1 hover:bg-error/15 hover:border-error/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 transition-colors disabled:opacity-50 touch-target"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Reward incentive — hero card (self-contained gold gradient, works in both themes) */}
      <div className="relative overflow-hidden rounded-large bg-gradient-to-br from-secondary-500 via-secondary-600 to-secondary-700 p-5 text-white shadow-elevation-3">
        {/* Decorative glow accents */}
        <div className="pointer-events-none absolute -top-8 -left-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-10 -right-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />

        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-medium bg-white/15 ring-1 ring-white/25">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-h2 font-bold leading-none drop-shadow-sm">
              {rewardPoints.toLocaleString("fa-IR")} امتیاز
            </p>
            <p className="mt-1.5 text-caption text-white/85">
              با تکمیل کامل پروفایل، این امتیاز به حساب تو اضافه می‌شود.
            </p>
          </div>
        </div>
      </div>

      {/* Suppress action — persists a per-user preference */}
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={suppress}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-medium px-2 py-1 text-caption text-muted hover:text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
          دیگر این پیام را به من نشان نده
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-medium bg-error-container border border-error/20 px-3 py-2">
          <p className="text-caption text-error">
            ذخیره‌ی تنظیمات انجام نشد.
          </p>
          <Button variant="text" size="small" onClick={retry}>
            تلاش دوباره
          </Button>
        </div>
      )}
    </Dialog>
  );
}
