// ============================================================
// LEGALIR — Review Result Surface (spec §11)
// ============================================================
// The result of a contract/document review is presented as a fixed set
// of six tabs. The tab vocabulary lives in `@/lib/contracts/review-flow`
// so the surface and its tests can never drift apart.
//
// HONESTY RULES (spec §1, §10, §11):
//   • No fabricated "health %". The only number shown is the pipeline's
//     own confidence, and it is labelled as such.
//   • Findings are separated by their real nature (conflict with law /
//     contractual risk / incomplete info / OCR error). When the pipeline
//     did not classify a finding, we derive the kind from a real signal
//     (a citation ⇒ conflict with law) rather than inventing one.
//   • Every citation shows its source name, article/locator, status and
//     jurisdiction — never a bare number.
//   • The document tab shows the real extracted text and the real
//     locators; it never invents a position that the pipeline did not
//     report.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import type {
  Citation,
  DocumentFinding,
  FindingKind,
  LegalSource,
  RiskReport,
  SourceStatus,
} from "@legalir/types";
import { Button, Card, EmptyState, Tabs } from "@legalir/ui";
import {
  DEFAULT_REVIEW_RESULT_TAB,
  REVIEW_RESULT_TABS,
  type ReviewResultTab,
} from "@/lib/contracts/review-flow";
import { RiskSummary } from "./risk-summary";
import { FindingCard } from "./finding-card";
import { TrialBadge } from "./trial-badge";
import {
  IconChat,
  IconDocument,
  IconFileSearch,
  IconInfo,
  IconLawBook,
  IconLinkSource,
  IconWarning,
} from "@/lib/icons";

// ============================================================
// Finding kind — labels, order and honest derivation
// ============================================================

const KIND_LABELS: Record<FindingKind, string> = {
  conflict_with_law: "مغایرت با قانون",
  contractual_risk: "ریسک قراردادی",
  incomplete_info: "اطلاعات ناقص",
  ocr_error: "خطای استخراج متن",
};

const KIND_ORDER: FindingKind[] = [
  "conflict_with_law",
  "contractual_risk",
  "incomplete_info",
  "ocr_error",
];

/**
 * The nature of a finding. When the pipeline classified it we use that;
 * otherwise we derive it from a real signal — a finding backed by a legal
 * citation is a conflict with law, everything else is a contractual risk.
 * We never guess "incomplete info" or "OCR error" without evidence.
 */
function kindOf(finding: DocumentFinding): FindingKind {
  if (finding.kind) return finding.kind;
  return finding.citation ? "conflict_with_law" : "contractual_risk";
}

function groupByKind(findings: DocumentFinding[]): Map<FindingKind, DocumentFinding[]> {
  const groups = new Map<FindingKind, DocumentFinding[]>();
  for (const finding of findings) {
    const kind = kindOf(finding);
    const bucket = groups.get(kind);
    if (bucket) bucket.push(finding);
    else groups.set(kind, [finding]);
  }
  return groups;
}

// ============================================================
// Sources — collect and de-duplicate citations
// ============================================================

const SOURCE_STATUS_LABELS: Record<SourceStatus, string> = {
  valid: "معتبر",
  amended: "اصلاح‌شده",
  expired: "منقضی",
  needs_review: "نیازمند بازبینی",
};

const SOURCE_STATUS_CLASSES: Record<SourceStatus, string> = {
  valid: "bg-green-100 text-green-800 border-green-200",
  amended: "bg-yellow-100 text-yellow-800 border-yellow-200",
  expired: "bg-red-100 text-red-800 border-red-200",
  needs_review: "bg-orange-100 text-orange-800 border-orange-200",
};

const SOURCE_TYPE_LABELS: Record<LegalSource["type"], string> = {
  law: "قانون",
  regulation: "آیین‌نامه",
  precedent: "رویه قضایی",
  directive: "بخشنامه",
  opinion: "نظر مشورتی",
  user_document: "سند کاربر",
};

/** One de-duplicated citation, keyed by source + locator. */
interface CollectedSource {
  key: string;
  citation: Citation;
  source: LegalSource;
}

