"use client";

// ============================================================
// LEGALIR — Registration Step 1: choose the entry track
// ============================================================
// The user picks ONE of three tracks before creating an account. The
// choice is carried to step 2 as a query param and validated server-side;
// it only seeds onboarding and never grants a role or org access.
//
// Layout: every card uses the SAME vertical stack — icon (centred) →
// title → description (full width) → CTA pinned to the bottom. The
// description must never sit in a narrow column beside the icon, which is
// what previously forced Persian text to break one word per line.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RegistrationIntent } from "@legalir/types";
import { trackSignupEvent, type SignupEvent } from "@/lib/auth/signup-analytics";

interface Track {
  intent: RegistrationIntent;
  title: string;
  description: string;
  cta: string;
  ariaLabel: string;
  event: SignupEvent;
  /** Small optional label shown beside the title. */
  badge?: string;
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
    badge: "برای کاربران شخصی",
    primary: true,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    <div className="rounded-large bg-neutral-0/95 backdrop-blur-sm p-6 sm:p-8 shadow-elevation-8 border border-neutral-200/50">
      <div className="text-center mb-8">
        <h1 className="text-h2 text-neutral-900 mb-2">ثبت‌نام در لیگالیر</h1>
        <p className="text-body-2 text-neutral-500">
          برای شروع، نوع حساب خود را انتخاب کنید.
        </p>
      </div>

      <div role="list" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TRACKS.map((track) => (
          <button
            key={track.intent}
            type="button"
            role="listitem"
            onClick={() => choose(track.intent, track.event)}
            aria-label={track.ariaLabel}
            className={`group flex min-w-0 flex-col items-center text-center rounded-large border-2 p-6 transition-all duration-200 hover:shadow-elevation-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 focus-visible:ring-offset-2 active:scale-[0.99] touch-target ${
              track.primary
                ? "border-primary-700/30 bg-primary-700/[0.04] hover:border-primary-700 hover:bg-primary-700/[0.07]"
                : "border-neutral-200 bg-neutral-50 hover:border-primary-700 hover:bg-primary-700/5"
            }`}
          >
            {/* Icon — centred, same size on every card */}
            <span
              className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 shrink-0 transition-colors ${
                track.primary
                  ? "bg-primary-700 text-white shadow-elevation-1"
                  : "bg-primary-700/10 text-primary-700 group-hover:bg-primary-700 group-hover:text-white"
              }`}
            >
              {track.icon}
            </span>

            {/* Title (+ optional badge) */}
            <span className="flex flex-wrap items-center justify-center gap-2 mb-2">
              <span className="text-h3 text-neutral-900">{track.title}</span>
              {track.badge && (
                <span className="rounded-full bg-primary-700/10 text-primary-700 text-caption px-2.5 py-0.5">
                  {track.badge}
                </span>
              )}
            </span>

            {/* Description — full card width, natural wrapping */}
            <span className="w-full text-body-2 text-neutral-500 leading-relaxed">
              {track.description}
            </span>

            {/* CTA — pinned to the bottom so buttons align across cards */}
            <span className="mt-auto w-full pt-5">
              <span
                className={`flex items-center justify-center gap-1.5 w-full rounded-medium px-4 py-3 text-button font-semibold transition-colors ${
                  track.primary
                    ? "bg-primary-700 text-white group-hover:bg-primary-800"
                    : "border border-primary-700/40 text-primary-700 group-hover:border-primary-700 group-hover:bg-primary-700 group-hover:text-white"
                }`}
              >
                {track.cta}
              </span>
            </span>
          </button>
        ))}
      </div>

      <p className="text-center text-body-2 text-neutral-500 pt-6 mt-6 border-t border-neutral-200">
        قبلاً ثبت‌نام کرده‌اید؟{" "}
        <Link
          href="/auth/mobile"
          onClick={() => trackSignupEvent("login_from_register_clicked")}
          className="text-primary-700 font-medium underline underline-offset-2 hover:text-primary-800 transition-colors"
        >
          وارد شوید
        </Link>
      </p>
    </div>
  );
}
