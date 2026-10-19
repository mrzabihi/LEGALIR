// ============================================================
// LEGALIR — Review digest (subject · structure · attention · limits)
// ============================================================
// Sits ABOVE the six-tab result surface and answers, in plain language
// and in a fixed order:
//
//   1. «موضوع سند»                  subject, with the real keywords that
//                                   led to it;
//   2. «ساختار سند»                 the headings actually found in the
//                                   extracted text;
//   3. «بخش‌های نیازمند توجه»        the pipeline's findings, ordered by
//                                   real severity, each with its locator;
//   4. «محدودیت‌های این تحلیل»       what could NOT be established, plus
//                                   the standing disclaimer.
//
// HONESTY RULES (user spec §4):
//   • the subject is a MATCH against real template keywords; when no
//     rule matched, the card says «مشخص نشد» and shows nothing invented;
//   • the structure is read from the real extracted text; when there is
//     none, it says so;
//   • the limitations block always states that LegalIR checks sources
//     and laws but does not claim complete, error-free mastery of the
//     law, and that a missing source is stated rather than filled in.
// ============================================================

"use client";

import { useMemo } from "react";
import type { DocumentFinding, RiskLevel, RiskReport } from "@legalir/types";
import { Card } from "@legalir/ui";
import {
  buildAttentionList,
  buildHaystack,
  detectSections,
  detectSubject,
  reviewLimitations,
} from "@/lib/documents/review-insights";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  IconFileSearch,
  IconInfo,
  IconLawBook,
  IconLinkSource,
  IconWarning,
} from "@/lib/icons";

const SEVERITY_LABEL: Record<RiskLevel, string> = {
  critical: "بحرانی",
  high: "زیاد",
  medium: "متوسط",
  low: "کم",
};

const SEVERITY_CHIP: Record<RiskLevel, string> = {
  critical: "bg-error-container text-error border-error",
  high: "bg-warning-container text-warning border-warning",
  medium: "bg-warning-container text-warning border-warning",
  low: "bg-success-container text-success border-success",
};

interface ReviewDigestProps {
  report: RiskReport | null;
  extractedText?: string | null;
  documentName?: string | null;
  /** Jumps to the findings tab when the user asks for the full list. */
  onShowAllFindings?: () => void;
  className?: string;
}

