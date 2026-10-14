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
//
// Visual language (MD3):
//   - Dismiss is a standard (neutral) icon button at the top-end —
//     never an error-red control, which would signal "danger".
//   - The reward sits on the gold `secondary-container` tonal role so it
//     stays legible in both themes; the coin badge is a gold fill with a
//     dark-teal glyph (both fixed brand tokens) for a stable, on-brand
//     accent that never washes out in dark mode.
// ============================================================

"use client";

import { Dialog, Button, IconButton } from "@legalir/ui";
import { IconClose, IconCoin } from "@/lib/icons";
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
          <Button variant="filled" onClick={goToProfile} disabled={saving}>
            تکمیل پروفایل
          </Button>
        </>
      }
    >
      {/* Dismiss — standard (neutral) icon button, top-end. Neutral, because
          this is a routine dismissal, not a destructive action. */}
      <IconButton
        variant="standard"
        size="small"
        label="بستن"
        onClick={cancel}
        disabled={saving}
        className="absolute left-3 top-3 z-10"
      >
        <IconClose />
      </IconButton>

      {/* Reward incentive — tonal card on the gold `secondary-container` role.
          Text/icon run on `on-secondary-container`, so the block reads on the
          warm light surface *and* the deep warm surface in dark mode. */}
      <div className="relative overflow-hidden rounded-large bg-secondary-container p-5 text-on-secondary-container">
        <div className="relative flex items-center gap-4">
          {/* Coin badge — gold fill + dark-teal glyph (fixed brand tokens). */}
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-medium bg-[var(--brand-gold)] text-[var(--brand-teal)] shadow-elevation-1">
            <IconCoin size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-h2 font-bold leading-none tabular-nums">
              {rewardPoints.toLocaleString("fa-IR")} امتیاز
            </p>
            <p className="mt-1.5 text-caption opacity-80">
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
          className="inline-flex items-center gap-1.5 rounded-medium px-3 py-2 text-caption text-muted transition-colors hover:bg-surface-hover hover:text-on-surface disabled:opacity-50"
        >
          دیگر این پیام را به من نشان نده
        </button>
      </div>

      {/* Error state — role="alert" so screen readers announce a failed save. */}
      {error && (
        <div
          role="alert"
          className="mt-3 flex items-center justify-between gap-2 rounded-medium border border-error bg-error-container px-3 py-2"
        >
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
