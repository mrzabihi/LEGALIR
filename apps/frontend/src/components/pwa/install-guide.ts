// ============================================================
// LEGALIR — PWA install guide content (pure)
// ============================================================
// Persian, step-by-step instructions shown when a native install prompt is
// not available. Kept separate from the component so the copy can be unit
// tested and reviewed without rendering.
//
// iOS: only Safari exposes "Add to Home Screen"; other iOS browsers must be
// told to open Safari. Android: the menu entry differs per browser, so the
// wording follows the detected browser.

import type { AndroidGuideVariant, IosGuideVariant } from "@/lib/pwa/install";

export type GuideStepIcon = "share" | "add" | "menu" | "install";

export interface GuideStep {
  icon: GuideStepIcon;
  text: string;
}

export interface InstallGuide {
  title: string;
  steps: GuideStep[];
  /** Optional caveat shown under the steps. */
  note?: string;
}

export function getIosGuide(variant: IosGuideVariant): InstallGuide {
  if (variant === "other-browser") {
    return {
      title: "افزودن به صفحه اصلی",
      steps: [
        { icon: "share", text: "برای نصب، این صفحه را در مرورگر Safari باز کنید." },
        { icon: "share", text: "در Safari، دکمه اشتراک‌گذاری (Share) را در نوار پایین بزنید." },
        {
          icon: "add",
          text: "گزینه «Add to Home Screen» / «افزودن به صفحه اصلی» را انتخاب کنید.",
        },
      ],
      note: "افزودن به صفحه اصلی در آیفون فقط از طریق مرورگر Safari امکان‌پذیر است.",
    };
  }

  return {
    title: "افزودن به صفحه اصلی",
    steps: [
      { icon: "share", text: "در مرورگر Safari، دکمه اشتراک‌گذاری (Share) را در نوار پایین بزنید." },
      {
        icon: "add",
        text: "گزینه «Add to Home Screen» / «افزودن به صفحه اصلی» را انتخاب کنید.",
      },
      { icon: "install", text: "روی «Add» / «افزودن» بزنید تا آیکون لیگالیر اضافه شود." },
    ],
  };
}

export function getAndroidGuide(variant: AndroidGuideVariant): InstallGuide {
  switch (variant) {
    case "firefox":
      return {
        title: "افزودن به صفحه اصلی",
        steps: [
          { icon: "menu", text: "منوی مرورگر (سه‌نقطه ⋮) را باز کنید." },
          {
            icon: "add",
            text: "گزینه «Add to Home screen» / «افزودن به صفحه اصلی» را انتخاب کنید.",
          },
          { icon: "install", text: "روی «Add» / «افزودن» بزنید." },
        ],
      };
    case "samsung":
      return {
        title: "افزودن به صفحه اصلی",
        steps: [
          { icon: "menu", text: "منوی مرورگر (سه‌خط ☰) را باز کنید." },
          { icon: "add", text: "گزینه «Add page to» و سپس «Home screen» را انتخاب کنید." },
          { icon: "install", text: "روی «Add» بزنید تا آیکون لیگالیر اضافه شود." },
        ],
      };
    case "chrome":
      return {
        title: "نصب لیگالیر",
        steps: [
          { icon: "menu", text: "منوی مرورگر (سه‌نقطه ⋮) را باز کنید." },
          {
            icon: "install",
            text: "گزینه «Install app» یا «Add to Home screen» را انتخاب کنید.",
          },
          { icon: "add", text: "روی «Install» / «نصب» بزنید." },
        ],
      };
    default:
      return {
        title: "افزودن به صفحه اصلی",
        steps: [
          { icon: "menu", text: "منوی مرورگر را باز کنید." },
          {
            icon: "install",
            text: "گزینه «Install app» یا «Add to Home screen» را انتخاب کنید.",
          },
          { icon: "add", text: "تأیید کنید تا آیکون لیگالیر به صفحه اصلی اضافه شود." },
        ],
      };
  }
}
