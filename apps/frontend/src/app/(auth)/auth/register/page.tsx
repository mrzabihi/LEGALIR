"use client";

// ============================================================
// LEGALIR — Registration Step 1 of 2: choose the entry track
// ============================================================
// The user picks ONE of three tracks before creating an account. The
// choice is carried to step 2 as a query param and validated server-side;
// it only seeds onboarding and never grants a role or org access.
//
// Layout: every card uses the SAME vertical stack — icon (centred) →
// title → description (full width) → CTA pinned to the bottom. The
// description must never sit in a narrow column beside the icon, which is
// what previously forced Persian text to break one word per line.
//
// The three tracks are a real choice, not a decoration: each one sets the
// `type` the account is created with, and each one is logged. The list is a
// `<ul>`/`<li>` with a `<button>` inside — the previous markup put
// `role="listitem"` *on* the button, which replaces the button role, so a
// screen reader announced three list items that could not be activated.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RegistrationIntent } from "@legalir/types";
import { trackSignupEvent, type SignupEvent } from "@/lib/auth/signup-analytics";
import { toPersianDigits } from "@/lib/persian-utils";

interface Track {
  intent: RegistrationIntent;
  title: string;
  description: string;
  cta: string;
  ariaLabel: string;
  event: SignupEvent;
  /** The primary path — filled CTA and a subtle surface tint. */
  primary?: boolean;
  icon: React.ReactNode;
}

const TRACKS: Track[] = [
  {
    intent: "PERSONAL",
    title: "شخص حقیقی",
    description: "استفاده شخصی از خدمات حقوقی، مشاوره هوشمند و تنظیم قرارداد",
    cta: "ایجاد حساب شخصی",
    ariaLabel: "ایجاد حساب شخصی — شخص حقیقی",
    event: "signup_personal_selected",
    primary: true,
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    intent: "LAWYER",
    title: "وکیل",
    description: "عضویت در فهرست وکلا و دریافت درخواست‌های مشاوره",
    cta: "ثبت‌نام وکیل",
    ariaLabel: "ثبت‌نام وکیل — عضویت در فهرست وکلا",
    event: "signup_lawyer_selected",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v18" />
        <path d="M5 7h14" />
        <path d="M5 7l-3 6a3 3 0 0 0 6 0z" />
        <path d="M19 7l-3 6a3 3 0 0 0 6 0z" />
        <path d="M8 21h8" />
      </svg>
    ),
  },
  {
    intent: "ORGANIZATION",
    title: "شرکت / شخصیت حقوقی",
    description: "مدیریت حقوقی سازمان، صاحبان امضا و قراردادهای شرکتی",
    cta: "ثبت‌نام سازمانی",
    ariaLabel: "ثبت‌نام سازمانی — شرکت یا شخصیت حقوقی",
    event: "signup_business_selected",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 21h18" />
        <path d="M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-5h6v5" />
        <path d="M9 10h.01M15 10h.01M9 13h.01M15 13h.01" />
      </svg>
    ),
  },
];

export default function RegisterTypePage() {
  const router = useRouter();

  useEffect(() => {
    trackSignupEvent("signup_entry_viewed");
  }, []);

  const choose = (intent: RegistrationIntent, event: SignupEvent) => {
    trackSignupEvent(event);
    router.push(`/auth/register/account?type=${intent}`);
  };

  return (
    <div className="rounded-large border border-divider bg-surface p-5 shadow-elevation-8 tablet:p-8">
      {/* Step indicator — registration genuinely has two steps (this choice,
          then the credentials), so the count is real, not decorative. */}
      <p className="mb-4 text-center text-caption text-neutral-500">
        گام {toPersianDigits(1)} از {toPersianDigits(2)}
      </p>

      <div className="mb-6 text-center tablet:mb-8">
        <h1 className="text-h2 text-neutral-900">ثبت‌نام در لیگالیر</h1>
        <p className="mt-2 text-body-2 text-neutral-500">
          برای شروع، نوع حساب خود را انتخاب کنید.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-3 tablet:grid-cols-3 tablet:gap-4">
        {TRACKS.map((track) => (
          <li key={track.intent} className="flex">
            <button
              type="button"
              onClick={() => choose(track.intent, track.event)}
              aria-label={track.ariaLabel}
              className={`group flex w-full min-w-0 flex-col rounded-large border p-5 text-center transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary tablet:p-6 ${
                track.primary
                  ? "border-primary-700/25 bg-primary-700/[0.04]"
                  : "border-divider bg-neutral-50 can-hover:hover:border-primary-700/40"
              }`}
            >
              {/* Phones: icon beside the copy, so a card is ~110px instead of
                  ~190px and all three still fit on one screen. From `tablet`
                  the icon sits above a centred title, as before. */}
              <span className="flex items-start gap-3 text-start tablet:block tablet:text-center">
                <span
                  aria-hidden="true"
                  className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-medium transition-colors tablet:mx-auto tablet:mb-4 ${
                    track.primary
                      ? "bg-primary-700 text-white"
                      : "bg-primary-700/10 text-primary-700 group-hover:bg-primary-700 group-hover:text-white"
                  }`}
                >
                  {track.icon}
                </span>

                <span className="min-w-0">
                  <span className="block text-h3 text-neutral-900">{track.title}</span>
                  <span className="mt-1 block text-body-2 leading-relaxed text-neutral-500">
                    {track.description}
                  </span>
                </span>
              </span>

              {/* CTA — pinned to the bottom so the three buttons align. */}
              <span className="mt-auto w-full pt-4">
                <span
                  className={`flex min-h-11 w-full items-center justify-center gap-1.5 rounded-medium px-4 text-button font-semibold transition-colors ${
                    track.primary
                      ? "bg-primary-700 text-white group-hover:bg-primary-800"
                      : "border border-primary-700/40 text-primary-700 group-hover:border-primary-700 group-hover:bg-primary-700 group-hover:text-white"
                  }`}
                >
                  {track.cta}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-6 flex flex-wrap items-center justify-center gap-x-1 border-t border-divider pt-2 text-center text-body-2 text-neutral-500">
        قبلاً ثبت‌نام کرده‌اید؟
        <Link
          href="/auth/mobile"
          onClick={() => trackSignupEvent("login_from_register_clicked")}
          className="inline-flex min-h-11 items-center rounded-small px-1 font-medium text-primary-700 underline underline-offset-2 transition-colors hover:text-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          وارد شوید
        </Link>
      </p>
    </div>
  );
}
