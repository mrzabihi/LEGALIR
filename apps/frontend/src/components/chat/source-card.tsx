"use client";

import type { V1SourceDetail } from "@legalir/types";
import { IconLawBook, IconLinkSource, IconWarning } from "@/lib/icons";
import { CitationCopyButton } from "./citation-copy-button";

const AVAILABILITY_LABELS: Record<string, { label: string; className: string }> = {
  available: { label: "قابل دسترس", className: "bg-success-container text-success" },
  unavailable: { label: "در دسترس نیست", className: "bg-error-container text-error" },
  outdated: { label: "منسوخ شده", className: "bg-warning-container text-warning" },
  unverified: { label: "تأیید نشده", className: "bg-warning-container text-warning" },
};

const STATUS_LABELS: Record<string, string> = {
  valid: "معتبر",
  amended: "اصلاح‌شده",
  expired: "منقضی",
  needs_review: "نیازمند بازبینی",
};

interface SourceCardProps {
  source: V1SourceDetail;
  /**
   * The exact cited quote for the answer that opened this source. When it is
   * a real substring of the excerpt it is highlighted; otherwise no highlight
   * is shown at all — the UI never colours a guess (§7).
   */
  highlightQuote?: string | null;
}

/**
 * Split the excerpt around the cited quote so the matched span can be marked.
 * Returns null when the quote is absent (after trimming) — the caller then
 * renders the excerpt plainly, with no highlight.
 */
function splitOnQuote(
  excerpt: string,
  quote: string
): { before: string; match: string; after: string } | null {
  const needle = quote.trim();
  if (needle.length < 8) return null; // too short to be a meaningful match
  const idx = excerpt.indexOf(needle);
  if (idx === -1) return null;
  return {
    before: excerpt.slice(0, idx),
    match: excerpt.slice(idx, idx + needle.length),
    after: excerpt.slice(idx + needle.length),
  };
}

export function SourceCard({ source, highlightQuote }: SourceCardProps) {
  const availability = AVAILABILITY_LABELS[source.availability] ?? {
    label: source.availability,
    className: "bg-surfaceVariant text-muted",
  };

  const isUnavailable = source.availability === "unavailable";
  const isOutdated = source.availability === "outdated";
  const isUnverified = source.availability === "unverified";

  // The cited span, only when it is a genuine substring of the real excerpt.
  const highlight =
    source.excerpt && highlightQuote
      ? splitOnQuote(source.excerpt, highlightQuote)
      : null;

  return (
    <div className="space-y-4">
      {/* Warning banners */}
      {isUnavailable && (
        <div className="flex items-start gap-2 p-3 rounded-medium bg-error-container border border-error">
          <IconWarning size={18} className="text-error shrink-0 mt-0.5" />
          <p className="text-bodySmall text-error">این منبع در حال حاضر در دسترس نیست. ممکن است به دلیل محدودیت انتشار یا دسته‌بندی محرمانه باشد.</p>
        </div>
      )}

      {isOutdated && (
        <div className="flex items-start gap-2 p-3 rounded-medium bg-warning-container border border-warning">
          <IconWarning size={18} className="text-warning shrink-0 mt-0.5" />
          <p className="text-bodySmall text-warning">این منبع منسوخ شده یا تاریخ مصرف آن گذشته است. لطفاً نسخه به‌روز را بررسی کنید.</p>
        </div>
      )}

      {isUnverified && (
        <div className="flex items-start gap-2 p-3 rounded-medium bg-warning-container border border-warning">
          <IconWarning size={18} className="text-warning shrink-0 mt-0.5" />
          <p className="text-bodySmall text-warning">اعتبار این منبع هنوز تأیید نشده است. اطلاعات ارائه‌شده ممکن است قطعی نباشد.</p>
        </div>
      )}

      {/* Source header */}
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center shrink-0">
          <IconLawBook size={20} className="text-primary" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-titleSmall text-onSurface mb-1">{source.title}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-bodySmall px-2 py-0.5 rounded-full bg-surfaceVariant text-onSurfaceVariant">
              {source.sourceTypeFa}
            </span>
            <span className={["text-labelSmall px-2 py-0.5 rounded-full", availability.className].join(" ")}>
              {availability.label}
            </span>
            <span className="text-bodySmall px-2 py-0.5 rounded-full bg-surfaceVariant text-onSurfaceVariant">
              {STATUS_LABELS[source.status] ?? source.status}
            </span>
          </div>
        </div>
      </div>

      {/* Metadata fields */}
      <dl className="space-y-2 text-bodySmall">
        {source.articleSection && (
          <div className="flex justify-between gap-2 py-1.5 border-b border-divider">
            <dt className="text-muted shrink-0">ماده / بخش</dt>
            <dd className="text-onSurface text-end">{source.articleSection}</dd>
          </div>
        )}
        <div className="flex justify-between gap-2 py-1.5 border-b border-divider">
          <dt className="text-muted shrink-0">مرجع انتشار</dt>
          <dd className="text-onSurface text-end">{source.publicationAuthority}</dd>
        </div>
        <div className="flex justify-between gap-2 py-1.5 border-b border-divider">
          <dt className="text-muted shrink-0">حوزه قضایی</dt>
          <dd className="text-onSurface text-end">{source.jurisdiction}</dd>
        </div>
        <div className="flex justify-between gap-2 py-1.5 border-b border-divider">
          <dt className="text-muted shrink-0">تاریخ اجرا</dt>
          <dd className="text-onSurface text-end">{source.effectiveDate}</dd>
        </div>
        {source.versionDate && (
          <div className="flex justify-between gap-2 py-1.5 border-b border-divider">
            <dt className="text-muted shrink-0">آخرین ویرایش</dt>
            <dd className="text-onSurface text-end">{source.versionDate}</dd>
          </div>
        )}
        {source.documentIdentifier && (
          <div className="flex justify-between gap-2 py-1.5 border-b border-divider">
            <dt className="text-muted shrink-0">شناسه</dt>
            <dd className="text-onSurface text-end font-mono text-labelSmall">
              {source.documentIdentifier}
            </dd>
          </div>
        )}
      </dl>

      {/* Excerpt — when the cited quote is a real span of the stored excerpt
          it is marked; otherwise the excerpt renders untouched (§7). */}
      {source.excerpt && (
        <div className="rounded-medium bg-surface-container p-3">
          <p className="text-bodySmall text-onSurfaceVariant leading-loose whitespace-pre-wrap">
            {highlight ? (
              <>
                {highlight.before}
                <mark className="rounded-sm bg-warning-container px-0.5 text-onSurface">
                  {highlight.match}
                </mark>
                {highlight.after}
              </>
            ) : (
              source.excerpt
            )}
          </p>
          <CitationCopyButton text={source.excerpt} label="کپی متن" />
        </div>
      )}

      {/* URL */}
      {source.url && (
        <div className="flex items-center gap-2">
          <IconLinkSource size={14} className="text-primary" />
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-bodySmall text-primary underline hover:text-primary-variant transition-colors"
          >
            لینک منبع
          </a>
        </div>
      )}
    </div>
  );
}
