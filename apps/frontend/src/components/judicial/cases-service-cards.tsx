// ============================================================
// LEGALIR — /cases service section (two services, one row)
// ============================================================
// The /cases page answers one question before the history lists: «چه کاری
// می‌خواهی شروع کنی؟» These two cards are that answer, in the same visual
// language as /contracts' two path cards:
//
//   • ساخت پرونده جدید              — record an internal case (the page's
//                                     existing modal; same endpoint, same
//                                     idempotency key).
//   • تنظیم دادخواست و شکواییه تخصصی — the judicial drafting launcher.
//
// The judicial card never invents availability: title, description, CTA and
// the effective status all come from `GET /api/v1/judicial/card`. When the
// admin disables the service the CTA goes inert and the note explains why —
// the history below keeps every existing draft reachable, which is the
// promise §7 makes. A failing status call degrades to an honest "could not
// check" line and never to a fabricated CTA.
// ============================================================

"use client";

import Link, { useLinkStatus } from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  IconAdd,
  IconChevronLeft,
  IconFilePen,
  IconInfo,
  IconRefresh,
} from "@/lib/icons";
import { StatusBadge } from "@/components/shared";
import { useJudicialCard } from "@/hooks/useJudicial";
import {
  JUDICIAL_FAMILY_DESCRIPTION_FA,
  JUDICIAL_FAMILY_EYEBROW_FA,
  JUDICIAL_FAMILY_TITLE_FA,
  JUDICIAL_STATUS_TONE,
} from "@/lib/judicial/identity";

const CARD_MOTION =
  "transition-[transform,box-shadow,border-color] duration-short3 ease-standard " +
  "hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--pc-accent)_45%,transparent)] hover:shadow-elevation-3 " +
  "active:translate-y-0 active:shadow-elevation-2 motion-reduce:transform-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)]";

const CARD_BASE =
  "group relative flex h-full flex-col gap-3 overflow-hidden rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 text-start " +
  "shadow-elevation-1";

/** The same card shell without any hover/press motion (locked state). */
const CARD_LOCKED = `${CARD_BASE} border-dashed`;

function accentVars(accent: string): CSSProperties {
  return {
    "--pc-accent": accent,
    "--pc-soft": `color-mix(in srgb, ${accent} 12%, transparent)`,
  } as CSSProperties;
}

