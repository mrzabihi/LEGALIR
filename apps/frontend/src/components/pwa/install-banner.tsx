// ============================================================
// LEGALIR — PWA install banner (mobile)
// ============================================================
// A small, dismissible card that floats just above the mobile bottom
// navigation. It never covers the nav bar (it sits clear of the raised centre
// action) and never auto-prompts: the browser's install dialog opens only when
// the user taps «نصب لیگالیر».
//
//   • Android/Chromium — a captured `beforeinstallprompt` is fired on tap.
//     When no prompt is ready, a browser-specific menu guide is shown instead,
//     so the button is never a dead end.
//   • iOS — a native prompt is impossible, so a short Persian step-by-step
//     guide is shown (Safari's Share → Add to Home Screen).
//
// The card is rendered only on mobile (`desktop:hidden`) and only after mount,
// so it can never flash during SSR. «بعداً» snoozes it for 7 days.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import {
  getAndroidGuide,
  getIosGuide,
  type GuideStepIcon,
  type InstallGuide,
} from "./install-guide";
import {
  IconClose,
  IconInstall,
  IconShare,
  IconAddToHome,
  IconMoreVert,
} from "@/lib/icons";

const STEP_ICON_MAP: Record<
  GuideStepIcon,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  share: IconShare,
  add: IconAddToHome,
  menu: IconMoreVert,
  install: IconInstall,
};

/** Clearance above the floating bottom nav. The raised centre button's top
 *  edge sits ~96px from the viewport bottom (12px nav offset + 64px bar +
 *  20px raise), so 116px leaves a comfortable ~20px gap and keeps the banner
 *  clear of the nav and its centre action. */
const BANNER_BOTTOM = "calc(116px + env(safe-area-inset-bottom, 0px))";

export function InstallBanner() {
  const {
    visible,
    platform,
    canPrompt,
    iosGuideVariant,
    androidGuideVariant,
    promptInstall,
    dismiss,
  } = useInstallPrompt();

  const [guideOpen, setGuideOpen] = useState(false);

  const handleInstall = useCallback(async () => {
    if (canPrompt) {
      await promptInstall();
      return;
    }
    // No native prompt — show the appropriate step-by-step guide.
    setGuideOpen(true);
  }, [canPrompt, promptInstall]);

  const handleDismiss = useCallback(() => {
    setGuideOpen(false);
    dismiss();
  }, [dismiss]);

  if (!visible) return null;

  const guide: InstallGuide | null = guideOpen
    ? platform === "ios"
      ? getIosGuide(iosGuideVariant)
      : getAndroidGuide(androidGuideVariant)
    : null;

  return (
    <>
      <div
        dir="rtl"
        role="region"
        aria-label="نصب لیگالیر"
        data-pwa-install-banner
        className="desktop:hidden fixed inset-x-3 z-30 mx-auto flex max-w-[440px] animate-slide-up-fade flex-col gap-3 rounded-2xl border border-glass-border bg-glass-surface-strong p-3.5 backdrop-blur-xl [box-shadow:var(--bottom-nav-shadow)]"
        style={{ bottom: BANNER_BOTTOM }}
      >
        <div className="flex items-start gap-3">
          <img
            src="/icon-192.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-xl"
            draggable={false}
          />
          <div className="min-w-0 flex-1">
            <p className="text-body-2 font-semibold leading-snug text-glass-ivory">
              لیگالیر را به صفحه اصلی گوشی اضافه کنید
            </p>
            <p className="mt-0.5 text-caption text-glass-ivory-muted">
              دسترسی سریع‌تر به خدمات حقوقی
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="بستن"
            className="-me-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-glass-ivory-muted transition-colors hover:bg-glass-state focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bottom-nav-accent)]"
          >
            <IconClose size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleInstall}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[color:var(--bottom-nav-accent)] px-4 text-labelLarge font-semibold text-[color:var(--bottom-nav-badge-text)] transition-[filter] hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bottom-nav-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bottom-nav-body)]"
          >
            <IconInstall size={18} />
            نصب لیگالیر
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-10 items-center justify-center rounded-xl px-4 text-labelLarge font-medium text-glass-ivory-muted transition-colors hover:bg-glass-state focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bottom-nav-accent)]"
          >
            بعداً
          </button>
        </div>
      </div>

      {guide && <InstallGuideSheet guide={guide} onClose={() => setGuideOpen(false)} />}
    </>
  );
}

// ============================================================
// InstallGuideSheet — modal step-by-step guide
// ============================================================

function InstallGuideSheet({
  guide,
  onClose,
}: {
  guide: InstallGuide;
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const raf = requestAnimationFrame(() => {
      sheetRef.current?.querySelector<HTMLElement>("button")?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
      previousFocus.current?.focus?.();
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="presentation">
      <div
        className="absolute inset-0 bg-scrim/50 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={guide.title}
        className="bottom-nav-sheet animate-sheet-up absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-[28px] border-x border-t border-divider bg-surface shadow-elevation-24"
      >
        <div className="flex justify-center pt-3" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-outline-variant" />
        </div>

        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-3">
          <h2 className="text-h3 text-on-surface">{guide.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400"
          >
            <IconClose size={20} />
          </button>
        </div>

        <ol className="flex flex-col gap-3 px-5 pb-6 pt-2">
          {guide.steps.map((step, i) => {
            const Icon = STEP_ICON_MAP[step.icon];
            return (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary-50 text-secondary-700">
                  <Icon size={20} />
                </span>
                <span className="pt-1.5 text-body-2 text-on-surface">{step.text}</span>
              </li>
            );
          })}
        </ol>

        {guide.note && (
          <p className="mx-5 mb-6 rounded-xl bg-surface-container-low px-4 py-3 text-caption text-on-surface-variant">
            {guide.note}
          </p>
        )}

        <div
          aria-hidden="true"
          className="shrink-0"
          style={{ height: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
        />
      </div>
    </div>,
    document.body
  );
}
