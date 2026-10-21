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
//   - Dismiss is a standard (neutral) icon button in the Dialog's header
//     slot — on the title row, in the top corner, outside the scrolling
//     body. It can neither scroll away nor sit on top of any content.
//     Never an error-red control, which would signal "danger".
//   - The reward is one flat tonal card on the gold `secondary-container`
//     role: a coin mark beside the headline figure, no shadow, no
//     ornament. The coin is a gold fill with a dark-teal glyph (both fixed
//     brand tokens), so it never washes out in dark mode.
//   - The suppress action is a real checkbox row — the whole row is the
//     label/target — so it reads as a choice rather than as a third
//     competing button, while still running the exact same persist action.
// ============================================================

"use client";

import { Dialog, Button, IconButton, Checkbox } from "@legalir/ui";
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
      // A read-only incentive prompt: focus the dialog itself so its title is
      // announced, instead of parking a focus ring on the close button the
      // moment it appears. Tab still moves into the controls normally.
      initialFocus="container"
      title="پروفایلت رو کامل کن"
      description="با تکمیل پروفایل، امتیاز بیشتری می‌گیری و به مزایای بیشتری برای استفاده از قابلیت‌های لیگالیر دسترسی پیدا می‌کنی."
      closeButton={
        // MD3 standard: a 24px glyph in a 48px round target. Pulled into the
        // corner so its optical centre lines up with the title's, not with
        // the header block's. Neutral, never error-red: dismissing a hint is
        // a routine action, not a destructive one.
        <IconButton
          variant="standard"
          size="medium"
          label="بستن"
          onClick={cancel}
          disabled={saving}
          className="-me-2 -mt-2"
        >
          <IconClose />
        </IconButton>
      }
      actions={
        <>
          {/* On touch-sized viewports the two actions split the footer evenly,
              so neither becomes a narrow target. Desktop keeps the compact
              trailing pair (secondary first, primary last in RTL flow). */}
          <Button variant="text" onClick={cancel} disabled={saving} className="max-desktop:flex-1">
            انصراف
          </Button>
          <Button
            variant="filled"
            onClick={goToProfile}
            disabled={saving}
            className="max-desktop:flex-1"
          >
            تکمیل پروفایل
          </Button>
        </>
      }
    >
      {/* Reward incentive — tonal card on the gold `secondary-container` role.
          Text/icon run on `on-secondary-container`, so the block reads on the
          warm light surface *and* the deep warm surface in dark mode.
          The figure and its coin mark share one row, so the mark is literally
          beside the number; the caption spans the card underneath instead of
          competing with the headline for a narrow column. */}
      <div className="rounded-large bg-secondary-container px-4 py-3.5 text-on-secondary-container">
        <div className="flex items-center gap-2.5">
          {/* Coin badge — gold fill + dark-teal glyph (fixed brand tokens). */}
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-gold)] text-[var(--brand-teal)]">
            <IconCoin size={18} />
          </span>
          <p className="text-h3 font-bold leading-none tabular-nums">
            {rewardPoints.toLocaleString("fa-IR")} امتیاز
          </p>
        </div>
        <p className="mt-2 text-caption leading-relaxed opacity-80">
          با تکمیل کامل پروفایل، این امتیاز به حساب تو اضافه می‌شود.
        </p>
      </div>

      {/* Suppress — a checkbox row, not a button. The row itself is the label
          and the click target (44px tall on touch, per `layout="row"`), and
          checking it runs the same single `suppress` action: persist the
          per-user preference, then close.
          Uncontrolled on purpose: `suppress()` moves the controller to
          SAVING_PREFERENCE, which closes the dialog in the same render, so
          there is no in-flight frame to reflect — the native tick at press
          time is the only honest feedback available. */}
      <Checkbox
        layout="row"
        onChange={suppress}
        disabled={saving}
        label="دیگر این پیام را به من نشان نده"
        className="mt-5 rounded-large border border-outline-variant bg-surface-container-low px-4 py-3 transition-colors can-hover:hover:bg-surface-hover"
      />

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
