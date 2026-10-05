"use client";

// ============================================================
// LEGALIR — Shared 404 view
// Rendered by both the root `not-found.tsx` (public chrome) and the
// `(app)/not-found.tsx` (app chrome). The illustration already carries
// the Persian «۴۰۴», so no number is drawn in HTML.
// ============================================================

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@legalir/ui";

const NAVY = "#152032";
const BRONZE = "#A4510E";

/** Minimal Navigation API shape (Chromium). Not in the standard lib types. */
interface NavigationLike {
  currentEntry: { index: number } | null;
  entries: () => { url: string }[];
}

/** Minimal window shape the back-navigation probe needs (kept narrow so it
 *  can be unit-tested without a real browser). */
export interface HistoryProbe {
  history: { length: number };
  location: { origin: string };
  document: { referrer: string };
  navigation?: NavigationLike;
}

/**
 * Decide whether «برگشت» has a real in-app page to return to.
 *
 * `history.length` alone is not enough: a URL opened directly in a fresh tab
 * sits after the browser's new-tab page (about:blank), so the length is > 1
 * even though there is no in-app page behind it.
 *
 * Where the Navigation API exists (Chromium) we inspect the actual previous
 * entry and require it to be same-origin. Elsewhere we fall back to a
 * referrer heuristic: a prior entry plus a referrer that is absent
 * (client-side navigation never sets one) or same-origin.
 */
export function hasInternalHistory(win: HistoryProbe): boolean {
  const nav = win.navigation;
  if (nav && nav.currentEntry && typeof nav.entries === "function") {
    const idx = nav.currentEntry.index;
    if (idx <= 0) return false;
    const prev = nav.entries()[idx - 1];
    if (!prev) return false;
    try {
      return new URL(prev.url).origin === win.location.origin;
    } catch {
      return false;
    }
  }

  if (win.history.length <= 1) return false;
  const ref = win.document.referrer;
  if (!ref) return true;
  try {
    return new URL(ref).origin === win.location.origin;
  } catch {
    return false;
  }
}

export function NotFoundView({ className = "" }: { className?: string }) {
  const router = useRouter();

  const handleBack = useCallback(() => {
    if (hasInternalHistory(window)) {
      router.back();
    } else {
      router.push("/");
    }
  }, [router]);

  return (
    <div
      dir="rtl"
      className={`flex flex-col items-center justify-center px-4 py-8 text-center ${className}`}
    >
      {/* Illustration. The source PNG is 1774×887 with ~30% empty white
          below the characters; `-mb-[15%]` (≈ 270/1774 of the rendered
          width) pulls the title up into that whitespace so the gap stays
          balanced at every width. The image itself is never cropped. */}
      <div className="mx-auto w-full max-w-[800px]">
        <img
          src="/legalir-404.png"
          alt="تیم حقوقی لیگالیر در جست‌وجوی صفحه مورد نظر"
          width={1774}
          height={887}
          className="block h-auto w-full object-contain -mb-[15%]"
        />
      </div>

      <h1 className="mt-6 text-h1 font-bold" style={{ color: NAVY }}>
        این صفحه یافت نشد
      </h1>

      <p className="mt-3 text-body-1 leading-relaxed" style={{ color: `${NAVY}B3` }}>
        <span className="block">تیم حقوقی لیگالیر هم هنوز پیداش نکرده!</span>
        <span className="block">گزینه‌های زیر رو فعلاً باید انتخاب کنی:</span>
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-medium px-6 text-labelLarge text-white transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ backgroundColor: BRONZE }}
        >
          صفحه خانه
        </Link>
        <Button
          type="button"
          variant="outlined"
          size="large"
          onClick={handleBack}
          className="!border-[#152032] !text-[#152032]"
        >
          برگشت
        </Button>
      </div>
    </div>
  );
}
