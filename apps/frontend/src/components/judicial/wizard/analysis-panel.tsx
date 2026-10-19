// ============================================================
// LEGALIR — Judicial step-4 framing
// ============================================================
// Before any prose is written, the user sees WHAT the request is built from:
// the probable path, the parties, the demand, the chronology, the evidence,
// the gaps, and the items only they can confirm.
//
// Four provenances are kept visibly separate, as the brief requires:
//   • the user's own statements            (نقل قول شما)
//   • what is still missing / ambiguous    (پرسش و ابهام)
//   • what must be verified elsewhere      (فقط شما می‌توانید تأیید کنید)
//   • legal references, ONLY when real     (منبع حقوقی)
//
// Nothing here is a diagnosis, a filing, or an article number the model
// guessed: the server composes this projection from stored answers only.
// ============================================================

"use client";

import { Button } from "@legalir/ui";
import type {
  JudicialAnalysis,
  JudicialCompleteness,
  JudicialDraftReference,
  JudicialMissingField,
} from "@legalir/types";
import { JUDICIAL_DOCUMENT_TYPE_FA } from "@legalir/types";
import { IconInfo, IconLawBook, IconRefresh, IconWarning } from "@/lib/icons";

const CONFIDENCE_FA: Record<JudicialAnalysis["confidence"], string> = {
  low: "اطمینان پایین",
  medium: "اطمینان متوسط",
  high: "اطمینان بالا",
};