/** The visible CTA — filled for the primary path, outlined for the other. */
function CardCta({
  label,
  filled,
  inert,
}: {
  label: string;
  filled: boolean;
  inert?: boolean;
}) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-labelLarge font-medium transition-colors duration-short3",
        inert
          ? "cursor-not-allowed border border-[color:var(--color-outline-variant)] text-on-surface-variant opacity-60"
          : filled
            ? "bg-[var(--pc-accent)] text-white"
            : "border border-[color:color-mix(in_srgb,var(--pc-accent)_45%,transparent)] text-[var(--pc-accent)] group-hover:bg-[var(--pc-soft)]",
      ].join(" ")}
    >
      {label}
      {inert ? null : pending ? (
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

/** The shared top half of both cards: icon, eyebrow, title, description. */
function CardHead({
  eyebrow,
  title,
  description,
  icon,
  badge,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-14 -end-14 h-32 w-32 rounded-full bg-[radial-gradient(circle,var(--pc-soft)_0%,transparent_70%)]"
      />

      <div className="relative flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-medium bg-[var(--pc-soft)] text-[var(--pc-accent)] transition-transform duration-short3 ease-standard group-hover:scale-105 motion-reduce:transform-none"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-labelSmall font-medium tracking-wide text-[var(--pc-accent)]">
            {eyebrow}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h2 className="text-headlineSmall font-bold text-on-surface">{title}</h2>
            {badge}
          </div>
        </div>
      </div>

      <p className="relative text-body-2 leading-relaxed text-on-surface-variant">
        {description}
      </p>
    </>
  );
}

// ------------------------------------------------------------
// Card 1 — internal case creation (opens the page's own modal)
// ------------------------------------------------------------

function NewCaseServiceCard({
  caseCount,
  onCreate,
}: {
  caseCount: number | null;
  onCreate: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCreate}
      style={accentVars("var(--brand-green)")}
      className={`${CARD_BASE} ${CARD_MOTION}`}
    >
      <CardHead
        eyebrow="پرونده‌های حقوقی"
        title="ساخت پرونده جدید"
        description="موضوع را ثبت کنید تا مدارک، وظایف و پیگیری‌های آن پرونده در یک جا جمع شود."
        icon={<IconAdd size={24} aria-hidden="true" />}
      />

      <div className="relative mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-labelSmall text-muted">
          {caseCount === null
            ? "پرونده‌های شما"
            : `${toPersianNumber(caseCount)} پروندهٔ ثبت‌شده`}
        </span>
        <CardCta label="ثبت پرونده جدید" filled />
      </div>
    </button>
  );
}

// ------------------------------------------------------------
// Card 2 — judicial drafting (a real route, gated by the server)
// ------------------------------------------------------------

/**
 * The drafting card's INNER content. Split out because the outer element
 * differs by state: a `Link` when the server says enterable, a static
 * `div` when it does not (a locked card must not be a hyperlink).
 */
function JudicialDraftCardBody() {
  const { data, isError, refetch } = useJudicialCard();
  const summary = data?.summary;
  const enabled = summary?.availability.enabled ?? false;

  return (
    <>
      <CardHead
        eyebrow={JUDICIAL_FAMILY_EYEBROW_FA}
        title={JUDICIAL_FAMILY_TITLE_FA}
        description={JUDICIAL_FAMILY_DESCRIPTION_FA}
        icon={<IconFilePen size={24} aria-hidden="true" />}
        badge={
          summary ? (
            <StatusBadge
              label={summary.availability.statusLabelFa}
              tone={JUDICIAL_STATUS_TONE[summary.settings.status] ?? "neutral"}
              dot={false}
            />
          ) : undefined
        }
      />

      {isError ? (
        <p className="relative flex items-start gap-1.5 rounded-medium bg-surface-container-low px-2.5 py-2 text-caption leading-6 text-on-surface-variant">
          <IconInfo size={14} className="mt-1 shrink-0" />
          وضعیت این خدمت خوانده نشد؛ درخواست‌های قبلی همچنان در تب تاریخچه در دسترس‌اند.
        </p>
      ) : (
        !enabled &&
        summary && (
          <p className="relative flex items-start gap-1.5 rounded-medium bg-surface-container-low px-2.5 py-2 text-caption leading-6 text-on-surface-variant">
            <IconInfo size={14} className="mt-1 shrink-0" />
            {summary.availability.noteFa ??
              summary.settings.statusNoteFa ??
              "شروع درخواست جدید در حال حاضر بسته است. پیش‌نویس‌ها و درخواست‌های قبلی شما حذف نمی‌شوند و در تب تاریخچه در دسترس‌اند."}
          </p>
        )
      )}

      <div className="relative mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-labelSmall text-muted">
          {summary && summary.openCount > 0
            ? `${toPersianNumber(summary.openCount)} درخواست در جریان`
            : "اظهارنامه · لایحه · دادخواست · شکواییه"}
        </span>
        {isError ? (
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1.5 text-labelLarge text-[var(--pc-accent)] hover:underline"
          >
            <IconRefresh size={16} />
            تلاش مجدد
          </button>
        ) : (
          <CardCta
            label={summary?.settings.ctaFa ?? "شروع تنظیم"}
            filled={false}
            inert={!enabled}
          />
        )}
      </div>
    </>
  );
}

function JudicialDraftCard() {
  const { data, isLoading } = useJudicialCard();
  const style = accentVars("var(--brand-teal)");

  if (isLoading) {
    return (
      <div
        aria-hidden="true"
        style={style}
        className={`${CARD_BASE} animate-pulse`}
      >
        <div className="h-12 w-12 rounded-medium bg-surface-container" />
        <div className="mt-3 h-5 w-56 rounded bg-surface-container" />
        <div className="mt-2 h-4 w-full max-w-sm rounded bg-surface-container" />
        <div className="mt-6 h-9 w-36 rounded-full bg-surface-container" />
      </div>
    );
  }

  // Hidden by the admin on this surface — the section renders the remaining
  // card alone and the case history below is untouched.
  if (data && !data.summary.availability.visible) return null;

  const enabled = data?.summary.availability.enabled ?? false;

  if (!enabled) {
    // A locked service keeps its identity and explains itself; it is not a
    // link, so nothing can be opened that the server would refuse.
    return (
      <div style={style} className={CARD_LOCKED} aria-disabled="true">
        <JudicialDraftCardBody />
      </div>
    );
  }

  return (
    <Link
      href={`/judicial?type=petition`}
      style={style}
      className={`${CARD_BASE} ${CARD_MOTION}`}
    >
      <JudicialDraftCardBody />
    </Link>
  );
}

// ------------------------------------------------------------
// The section
// ------------------------------------------------------------

export function CasesServiceCards({
  caseCount,
  onCreateCase,
}: {
  /** The caller's registered case count, or null while it is still loading. */
  caseCount: number | null;
  /** Opens the page's own create-case modal. */
  onCreateCase: () => void;
}) {
  const { data, isLoading } = useJudicialCard();
  // While the status is still loading the grid keeps both columns reserved,
  // so the page does not reflow when the card resolves.
  const judicialVisible =
    isLoading || !data || data.summary.availability.visible;

  return (
    <section aria-label="خدمات پرونده‌ها" className="mt-4">
      <div
        className={[
          "grid grid-cols-1 gap-3",
          judicialVisible ? "tablet:grid-cols-2" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <NewCaseServiceCard caseCount={caseCount} onCreate={onCreateCase} />
        <JudicialDraftCard />
      </div>
    </section>
  );
}
