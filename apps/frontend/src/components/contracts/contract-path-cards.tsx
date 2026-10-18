// ============================================================
// LEGALIR — The two product paths (/contracts)
// ============================================================
// The contracts page answers ONE question before anything else:
// «می‌خواهی قرارداد بسازی یا قرارداد موجود را بررسی کنی؟» These two
// cards are that answer — the page's primary content, above the search
// and above the template library.
//
// The two paths are deliberately different at a glance, because they are
// different jobs:
//
//   • تنظیم قرارداد  — build a new draft from a ready template.
//                      accent: brand green, icon: pen, CTA filled.
//   • بررسی قرارداد  — have an existing document analysed. It accepts a
//                      file, a LEGALIR draft or an earlier document, so
//                      the card never implies "template" work.
//                      accent: brand teal, icon: magnifier, CTA outline.
//
// Copy is limited to what actually ships: the drafting count is the
// registry's real implemented-template total, and the review card names
// the three intake sources the review flow really offers. Nothing
// promotional is invented here.
//
// Interaction states:
//   • hover     — border picks up the card's accent, surface lifts.
//   • focus     — a 2px accent ring, visible on keyboard focus only.
//   • active    — the lift settles back to flush (a real press).
//   • pending   — while the destination route is loading, the CTA shows a
//                 spinner and the card reports `aria-busy` (next/link's
//                 own `useLinkStatus`, so it can never be guessed wrong).
//   • reduced-motion — every transform is dropped.
// ============================================================

"use client";

import Link, { useLinkStatus } from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { implementedContractDefinitions } from "@/lib/contracts/registry";
import { toPersianNumber } from "@/lib/persian-utils";
import { IconChevronLeft, IconFilePen, IconFileSearch } from "@/lib/icons";

interface PathCardSpec {
  key: "draft" | "review";
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  /** A real fact about the destination, never a marketing claim. */
  meta: string;
  accent: string;
  icon: ReactNode;
}

const CARD_BASE =
  "group relative flex h-full flex-col gap-3 overflow-hidden rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 text-start " +
  "shadow-elevation-1 transition-[transform,box-shadow,border-color] duration-short3 ease-standard " +
  "hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--pc-accent)_45%,transparent)] hover:shadow-elevation-3 " +
  "active:translate-y-0 active:shadow-elevation-2 motion-reduce:transform-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)]";

/** The visible CTA — its shape differs per path (filled vs. outlined). */
function PathCta({
  label,
  filled,
  pending,
}: {
  label: string;
  filled: boolean;
  pending: boolean;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-labelLarge font-medium transition-colors duration-short3",
        filled
          ? "bg-[var(--pc-accent)] text-white"
          : "border border-[color:color-mix(in_srgb,var(--pc-accent)_45%,transparent)] text-[var(--pc-accent)] group-hover:bg-[var(--pc-soft)]",
      ].join(" ")}
    >
      {label}
      {pending ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current opacity-70 [border-inline-start-color:transparent] motion-reduce:animate-none"
        />
      ) : (
        <IconChevronLeft
          size={16}
          aria-hidden="true"
          className="transition-transform duration-short3 ease-standard group-hover:-translate-x-0.5 motion-reduce:transform-none"
        />
      )}
    </span>
  );
}

function PathCardBody({ spec }: { spec: PathCardSpec }) {
  // next/link's own navigation status: `{pending:false}` outside a Link,
  // so this is safe to call in any render (and in tests).
  const { pending } = useLinkStatus();
  const filled = spec.key === "draft";

  return (
    <>
      {/* One whisper of the accent in the far corner — the only decoration. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-14 -end-14 h-32 w-32 rounded-full bg-[radial-gradient(circle,var(--pc-soft)_0%,transparent_70%)]"
      />

      <div className="relative flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-medium bg-[var(--pc-soft)] text-[var(--pc-accent)] transition-transform duration-short3 ease-standard group-hover:scale-105 motion-reduce:transform-none"
        >
          {spec.icon}
        </span>
        <div className="min-w-0">
          <p className="text-labelSmall font-medium tracking-wide text-[var(--pc-accent)]">
            {spec.eyebrow}
          </p>
          <h2 className="mt-0.5 text-headlineSmall font-bold text-on-surface">{spec.title}</h2>
        </div>
      </div>

      <p className="relative text-body-2 leading-relaxed text-on-surface-variant">
        {spec.description}
      </p>

      <div className="relative mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-labelSmall text-muted">{spec.meta}</span>
        <PathCta label={spec.cta} filled={filled} pending={pending} />
      </div>
    </>
  );
}

function PathCard({ spec }: { spec: PathCardSpec }) {
  const { pending } = useLinkStatus();
  const accentVars = {
    "--pc-accent": spec.accent,
    "--pc-soft": `color-mix(in srgb, ${spec.accent} 12%, transparent)`,
  } as CSSProperties;

  return (
    <Link
      href={spec.href}
      style={accentVars}
      className={CARD_BASE}
      aria-busy={pending || undefined}
    >
      <PathCardBody spec={spec} />
    </Link>
  );
}

interface ContractPathCardsProps {
  className?: string;
}

export function ContractPathCards({ className = "" }: ContractPathCardsProps) {
  const templateCount = implementedContractDefinitions().length;

  // Both cards read from this one list, so the two can never drift apart.
  const paths: PathCardSpec[] = [
    {
      key: "draft",
      href: "/contracts/new",
      eyebrow: "ساخت پیش‌نویس",
      title: "تنظیم قرارداد",
      description:
        "قالب قرارداد خود را انتخاب کنید و پیش‌نویس را مرحله‌به‌مرحله، با راهنمای هر بخش، تکمیل کنید.",
      cta: "شروع تنظیم قرارداد",
      meta: `${toPersianNumber(templateCount)} قالب آماده`,
      accent: "var(--brand-green)",
      icon: <IconFilePen size={24} aria-hidden="true" />,
    },
    {
      key: "review",
      href: "/contracts/review",
      eyebrow: "تحلیل سند موجود",
      title: "بررسی قرارداد",
      description:
        "فایل قرارداد را بارگذاری کنید یا از پیش‌نویس‌ها و اسناد خود انتخاب کنید تا متن آن با منبع مشخص بررسی شود.",
      cta: "شروع بررسی قرارداد",
      meta: "بارگذاری فایل یا انتخاب سند موجود",
      accent: "var(--brand-teal)",
      icon: <IconFileSearch size={24} aria-hidden="true" />,
    },
  ];

  return (
    <div
      className={["grid grid-cols-1 gap-3 tablet:grid-cols-2", className]
        .filter(Boolean)
        .join(" ")}
    >
      {paths.map((spec) => (
        <PathCard key={spec.key} spec={spec} />
      ))}
    </div>
  );
}
