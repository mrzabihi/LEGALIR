"use client";

// ============================================================
// LEGALIR — /download shelf
// ============================================================
// Four ways to carry LEGALIR: three app stores that are not open yet and
// the PWA, which is live today. The shelf exists because the product has
// exactly one shipped distribution channel, and saying that honestly is
// better than a row of dead "download" buttons.
//
// Why this is a client component:
//   • the PWA button needs the live `beforeinstallprompt` handle, which
//     only exists in the browser;
//   • when no prompt is available (iOS Safari, Firefox, an in-app browser)
//     the button must not be a dead end — it opens the shipped
//     step-by-step guide instead of doing nothing.
//
// The store marks below are drawn here rather than imported: `lib/icons`
// is a Material set and has no store glyphs, and a generic box-with-arrow
// for four different shops would tell the visitor nothing. Each mark is
// line art in the page's own weight, so the shelf keeps the catalogue's
// visual language. They are `aria-hidden` — the card names the store in
// text right beside the mark.
//
// Nothing here navigates off-site: no store link is invented, because none
// exists yet. The three "coming soon" cards are plain, non-interactive
// elements, so they never look pressable.

import { useCallback, useState, type ReactNode } from "react";
import { IconInstall } from "@/lib/icons";
import { toPersianDigits } from "@/lib/persian-utils";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { getAndroidGuide, getIosGuide } from "@/components/pwa/install-guide";

/* ---------------------------------------------------------------
   Store marks — 24×24, hairline, `currentColor`.
   --------------------------------------------------------------- */

function BazaarMark() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* a shopfront: awning over a counter */}
      <path d="M3.5 9.5 5.2 5h13.6l1.7 4.5" />
      <path d="M3.5 9.5h17" />
      <path d="M5.5 11.2V19h13v-7.8" />
      <path d="M9.8 19v-4.2h4.4V19" />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* the play wedge, drawn rather than filled */}
      <path d="M8 5.4v13.2l10.6-6.6L8 5.4Z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* a fruit with one leaf — a hand-drawn mark, not the trademarked
          silhouette, which would be both counterfeit and off-palette */}
      <path d="M12 8.4c-2.7-1.7-6.2.1-6.2 4.2 0 4.1 3.1 7.9 6.2 7.9s6.2-3.8 6.2-7.9c0-4.1-3.5-5.9-6.2-4.2Z" />
      <path d="M12 8.4V5.6" />
      <path d="M12 5.6c1.7-.4 2.7-1.3 3-2.6-1.8 0-2.7.8-3 2.6Z" />
    </svg>
  );
}

/* ---------------------------------------------------------------
   Card shell
   --------------------------------------------------------------- */

function StoreCard({
  mark,
  name,
  platform,
  live = false,
  children,
}: {
  mark: ReactNode;
  name: string;
  platform: string;
  live?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`landing-card landing-store ${live ? "landing-store--live" : ""}`}
    >
      <span className="landing-store__tile" aria-hidden="true">
        {mark}
      </span>
      <div className="min-w-0">
        <p className="landing-store__name">{name}</p>
        <p className="landing-store__platform">{platform}</p>
      </div>
      <div className="landing-store__foot">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------
   The shelf
   --------------------------------------------------------------- */

export function DownloadPlatforms() {
  const {
    canPrompt,
    platform,
    promptInstall,
    iosGuideVariant,
    androidGuideVariant,
    isInstalled,
  } = useInstallPrompt();

  const [guideOpen, setGuideOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleInstall = useCallback(async () => {
    if (busy) return;
    if (canPrompt) {
      setBusy(true);
      await promptInstall();
      setBusy(false);
      return;
    }
    // No native prompt on this browser: show the real OS steps rather
    // than a button that appears to do nothing.
    setGuideOpen(true);
  }, [busy, canPrompt, promptInstall]);

  const guide =
    platform === "ios"
      ? getIosGuide(iosGuideVariant)
      : getAndroidGuide(androidGuideVariant);

  return (
    <div className="grid gap-4 tablet:grid-cols-2 laptop:grid-cols-4">
      <StoreCard mark={<BazaarMark />} name="کافه‌بازار" platform="نسخهٔ اندروید">
        <p className="landing-soon">به‌زودی</p>
      </StoreCard>

      <StoreCard mark={<PlayMark />} name="گوگل پلی" platform="نسخهٔ اندروید">
        <p className="landing-soon">به‌زودی</p>
      </StoreCard>

      <StoreCard mark={<AppleMark />} name="اپل استور" platform="نسخهٔ آیفون">
        <p className="landing-soon">به‌زودی</p>
      </StoreCard>

      <StoreCard
        live
        mark={<IconInstall size={24} />}
        name="نسخهٔ وب (PWA)"
        platform="همهٔ گوشی‌ها"
      >
        {isInstalled ? (
          <p className="landing-soon">نصب شده است</p>
        ) : (
          <button
            type="button"
            onClick={handleInstall}
            disabled={busy}
            className="landing-btn landing-btn--primary w-full !min-h-11 !px-4 text-[13px] disabled:opacity-60"
          >
            {busy ? "در حال باز کردن…" : canPrompt ? "نصب روی این دستگاه" : "راهنمای نصب"}
          </button>
        )}

        {guideOpen && !isInstalled && (
          <div className="landing-store__steps">
            <p className="font-semibold text-[color:var(--ln-ink)]">{guide.title}</p>
            <ol className="mt-1.5 space-y-1">
              {guide.steps.map((step, index) => (
                <li key={step.text} className="flex gap-2">
                  <span aria-hidden="true" className="tabular-nums">
                    {toPersianDigits(index + 1)}
                  </span>
                  <span>{step.text}</span>
                </li>
              ))}
            </ol>
            {guide.note && (
              <p className="mt-1.5 text-[color:var(--ln-muted)]">{guide.note}</p>
            )}
          </div>
        )}
      </StoreCard>
    </div>
  );
}