function ListBlock({
  title,
  items,
  tone = "default",
  emptyFa,
}: {
  title: string;
  items: string[];
  tone?: "default" | "warning";
  emptyFa?: string;
}) {
  if (items.length === 0 && !emptyFa) return null;
  return (
    <div>
      <h3 className="text-titleSmall text-on-surface">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-caption text-on-surface-variant">{emptyFa}</p>
      ) : (
        <ul
          className={[
            "mt-1 list-disc space-y-1 pe-5 text-body-2 leading-6",
            tone === "warning" ? "text-warning-700" : "text-on-surface-variant",
          ].join(" ")}
        >
          {items.map((item, i) => (
            <li key={`${i}-${item}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SourceList({ sources }: { sources: JudicialDraftReference[] }) {
  if (sources.length === 0) {
    return (
      <p className="mt-1 text-caption leading-6 text-on-surface-variant">
        برای این درخواست منبع حقوقی مشخصی بازیابی نشد. لیگالیر در این حالت هیچ
        ماده یا استناد حقوقی نمی‌سازد.
      </p>
    );
  }
  return (
    <ul className="mt-1 space-y-1.5">
      {sources.map((source) => (
        <li
          key={`${source.sourceId}-${source.locator}`}
          className="rounded-medium border border-[color:var(--color-outline-variant)] p-2.5"
        >
          <p className="text-labelLarge text-on-surface">{source.title}</p>
          <p className="mt-0.5 text-caption text-on-surface-variant">
            {source.locator}
            {" · "}
            {source.tierFa}
          </p>
        </li>
      ))}
    </ul>
  );
}

export interface AnalysisPanelProps {
  analysis: JudicialAnalysis | null;
  completeness: JudicialCompleteness;
  missing: JudicialMissingField[];
  /** True while a generation request is in flight. */
  generating: boolean;
  /** Set when the server refused generation because inputs are incomplete. */
  refusalFa: string | null;
  onAnalyze: () => void;
  onGenerate: () => void;
  onFixAnswers: () => void;
  analyzing: boolean;
}

export function AnalysisPanel({
  analysis,
  completeness,
  missing,
  generating,
  refusalFa,
  onAnalyze,
  onGenerate,
  onFixAnswers,
  analyzing,
}: AnalysisPanelProps) {
  const canGenerate = completeness.complete && !completeness.routingUndetermined;

  return (
    <section
      aria-labelledby="judicial-analysis-title"
      className="space-y-4 rounded-large border border-[color:var(--color-outline-variant)] bg-surface p-4 tablet:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2
            id="judicial-analysis-title"
            className="text-titleMedium text-on-surface"
          >
            جمع‌بندی پیش از تنظیم پیش‌نویس
          </h2>
          <p className="mt-1 max-w-2xl text-body-2 leading-6 text-on-surface-variant">
            این جمع‌بندی فقط از گفته‌های خودتان و مدارک پیوست ساخته می‌شود؛
            تشخیص قطعی، تعیین مرجع صالح یا پیش‌بینی نتیجه نیست.
          </p>
        </div>
        <Button
          variant="outlined"
          size="small"
          onClick={onAnalyze}
          loading={analyzing}
          startIcon={<IconRefresh size={16} />}
        >
          بازخوانی جمع‌بندی
        </Button>
      </div>

      {completeness.routingUndetermined && (
        <div className="rounded-medium bg-warning-50 px-3 py-2 text-caption leading-6 text-warning-700">
          <p className="flex items-center gap-1.5 font-medium">
            <IconWarning size={15} className="shrink-0" />
            نوع سند هنوز مشخص نشده است.
          </p>
          <p className="mt-1">
            تا روشن نشدن مرز حقوقی/کیفری، پیش‌نویس ساخته نمی‌شود. توضیح خود را
            کامل‌تر کنید یا نوع را خودتان انتخاب کنید.
          </p>
        </div>
      )}

      {analysis && (
        <>
          <div className="rounded-medium bg-surface-container-low p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-labelLarge text-on-surface">
                مسیر احتمالی:{" "}
                {analysis.likelyType === "undetermined"
                  ? "هنوز روشن نیست"
                  : JUDICIAL_DOCUMENT_TYPE_FA[analysis.likelyType]}
              </span>
              <span className="rounded-full bg-surface-container px-2 py-0.5 text-caption text-on-surface-variant">
                {CONFIDENCE_FA[analysis.confidence]}
              </span>
            </div>
            <p className="mt-1 text-caption leading-6 text-on-surface-variant">
              {analysis.reasonFa}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
            <ListBlock
              title="طرفین (به گفتهٔ شما)"
              items={analysis.parties.map((p) => `${p.roleFa}: ${p.nameFa}`)}
              emptyFa="هنوز طرفی از گفته‌های شما استخراج نشده است."
            />
            <ListBlock
              title="روایت و ترتیب زمانی"
              items={analysis.chronologyFa}
              emptyFa="تاریخ‌ها و ترتیب وقایع هنوز ثبت نشده است."
            />
            <ListBlock
              title="دلایل و مستندات"
              items={analysis.evidenceFa}
              emptyFa="مدرکی پیوست نشده است."
            />
            <ListBlock
              title="موارد ناقص"
              items={[
                ...analysis.missingFa,
                ...missing.map((m) => `${m.labelFa}: ${m.reasonFa}`),
              ]}
              tone="warning"
              emptyFa="مورد ناقصی برای تنظیم پیش‌نویس دیده نشد."
            />
          </div>

          {analysis.subjectFa && (
            <div>
              <h3 className="text-titleSmall text-on-surface">موضوع</h3>
              <p className="mt-1 text-body-2 leading-6 text-on-surface-variant">
                {analysis.subjectFa}
              </p>
            </div>
          )}
          {analysis.demandFa && (
            <div>
              <h3 className="text-titleSmall text-on-surface">خواسته</h3>
              <p className="mt-1 text-body-2 leading-6 text-on-surface-variant">
                {analysis.demandFa}
              </p>
            </div>
          )}

          <ListBlock
            title="ابهام‌ها و ناسازگاری‌ها"
            items={[...analysis.ambiguitiesFa, ...completeness.contradictions]}
            tone="warning"
            emptyFa="تناقض یا ابهام روشنی در پاسخ‌ها دیده نشد."
          />

          <ListBlock
            title="مواردی که فقط شما می‌توانید تأیید کنید"
            items={analysis.mustVerifyFa}
          />

          <div>
            <h3 className="flex items-center gap-1.5 text-titleSmall text-on-surface">
              <IconLawBook size={16} className="text-on-surface-variant" />
              منابع حقوقی استفاده‌شده
            </h3>
            <SourceList sources={analysis.sources} />
          </div>
        </>
      )}

      {!analysis && !completeness.routingUndetermined && (
        <p className="text-body-2 text-on-surface-variant">
          جمع‌بندی هنوز ساخته نشده است. دکمهٔ «بازخوانی جمع‌بندی» آن را از روی
          پاسخ‌های فعلی می‌سازد.
        </p>
      )}

      {refusalFa && (
        <p
          role="alert"
          className="rounded-medium bg-error-container px-3 py-2 text-body-2 text-error"
        >
          {refusalFa}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={onGenerate}
          loading={generating}
          disabled={!canGenerate}
        >
          ساخت پیش‌نویس قابل بازبینی
        </Button>
        {!completeness.complete && (
          <Button variant="outlined" onClick={onFixAnswers}>
            تکمیل پاسخ‌ها
          </Button>
        )}
        <span className="flex items-start gap-1.5 text-caption leading-6 text-on-surface-variant">
          <IconInfo size={14} className="mt-1 shrink-0" />
          ساخت پیش‌نویس، ثبت دادخواست یا شکایت در مرجع قضایی نیست.
        </span>
      </div>
    </section>
  );
}
