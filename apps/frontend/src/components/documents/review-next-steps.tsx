// ============================================================
// LEGALIR — Review next steps (the smart post-review card)
// ============================================================
// After the analysis (and any clarifying answers), the user needs to know
// what to DO — not another wall of findings. This card offers up to three
// real LEGALIR services, each with the reason it is shown:
//
//   1. ساخت پیش‌نویس قرارداد  → /contracts/new?type=<id>
//      only when a real implemented template matches the document;
//   2. وکلای این حوزه          → /lawyers?category=<slug>
//      only when the marketplace really has lawyers in that category;
//   3. ماشین‌حساب حقوقی        → /calculators/<slug>
//      only when a real calculator computes something this document
//      genuinely contains (a penalty clause, a deposit, a salary, …).
//
// HONESTY RULES (user spec §5):
//   • no static or unrelated suggestion — every row is derived from the
//     document's own content and resolved against real data;
//   • a suggestion with no real data behind it is NOT rendered at all
//     (no empty card, no "coming soon");
//   • every row carries a one-line reason;
//   • the card sits BELOW the analysis result, never over it, and each
//     action is optional — nothing is forced.
// ============================================================

"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { RiskReport } from "@legalir/types";
import { LEGAL_CATEGORY_FA } from "@legalir/types";
import { Card } from "@legalir/ui";
import { useLawyers } from "@/hooks/useLawyers";
import { deriveNextSteps } from "@/lib/documents/review-insights";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  IconArrowBack,
  IconCalculator,
  IconFilePen,
  IconSparkle,
  IconUsers,
} from "@/lib/icons";

interface SuggestionRowProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  reason: string;
  cta: string;
  tone: "primary" | "secondary" | "neutral";
}

const TONE_CLASS: Record<SuggestionRowProps["tone"], string> = {
  primary: "bg-primary-container text-primary",
  secondary: "bg-secondary-container text-secondary",
  neutral: "bg-surface-container text-on-surface-variant",
};

function SuggestionRow({ href, icon, title, reason, cta, tone }: SuggestionRowProps) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-medium border border-[color:var(--color-outline-variant)] bg-surface p-3 text-start transition-[border-color,box-shadow] duration-short3 ease-standard hover:border-primary hover:shadow-elevation-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)]"
    >
      <span
        aria-hidden="true"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-medium ${TONE_CLASS[tone]}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body-2 font-medium text-on-surface">{title}</span>
        <span className="mt-0.5 block text-caption leading-relaxed text-muted">
          {reason}
        </span>
        <span className="mt-1.5 inline-flex items-center gap-1 text-caption font-medium text-primary">
          {cta}
          <IconArrowBack
            size={14}
            aria-hidden="true"
            className="transition-transform duration-short3 ease-standard group-hover:-translate-x-0.5 motion-reduce:transform-none"
          />
        </span>
      </span>
    </Link>
  );
}

interface ReviewNextStepsProps {
  documentName?: string | null;
  report: RiskReport | null;
  extractedText?: string | null;
  /**
   * Set to `false` when the page already renders the full lawyer section,
   * so the same offer is not repeated twice on one screen.
   */
  showLawyer?: boolean;
  className?: string;
}

export function ReviewNextSteps({
  documentName = null,
  report,
  extractedText = null,
  showLawyer = true,
  className = "",
}: ReviewNextStepsProps) {
  const model = useMemo(
    () => deriveNextSteps({ documentName, report, extractedText }),
    [documentName, report, extractedText]
  );

  // The lawyer row is shown only when the REAL marketplace has listings in
  // this subject's category. While loading we render nothing for it, so the
  // card never promises a lawyer it cannot show.
  const lawyerQuery = useLawyers(
    { category: model.lawyerCategory ?? undefined, sort: "rating", pageSize: 3 },
    { enabled: showLawyer && model.lawyerCategory !== null }
  );
  const lawyerCount = lawyerQuery.data?.pagination?.total ?? 0;
  const showLawyers =
    showLawyer &&
    model.lawyerCategory !== null &&
    !lawyerQuery.isLoading &&
    !lawyerQuery.isError &&
    lawyerCount > 0;

  const rows = [model.draft !== null, showLawyers, model.calculator !== null].filter(
    Boolean
  ).length;

  // Nothing real to offer → no card at all.
  if (rows === 0) return null;

  const lawyerCategoryLabel = model.lawyerCategory
    ? LEGAL_CATEGORY_FA[model.lawyerCategory] ?? model.lawyerCategory
    : null;

  return (
    <Card variant="outlined" padding="medium" className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary"
        >
          <IconSparkle size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-titleSmall text-on-surface">قدم بعدی</h3>
          <p className="mt-0.5 text-caption leading-relaxed text-muted">
            این پیشنهادها از نتیجهٔ همین بررسی انتخاب شده‌اند؛ هیچ‌کدام الزامی
            نیستند و می‌توانید بی‌انجام‌شان بگذارید.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 animate-fade-in motion-reduce:animate-none">
        {model.draft && (
          <SuggestionRow
            href={`/contracts/new?type=${encodeURIComponent(model.draft.typeId)}`}
            icon={<IconFilePen size={18} />}
            title={`ساخت پیش‌نویس «${model.draft.titleFa}»`}
            reason={model.draft.reasonFa}
            cta="شروع تنظیم قرارداد"
            tone="primary"
          />
        )}

        {showLawyers && model.lawyerCategory && (
          <SuggestionRow
            href={`/lawyers?category=${encodeURIComponent(model.lawyerCategory)}`}
            icon={<IconUsers size={18} />}
            title="مشاوره با وکیل این حوزه"
            reason={`${toPersianNumber(lawyerCount)} وکیل در حوزهٔ «${lawyerCategoryLabel}» در بازار لیگالیر ثبت شده‌اند. این فهرست یک پیشنهاد عمومی است، نه انتخاب خودکار برای این سند.`}
            cta="مشاهدهٔ وکلا"
            tone="secondary"
          />
        )}

        {model.calculator && (
          <SuggestionRow
            href={`/calculators/${encodeURIComponent(model.calculator.slug)}`}
            icon={<IconCalculator size={18} />}
            title={`ماشین‌حساب «${model.calculator.titleFa}»`}
            reason={model.calculator.reasonFa}
            cta="محاسبه کنید"
            tone="neutral"
          />
        )}
      </div>
    </Card>
  );
}
