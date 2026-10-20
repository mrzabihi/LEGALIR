// ============================================================
// LEGALIR — Auth shell (login · OTP · registration · recovery)
// ============================================================
// One shell for every /auth/** screen:
//
//   phone    · one full-width column, no decoration between the visitor and
//              the form; the logo is 48px tall instead of 112px so the first
//              screen is the form, not the masthead
//   tablet   · same column, a little more breathing room
//   laptop+  · a two-column split: the brand panel (right, reading start)
//              carries the product's own sentence plus the real three-step
//              flow, and the form column holds the card
//
// It stays a client component because of `useRedirectAuthenticated`, which is
// why the `noindex` metadata lives in the sibling server layout.
//
// Colours: the previous shell asked for `from-primary-950`, a stop that does
// not exist in the light palette, so the gradient silently resolved to
// nothing. It now uses the brand tokens (`--brand-teal`, `--brand-gold`,
// `--brand-ivory`) that the rest of the product paints with — no new colours
// are introduced.
//
// Keyboard & safe areas: vertical centring starts at `laptop` only. On phones
// the column flows from the top, and the top/bottom padding is
// `max(base, env(safe-area-inset-*))`, so with the virtual keyboard open the
// CTA sits in the scrollable area instead of being pinned under it. `100svh`
// (not `vh`) keeps the height stable while the URL bar collapses.
//
// The group is pinned to the light theme, the same decision the public
// marketing routes already make: the auth card is `bg-surface` with near-black
// headings, and under a persisted dark preference that pairing inverted into
// dark-on-dark. `ForceLightTheme` re-asserts light without touching the
// visitor's saved app preference.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ForceLightTheme } from "@/components/public/ForceLightTheme";
import { useRedirectAuthenticated } from "@/lib/auth/use-auth";
import { toPersianDigits } from "@/lib/persian-utils";

/**
 * The real sign-in / sign-up flow — the same steps the screens behind this
 * shell actually perform. Nothing here promises a capability the product
 * does not have.
 */
const FLOW_STEPS = [
  {
    title: "شماره موبایل",
    body: "با شماره موبایل خود وارد می‌شوید یا حساب تازه می‌سازید.",
  },
  {
    title: "نوع حساب",
    body: "شخص حقیقی، وکیل یا سازمان — مسیر مناسب خود را انتخاب می‌کنید.",
  },
  {
    title: "شروع کار",
    body: "پس از تأیید، به سرویسی که انتخاب کرده‌اید یا به داشبورد می‌روید.",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Redirect authenticated users away from auth pages (except /auth/profile).
  // The guard waits for the server to confirm the session and honours a
  // pending intended route, so a stale localStorage entry cannot hijack the
  // post-login destination.
  useRedirectAuthenticated(pathname === "/auth/profile");

  // The track chooser lays three cards side by side and needs the whole
  // width; every other screen is a single readable form column.
  const isTrackChooser = pathname === "/auth/register";

  return (
    <div className="relative isolate min-h-[100svh] overflow-x-hidden bg-[color:var(--brand-ivory)]">
      <ForceLightTheme />

      {/* One soft gold wash from the top edge. It replaces the dot grid and
          the corner glow blob: decoration that cost paint time on a phone
          and read as clutter behind a form. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{
          background:
            "radial-gradient(120% 65% at 50% 0%, color-mix(in srgb, var(--brand-gold) 15%, transparent), transparent 72%)",
        }}
      />

      <main
        id="main-content"
        className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col justify-start px-4 tablet:px-6 laptop:justify-center"
        style={{
          paddingTop: "max(1.25rem, env(safe-area-inset-top, 0px))",
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div
          className={
            isTrackChooser
              ? "mx-auto w-full max-w-4xl"
              : // Panel first in DOM = reading start (right in RTL).
                "grid w-full gap-8 laptop:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] laptop:items-center laptop:gap-14"
          }
        >
          {!isTrackChooser && <AuthBrandPanel />}

          <div className="w-full">
            {/* The logo is the only way back to the public site from inside
                the auth flow, so it is a real link — not a dead end. */}
            <div className="mb-5 flex justify-center laptop:mb-6">
              <Link
                href="/"
                aria-label="بازگشت به صفحه اصلی لیگالیر"
                className="inline-flex items-center justify-center rounded-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              >
                <img
                  src="/legalir-logo.png"
                  alt="LEGALIR"
                  className="h-12 w-auto tablet:h-14"
                />
              </Link>
            </div>

            <div className="animate-fade-in">{children}</div>
          </div>
        </div>

        <p className="mt-6 text-center text-caption text-neutral-500 laptop:mt-8">
          سامانه جامع حقوقی لیگالیر
        </p>
      </main>
    </div>
  );
}

// ============================================================
// Brand panel (laptop and up)
// ============================================================

/**
 * The panel is decorative context, not content the form depends on: it is
 * hidden below `laptop` and nothing in it is interactive. The h1 of every
 * auth screen belongs to the form itself, so the panel's copy uses plain
 * paragraphs — the heading order stays h1 → h2 with no skipped level.
 */
function AuthBrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden rounded-large bg-[color:var(--brand-teal)] p-8 text-white laptop:block">
      {/* A single gold hairline anchors the panel's identity without a
          second colour or a glow. */}
      <div
        aria-hidden="true"
        className="mb-6 h-px w-14 bg-[color:var(--brand-gold)]"
      />

      <p className="text-[15px] leading-8 text-white/85">
        خدمات تخصصی حقوقی با بهره‌گیری از هوش مصنوعی، منابع حقوقی و مدل زبانی
        تخصصی لیگالیر
      </p>

      <ol className="mt-8 space-y-5">
        {FLOW_STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-gold)]/45 text-[12px] font-bold text-[color:var(--brand-gold)]"
            >
              {toPersianDigits(index + 1)}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold leading-6 text-white">
                {step.title}
              </span>
              <span className="mt-0.5 block text-[12px] leading-6 text-white/60">
                {step.body}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