function collectSources(findings: DocumentFinding[]): CollectedSource[] {
  const seen = new Map<string, CollectedSource>();
  for (const finding of findings) {
    const citation = finding.citation;
    if (!citation) continue;
    const key = `${citation.sourceId}:${citation.locator}`;
    if (seen.has(key)) continue;
    seen.set(key, { key, citation, source: citation.source });
  }
  return Array.from(seen.values());
}

// ============================================================
// ReviewResult component
// ============================================================

interface ReviewResultProps {
  report: RiskReport | null;
  /** The document's extracted text, for the «سند و نشانه‌گذاری» tab. */
  extractedText?: string | null;
  /** Called when the user asks about a specific finding (spec §12). */
  onAskAboutFinding?: (finding: DocumentFinding) => void;
  /**
   * True when the report is a trial scenario, not a real analysis of the
   * user's document. Adds a persistent «نمونهٔ آزمایشی» marker to the
   * whole surface so a demo result is never mistaken for a real one.
   */
  trial?: boolean;
  /** The scenario name, shown in the trial marker when present. */
  trialLabel?: string | null;
}

export function ReviewResult({
  report,
  extractedText = null,
  onAskAboutFinding,
  trial = false,
  trialLabel = null,
}: ReviewResultProps) {
  const [tab, setTab] = useState<ReviewResultTab>(DEFAULT_REVIEW_RESULT_TAB);

  const findings = report?.findings ?? [];

  const { missing, suggestions, sources, counts } = useMemo(() => {
    const grouped = groupByKind(findings);
    const missingFindings = grouped.get("incomplete_info") ?? [];
    const suggestionFindings = findings.filter((f) => f.recommendation.trim().length > 0);
    const collected = collectSources(findings);
    return {
      missing: missingFindings,
      suggestions: suggestionFindings,
      sources: collected,
      counts: {
        findings: findings.length,
        missing: missingFindings.length,
        sources: collected.length,
        suggestions: suggestionFindings.length,
      } as Record<string, number>,
    };
  }, [findings]);

  const tabs = REVIEW_RESULT_TABS.map((t) => ({
    value: t.id,
    label: t.labelFa,
    badge: counts[t.id] && counts[t.id]! > 0 ? counts[t.id] : undefined,
  }));

  const activeDescriptor = REVIEW_RESULT_TABS.find((t) => t.id === tab);

  return (
    <section aria-label="نتیجه بررسی" dir="rtl" className="flex flex-col gap-4">
      {trial && (
        <div className="flex items-start gap-2 rounded-medium border border-secondary/30 bg-secondary/5 p-3">
          <TrialBadge
            label={trialLabel ? `نمونهٔ آزمایشی — ${trialLabel}` : undefined}
            className="shrink-0"
          />
          <p className="text-caption text-muted leading-relaxed">
            این نتیجه به سند شما مربوط نیست و یک دادهٔ نمایشی برای تست محصول
            است. برای تحلیل واقعی سند، اتصال به سرویس تحلیل لازم است.
          </p>
        </div>
      )}
      <Tabs tabs={tabs} value={tab} onChange={(v) => setTab(v as ReviewResultTab)} />

      {activeDescriptor && (
        <p className="text-caption text-muted">{activeDescriptor.descriptionFa}</p>
      )}

      <div role="tabpanel" aria-label={activeDescriptor?.labelFa}>
        {tab === "summary" && <SummaryTab report={report} />}
        {tab === "findings" && (
          <FindingsTab findings={findings} onAskAboutFinding={onAskAboutFinding} />
        )}
        {tab === "missing" && <MissingTab findings={missing} />}
        {tab === "sources" && <SourcesTab sources={sources} />}
        {tab === "suggestions" && <SuggestionsTab findings={suggestions} />}
        {tab === "document" && (
          <DocumentTab findings={findings} extractedText={extractedText} />
        )}
      </div>
    </section>
  );
}

// ============================================================
// Tab — خلاصه بررسی
// ============================================================

