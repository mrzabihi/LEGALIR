"use client";

// ============================================================
// LEGALIR — landing «نمی‌دانید از کجا شروع کنید؟» card
// ============================================================
// The landing page's single lowest-friction entry point, placed directly
// under the hero. It collects ONE short description and hands it to the
// real start flow — it is not a second product:
//
//   signed in  → /new, with the text seeded into the existing
//                `StartRequestPanel` textarea (the same panel that then
//                routes to `/Suggest_law` and its real destination list)
//   guest      → /auth/mobile?intent=chat, then back to /new after a
//                successful sign-in or sign-up, with the same text waiting
//
// What the button promises is exactly what `/new` does: it carries the
// text to the step that proposes a route. It does NOT claim an analysis
// has been produced — `/Suggest_law` is what shows "how we understood it"
// and no answer exists before the user gets there.
//
// Privacy (the entered text is sensitive legal information):
//   • the text never enters a URL, a log, analytics or localStorage — the
//     hand-off is a one-shot sessionStorage value (see
//     `lib/intake/landing-start-draft.ts`)
//   • nothing is written until the user submits
//   • `/new` consumes and clears it on arrival

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Textarea } from "@legalir/ui";
import { IconArrowBack, IconWarning } from "@/lib/icons";
import { useSessionStatus } from "@/lib/auth/use-auth";
import { useIsHydrated } from "@/hooks/useIsHydrated";
import { useAuthStore } from "@/stores/auth-store";
import {
  LANDING_START_MAX_LENGTH,
  writeLandingStartDraft,
} from "@/lib/intake/landing-start-draft";

/** The real start flow the card hands off to. */
const START_PATH = "/new";

/** The shipped login route, carrying the token that resolves to `/new`
 *  (`INTENT_ROUTE_MAP.chat`). The text itself never travels in the URL. */
const LOGIN_HREF = "/auth/mobile?intent=chat";

export function LandingStartCard() {
  const router = useRouter();
  const setIntendedRoute = useAuthStore((s) => s.setIntendedRoute);

  const hydrated = useIsHydrated();
  const { isAuthenticated, isLoading: sessionLoading } = useSessionStatus();

  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = text.trim();
  const isEmpty = trimmed.length === 0;

  // The session decides WHICH real route the card uses. While it is still
  // resolving we hold the button, because guessing wrong would send a
  // signed-in visitor to a guest-only page that bounces them to the
  // dashboard — losing both the intent and the text's destination.
  const sessionResolved = hydrated && !sessionLoading;
  const disabled = !sessionResolved || isEmpty || submitting;

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!sessionResolved || trimmed.length === 0 || submitting) return;

      setError(null);
      setSubmitting(true);

      // Hand the description to /new in this tab. If storage is blocked the
      // visitor can still continue — they simply arrive with an empty box —
      // so this is a degraded path, not a dead end.
      const carried = writeLandingStartDraft(trimmed);

      if (!carried) {
        setError(
          "مرورگر اجازهٔ نگه‌داشتن موقت متن را نداد. می‌توانید ادامه دهید و متن را در مرحلهٔ بعد دوباره وارد کنید."
        );
      }

      if (isAuthenticated) {
        router.push(START_PATH);
        return;
      }

      // Guest: remember the destination, then use the real login route.
      // `setIntendedRoute` is the same mechanism the login page uses, so
      // the trip survives both the login and the register branch.
      setIntendedRoute(START_PATH);
      router.push(LOGIN_HREF);
    },
    [
      sessionResolved,
      trimmed,
      submitting,
      isAuthenticated,
      router,
      setIntendedRoute,
    ]
  );

  return (
    <section
      className="landing-container pb-2"
      aria-labelledby="landing-start-title"
    >
      <div
        data-ln-reveal="0"
        className="relative overflow-hidden rounded-[var(--ln-r-xl)] border border-[color:var(--ln-line)] bg-[color:var(--ln-surface)] p-5 shadow-[var(--ln-shadow-2)] tablet:p-7 laptop:p-8"
      >
        {/* One accent: the gold hairline is the same motif the section
            eyebrows use, so the card reads as part of the page. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 start-0 w-1 bg-[color:var(--ln-gold)]"
        />

        <div className="grid gap-5 laptop:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] laptop:items-start laptop:gap-8">
          {/* Copy — what the box is for, in two lines. */}
          <div className="min-w-0">
            <h2
              id="landing-start-title"
              className="text-[1.0625rem] font-bold leading-8 text-[color:var(--ln-navy)] tablet:text-[1.1875rem]"
            >
              نمی‌دانید از کجا شروع کنید؟
            </h2>
            <p className="mt-1.5 text-[13px] leading-7 text-[color:var(--ln-muted)] tablet:text-[13.5px]">
              موضوع حقوقی‌تان را کوتاه بنویسید تا مسیر مناسب را بررسی کنیم.
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-6 text-[color:var(--ln-muted)]">
              <IconArrowBack
                size={13}
                aria-hidden="true"
                className="mt-1.5 shrink-0 text-[color:var(--ln-gold)]"
              />
              متن شما فقط در همین تب و تا رسیدن به مرحلهٔ بعد نگه داشته
              می‌شود.
            </p>
          </div>

          {/* The one input + the one action. */}
          <form onSubmit={handleSubmit} noValidate className="min-w-0">
            <Textarea
              id="landing-start-input"
              label="موضوع حقوقی"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
              }}
              rows={3}
              maxLength={LANDING_START_MAX_LENGTH}
              showCharCount
              fullWidth
              disabled={submitting}
              placeholder="مثلاً: برای بررسی قرارداد اجاره‌ام از کجا شروع کنم؟"
            />

            {error && (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-[var(--ln-r-sm)] border border-[color:var(--ln-line-strong)] bg-[color:var(--ln-canvas)] px-3 py-2 text-[12px] leading-6 text-[color:var(--ln-ink-soft)]"
              >
                <IconWarning
                  size={15}
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-[color:var(--ln-gold-deep)]"
                />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-4">
              <Button
                type="submit"
                variant="filled"
                size="large"
                fullWidth
                disabled={disabled}
                loading={submitting}
              >
                تأیید و بررسی مسیر
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