export function ReviewDigest({
  report,
  extractedText = null,
  documentName = null,
  onShowAllFindings,
  className = "",
}: ReviewDigestProps) {
  const insights = useMemo(() => {
    const haystack = buildHaystack({ documentName, report, extractedText });
    const findings: DocumentFinding[] = report?.findings ?? [];
    return {
      subject: detectSubject(haystack),
      sections: detectSections(extractedText),
      attention: buildAttentionList(findings),
      limitations: reviewLimitations({ report, extractedText }),
      totalFindings: findings.length,
      citedFindings: findings.filter((finding) => finding.citation).length,
    };
  }, [documentName, report, extractedText]);

  const { subject, sections, attention, limitations } = insights;

  return (
    <section
      aria-label="خلاصهٔ ساختاری بررسی"
      dir="rtl"
      className={`grid grid-cols-1 gap-3 laptop:grid-cols-2 ${className}`}
    >
      {/* 1 — Subject */}
      <Card variant="outlined" padding="medium" className="flex flex-col gap-2">
        <Header icon={<IconFileSearch size={18} />} title="موضوع سند" />
        {subject ? (
          <>
            <p className="text-body-2 font-medium text-on-surface">{subject.titleFa}</p>
            <p className="text-caption text-muted leading-relaxed">
              این تشخیص از روی عبارت‌های موجود در متن سند انجام شده است، نه از
              روی نام فایل.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {subject.evidenceFa.map((word) => (
                <span
                  key={word}
                  className="rounded-full bg-surface-container px-2.5 py-0.5 text-caption text-on-surface-variant"
                >
                  {word}
                </span>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-body-2 font-medium text-on-surface">
              موضوع سند به‌طور قطعی مشخص نشد
            </p>
            <p className="text-caption text-muted leading-relaxed">
              متن سند به هیچ‌یک از قالب‌های شناخته‌شدهٔ لیگالیر نزدیک نبود. برای
              تشخیص دقیق‌تر، موضوع قرارداد را در گفتگوی همین سند بنویسید.
            </p>
          </>
        )}
      </Card>

      {/* 2 — Structure */}
      <Card variant="outlined" padding="medium" className="flex flex-col gap-2">
        <Header icon={<IconLawBook size={18} />} title="ساختار سند" />
        {sections.length > 0 ? (
          <>
            <p className="text-caption text-muted">
              {toPersianNumber(sections.length)} سرفصل یا بند در متن استخراج‌شده
              شناسایی شد.
            </p>
            <ul className="flex flex-col gap-1">
              {sections.map((section) => (
                <li
                  key={section.labelFa}
                  className="flex items-start gap-2 text-caption text-on-surface"
                >
                  <span
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-words">{section.labelFa}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-caption text-muted leading-relaxed">
            از متن این سند سرفصل قابل‌خواندنی استخراج نشد؛ بنابراین ساختار
            بندبه‌بند آن تأیید نشده است. برای اسناد اسکن‌شده یا تصویری، استخراج
            متن همیشه کامل نیست.
          </p>
        )}
      </Card>

      {/* 3 — Attention, in order */}
      <Card variant="outlined" padding="medium" className="flex flex-col gap-2">
        <Header icon={<IconWarning size={18} />} title="بخش‌های نیازمند توجه" />
        {attention.length > 0 ? (
          <>
            <ol className="flex flex-col gap-2">
              {attention.map((item, index) => (
                <li key={item.findingId} className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-container text-caption font-medium text-on-surface-variant"
                  >
                    {toPersianNumber(index + 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-caption font-medium text-on-surface">{item.titleFa}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-caption text-muted">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${SEVERITY_CHIP[item.severity]}`}
                      >
                        {SEVERITY_LABEL[item.severity]}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <IconLinkSource size={12} aria-hidden="true" />
                        {item.locatorFa}
                      </span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {insights.totalFindings > attention.length && (
              <p className="text-caption text-muted">
                {toPersianNumber(insights.totalFindings - attention.length)} یافتهٔ
                دیگر در تب «ایرادها و ریسک‌ها» آمده است.
              </p>
            )}
            {onShowAllFindings && (
              <button
                type="button"
                onClick={onShowAllFindings}
                className="mt-1 self-start rounded-small text-caption font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                مشاهدهٔ فهرست کامل یافته‌ها
              </button>
            )}
          </>
        ) : (
          <p className="text-caption text-muted leading-relaxed">
            یافته‌ای برای این سند ثبت نشده است. نبود یافته به‌معنای بی‌ایراد بودن
            سند نیست؛ فقط یعنی تحلیل فعلی موردی را علامت نزده است.
          </p>
        )}
      </Card>

      {/* 4 — Limitations, stated plainly */}
      <Card variant="outlined" padding="medium" className="flex flex-col gap-2">
        <Header icon={<IconInfo size={18} />} title="محدودیت‌های این تحلیل" />
        <ul className="flex flex-col gap-1.5 text-caption text-muted leading-relaxed">
          {limitations.noSources && (
            <LimitItem>
              هیچ‌یک از یافته‌های این بررسی به منبع قانونی مشخصی ارجاع نشده است؛
              بنابراین در این موارد، نتیجه بر پایهٔ متن سند است و نه یک مادهٔ
              مشخص.
            </LimitItem>
          )}
          {limitations.lowConfidence && (
            <LimitItem>
              اطمینان کلی تحلیل پایین است؛ پیش از تصمیم‌گیری، متن سند را با یک
              متخصص حقوقی مرور کنید.
            </LimitItem>
          )}
          {limitations.noExtractedText && (
            <LimitItem>
              متن سند استخراج نشد؛ تحلیل فقط بر پایهٔ اطلاعات قابل‌دسترسی انجام
              شده و ممکن است بخش‌هایی از سند دیده نشده باشد.
            </LimitItem>
          )}
          {limitations.incompleteCount > 0 && (
            <LimitItem>
              {toPersianNumber(limitations.incompleteCount)} مورد به‌عنوان
              «اطلاعات ناقص» علامت خورده است؛ تا تکمیل آن‌ها، نتیجه دربارهٔ همان
              بخش‌ها قطعی نیست.
            </LimitItem>
          )}
          {limitations.noReport && (
            <LimitItem>
              هنوز تحلیلی برای این سند ثبت نشده است؛ هیچ نتیجه‌ای در دسترس نیست.
            </LimitItem>
          )}
          {insights.totalFindings > 0 && (
            <LimitItem>
              {toPersianNumber(insights.citedFindings)} از{" "}
              {toPersianNumber(insights.totalFindings)} یافته منبع مشخص دارد.
            </LimitItem>
          )}
        </ul>
        <div className="mt-1 flex items-start gap-2 rounded-medium bg-surface-container p-2.5">
          <IconInfo size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
          <p className="text-caption leading-relaxed text-muted">
            لیگالیر متن سند را با منابع و قوانین در دسترس مقایسه می‌کند، اما ادعای
            احاطهٔ کامل و بی‌خطا بر همهٔ قوانین را ندارد. هر یافته تا حد امکان به
            منبع مشخص پیوند داده شده است و اگر منبع کافی در دسترس نبوده، همان
            محدودیت در همین بخش گفته شده است.
          </p>
        </div>
      </Card>
    </section>
  );
}

// ============================================================
// Small presentational helpers
// ============================================================

function Header({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-primary" aria-hidden="true">
        {icon}
      </span>
      <h3 className="text-titleSmall text-on-surface">{title}</h3>
    </div>
  );
}

function LimitItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}