function SummaryTab({ report }: { report: RiskReport | null }) {
  if (!report || report.findings.length === 0) {
    return (
      <EmptyState
        title="خلاصه‌ای برای نمایش نیست"
        description="این سند هنوز تحلیل نشده یا یافته‌ای برای جمع‌بندی ندارد."
      />
    );
  }

  const grouped = groupByKind(report.findings);

  return (
    <div className="flex flex-col gap-4">
      <RiskSummary report={report} />

      {/* Findings grouped by their real nature */}
      <div className="flex flex-col gap-3">
        <h3 className="text-labelLarge text-on-surface font-medium">
          یافته‌ها بر اساس نوع
        </h3>
        {KIND_ORDER.map((kind) => {
          const bucket = grouped.get(kind);
          if (!bucket || bucket.length === 0) return null;
          return (
            <Card key={kind} variant="outlined" padding="medium" className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-body-2 font-medium text-on-surface">
                  {KIND_LABELS[kind]}
                </span>
                <span className="text-caption text-muted">{bucket.length} مورد</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {bucket.map((finding) => (
                  <li key={finding.id} className="text-caption text-muted leading-relaxed">
                    • {finding.title}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      <DisclaimerNote />
    </div>
  );
}

// ============================================================
// Tab — ایرادها و ریسک‌ها
// ============================================================

function FindingsTab({
  findings,
  onAskAboutFinding,
}: {
  findings: DocumentFinding[];
  onAskAboutFinding?: (finding: DocumentFinding) => void;
}) {
  if (findings.length === 0) {
    return (
      <EmptyState
        title="ایرادی ثبت نشده است"
        description="تحلیل این سند هیچ ایراد یا ریسکی گزارش نکرده است."
      />
    );
  }

  const grouped = groupByKind(findings);

  return (
    <div className="flex flex-col gap-5">
      {KIND_ORDER.map((kind) => {
        const bucket = grouped.get(kind);
        if (!bucket || bucket.length === 0) return null;
        return (
          <div key={kind} className="flex flex-col gap-3">
            <h3 className="text-labelLarge text-on-surface font-medium">
              {KIND_LABELS[kind]} ({bucket.length})
            </h3>
            {bucket.map((finding) => (
              <div key={finding.id} className="flex flex-col gap-2">
                <FindingCard finding={finding} />
                {onAskAboutFinding && (
                  <div className="flex justify-end">
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<IconChat size={18} />}
                      onClick={() => onAskAboutFinding(finding)}
                    >
                      درباره این یافته سؤال کنید
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Tab — اطلاعات ناقص
// ============================================================

function MissingTab({ findings }: { findings: DocumentFinding[] }) {
  if (findings.length === 0) {
    return (
      <EmptyState
        title="اطلاعات ناقصی گزارش نشده است"
        description="تحلیل این سند موردی را به‌عنوان اطلاعات ناقص علامت نزده است."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 rounded-medium bg-yellow-50 border border-yellow-200 p-3 text-yellow-800">
        <IconWarning size={20} className="shrink-0 mt-0.5" />
        <p className="text-caption leading-relaxed">
          برای تحلیل دقیق‌تر، این موارد باید تکمیل شوند. تا آن زمان نتیجه بررسی
          درباره این بخش‌ها قطعی نیست.
        </p>
      </div>
      {findings.map((finding) => (
        <FindingCard key={finding.id} finding={finding} />
      ))}
    </div>
  );
}

// ============================================================
// Tab — منابع و مستندات
// ============================================================

function SourcesTab({ sources }: { sources: CollectedSource[] }) {
  if (sources.length === 0) {
    return (
      <EmptyState
        title="منبعی ارجاع نشده است"
        description="تحلیل این سند به ماده قانونی یا مستند مشخصی ارجاع نداده است."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sources.map(({ key, citation, source }) => (
        <Card key={key} variant="outlined" padding="medium" className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <IconLawBook size={20} className="text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-body-2 font-bold text-on-surface">{source.title}</h4>
              <p className="text-caption text-muted mt-0.5">{source.authority}</p>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium border ${
                SOURCE_STATUS_CLASSES[source.status]
              }`}
            >
              {SOURCE_STATUS_LABELS[source.status]}
            </span>
          </div>

          <dl className="grid grid-cols-1 tablet:grid-cols-2 gap-x-4 gap-y-1.5 text-caption">
            <div className="flex gap-1">
              <dt className="text-muted">نوع:</dt>
              <dd className="text-on-surface">{SOURCE_TYPE_LABELS[source.type]}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-muted">ماده / محل:</dt>
              <dd className="text-on-surface">{citation.locator || "—"}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-muted">حوزه قضایی:</dt>
              <dd className="text-on-surface">{source.jurisdiction}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-muted">اعتبار:</dt>
              <dd className="text-on-surface">
                {source.validFrom}
                {source.validTo ? ` تا ${source.validTo}` : " — تاکنون"}
              </dd>
            </div>
          </dl>

          {citation.quote && (
            <blockquote className="rounded-medium bg-surfaceVariant/50 border-r-2 border-primary/40 px-3 py-2 text-caption text-on-surface leading-relaxed">
              {citation.quote}
            </blockquote>
          )}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Tab — پیشنهاد اصلاح
// ============================================================

function SuggestionsTab({ findings }: { findings: DocumentFinding[] }) {
  if (findings.length === 0) {
    return (
      <EmptyState
        title="پیشنهادی برای اصلاح نیست"
        description="تحلیل این سند متن اصلاحی برای هیچ یافته‌ای پیشنهاد نکرده است."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {findings.map((finding) => (
        <Card key={finding.id} variant="outlined" padding="medium" className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <IconInfo size={20} className="text-blue-600 shrink-0 mt-0.5" />
            <h4 className="text-body-2 font-bold text-on-surface">{finding.title}</h4>
          </div>
          {finding.locator && (
            <p className="text-caption text-muted">
              <span className="font-medium">محل: </span>
              {finding.locator}
            </p>
          )}
          <div className="rounded-medium bg-blue-50 border border-blue-100 p-3">
            <p className="text-caption text-blue-800 leading-relaxed">
              {finding.recommendation}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Tab — سند و نشانه‌گذاری
// ============================================================

function DocumentTab({
  findings,
  extractedText,
}: {
  findings: DocumentFinding[];
  extractedText: string | null;
}) {
  const located = findings.filter((f) => f.locator.trim().length > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Locators — where each finding sits in the document */}
      <div className="flex flex-col gap-2">
        <h3 className="text-labelLarge text-on-surface font-medium flex items-center gap-2">
          <IconFileSearch size={20} className="text-primary" />
          نشانه‌گذاری یافته‌ها
        </h3>
        {located.length === 0 ? (
          <p className="text-caption text-muted">
            تحلیل این سند محل مشخصی برای یافته‌ها گزارش نکرده است.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {located.map((finding) => (
              <li
                key={finding.id}
                className="flex items-start gap-2 text-caption text-on-surface"
              >
                <IconLinkSource size={16} className="text-muted shrink-0 mt-0.5" />
                <span>
                  <span className="font-medium">{finding.locator}</span>
                  <span className="text-muted"> — {finding.title}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Extracted text — the real document text the analysis read */}
      <div className="flex flex-col gap-2">
        <h3 className="text-labelLarge text-on-surface font-medium flex items-center gap-2">
          <IconDocument size={20} className="text-primary" />
          متن استخراج‌شده سند
        </h3>
        {extractedText && extractedText.length > 0 ? (
          <div className="max-h-96 overflow-y-auto rounded-medium border border-divider bg-surface p-4">
            <pre className="text-caption text-on-surface leading-relaxed text-right font-sans whitespace-pre-wrap break-words">
              {extractedText}
            </pre>
          </div>
        ) : (
          <p className="text-caption text-muted">
            متنی برای این سند استخراج نشده است. برای اسناد تصویری (اسکن‌شده) ممکن
            است استخراج متن در دسترس نباشد.
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Shared disclaimer
// ============================================================

function DisclaimerNote() {
  return (
    <div className="flex items-start gap-2 rounded-medium bg-surfaceVariant/50 border border-divider p-3">
      <IconInfo size={18} className="text-muted shrink-0 mt-0.5" />
      <p className="text-caption text-muted leading-relaxed">
        این تحلیل توسط هوش مصنوعی لیگالیر تهیه شده و جایگزین نظر وکیل نیست. برای
        تصمیم‌های حقوقی مهم با یک متخصص مشورت کنید.
      </p>
    </div>
  );
}
