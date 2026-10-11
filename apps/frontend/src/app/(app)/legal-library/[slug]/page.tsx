// ============================================================
// LEGALIR — Legal Source Detail — /legal-library/[slug]
// ============================================================
// Real detail view for a published library source. Every section is rendered
// ONLY when the backend actually has the data (body, explanation, key points,
// examples, related sources, services); nothing is fabricated. The route param
// is the source **id** (what the cards link to), and the API serves it only
// when the source is PUBLISHED — a draft or archived source shows «یافت نشد».
// ============================================================

"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { V1LegalSourceDetail } from "@legalir/types";
import { useLegalLibrarySource, useSetLegalBookmark, useMe } from "@/hooks/useDashboard";
import { toPersianDate } from "@/lib/persian-utils";
import { ApiClientError } from "@/lib/api/errors";
import {
  IconCopy,
  IconLinkSource,
  IconCheckCircle,
  IconChat,
  IconDocument,
  IconContract,
} from "@/lib/icons";

// ============================================================
// Inline SVG helpers
// ============================================================

function SvgIcon({
  children,
  size = 18,
  className = "",
}: {
  children: React.ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const IconBookmark = ({ filled, size = 18 }: { filled?: boolean; size?: number }) => (
  <SvgIcon size={size}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill={filled ? "currentColor" : "none"} />
  </SvgIcon>
);

const IconShare = ({ size = 18 }: { size?: number }) => (
  <SvgIcon size={size}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
  </SvgIcon>
);

const IconArrowLeft = ({ size = 16, className = "" }: { size?: number; className?: string }) => (
  <SvgIcon size={size} className={className}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </SvgIcon>
);

const IconCalendar = ({ size = 14 }: { size?: number }) => (
  <SvgIcon size={size}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </SvgIcon>
);

const IconBuilding = ({ size = 14 }: { size?: number }) => (
  <SvgIcon size={size}>
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 6v.01M15 6v.01M9 10v.01M15 10v.01M9 14v.01M15 14v.01M9 18v.01M15 18v.01" />
  </SvgIcon>
);

const IconDot = ({ size = 8 }: { size?: number }) => (
  <SvgIcon size={size}>
    <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
  </SvgIcon>
);

const IconBook = ({ size = 14 }: { size?: number }) => (
  <SvgIcon size={size}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </SvgIcon>
);

// ============================================================
// Verification presentation (real `verificationStatus`)
// ============================================================

function VerificationBadge({ status }: { status: V1LegalSourceDetail["verificationStatus"] }) {
  const verified =
    status === "VERIFIED_OFFICIAL" || status === "VERIFIED_SECONDARY" || status === "DEMO_VERIFIED";
  const label =
    status === "VERIFIED_OFFICIAL"
      ? "تأیید رسمی"
      : status === "DEMO_VERIFIED"
        ? "بررسی‌شده"
        : status === "OUTDATED"
          ? "نیازمند به‌روزرسانی"
          : status === "SUPERSEDED"
            ? "منسوخ"
            : "در انتظار بازبینی";
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-caption font-medium",
        verified
          ? "border-success/25 bg-success-container text-success"
          : "border-warning/25 bg-warning-container text-warning",
      ].join(" ")}
    >
      <IconCheckCircle />
      {label}
    </span>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-divider/60 bg-surface p-5 shadow-sm tablet:p-6">
      <h3 className="mb-4 flex items-center gap-2 text-h4 font-semibold text-on-surface">
        <span className="block h-1.5 w-8 rounded-full bg-primary-600" />
        {title}
      </h3>
      <div className="text-body-2 leading-relaxed text-on-surface">{children}</div>
    </section>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  active,
  loading,
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={[
        "inline-flex items-center gap-2 rounded-xl border border-divider/60 px-4 py-2.5 text-button font-medium transition-all duration-200 touch-target",
        active
          ? "border-primary bg-primary text-white shadow-sm"
          : "bg-surface text-on-surface hover:bg-surface-container active:scale-[0.97]",
        loading ? "opacity-60" : "",
      ].join(" ")}
    >
      {icon}
      <span className="hidden tablet:inline">{label}</span>
    </button>
  );
}

// ============================================================
// Not-found / error states
// ============================================================

function NotFoundState({ id }: { id: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center" dir="rtl">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-error/20 bg-error-container">
        <SvgIcon size={36} className="text-error">
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </SvgIcon>
      </div>
      <h2 className="mb-2 text-h2 text-on-surface">منبع حقوقی یافت نشد</h2>
      <p className="mb-2 max-w-md text-body-1 text-muted">
        منبعی با شناسه «{id}» در کتابخانه حقوقی LEGALIR یافت نشد یا در دسترس عمومی نیست.
      </p>
      <p className="mb-8 max-w-md text-body-2 text-muted/60">
        لطفاً از صفحه کتابخانه حقوقی به جستجوی منابع معتبر بپردازید یا از مشاور هوش مصنوعی کمک بگیرید.
      </p>
      <div className="flex items-center gap-3">
        <Link
          href="/legal-library"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-button font-medium text-white shadow-sm transition-colors hover:bg-primary-700 active:scale-[0.98]"
        >
          کتابخانه حقوقی
        </Link>
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 rounded-xl border border-divider/60 bg-surface px-5 py-2.5 text-button font-medium text-on-surface transition-colors hover:bg-surface-container active:scale-[0.98]"
        >
          مشاوره با LEGALIR
        </Link>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="animate-pulse rounded-2xl border border-divider/60 bg-surface p-6">
        <div className="mb-4 h-6 w-40 rounded-full bg-surface-container" />
        <div className="mb-3 h-8 w-2/3 rounded bg-surface-container" />
        <div className="h-4 w-1/2 rounded bg-surface-container" />
      </div>
      <div className="h-40 animate-pulse rounded-2xl border border-divider/60 bg-surface" />
      <div className="h-40 animate-pulse rounded-2xl border border-divider/60 bg-surface" />
    </div>
  );
}

// ============================================================
// Service icon map (real relatedServices only)
// ============================================================

function ServiceIcon({ href }: { href: string }) {
  if (href.includes("contract")) return <IconContract size={20} />;
  if (href.includes("document")) return <IconDocument size={20} />;
  return <IconChat size={20} />;
}

// ============================================================
// Page
// ============================================================

export default function LegalSourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.["slug"] as string) ?? "";

  const query = useLegalLibrarySource(id);
  const me = useMe();
  const setBookmark = useSetLegalBookmark(id);

  const [copyFeedback, setCopyFeedback] = useState(false);

  const source = query.data;
  const isAuthed = Boolean(me.data?.user);

  const notFound = query.error instanceof ApiClientError && query.error.category === "not_found";
  const genericError = query.isError && !notFound;

  const handleCopyCitation = useCallback(() => {
    if (!source) return;
    const citation = `${source.title} — ${source.authority} (${source.updatedAt})\n${
      source.sourceUrl ?? source.officialSourceUrl ?? "لینک منبع ثبت نشده است"
    }`;
    navigator.clipboard
      .writeText(citation)
      .then(() => {
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      })
      .catch(() => {
        // Clipboard API can be unavailable (insecure context / denied) — the
        // copy button simply does not flip to its "copied" state.
      });
  }, [source]);

  const handleShare = useCallback(async () => {
    if (!source) return;
    const shareData = { title: source.title, text: source.title, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      }
    } catch {
      /* user cancelled */
    }
  }, [source]);

  const handleBookmark = useCallback(() => {
    if (!source) return;
    if (!isAuthed) {
      router.push("/login");
      return;
    }
    setBookmark.mutate(!source.isBookmarked);
  }, [source, isAuthed, router, setBookmark]);

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-4 tablet:p-6" dir="rtl">
        <DetailSkeleton />
      </div>
    );
  }

  if (notFound || (!query.isError && !source)) {
    return (
      <div className="mx-auto max-w-4xl p-4 tablet:p-6">
        <NotFoundState id={id} />
      </div>
    );
  }

  if (genericError) {
    return (
      <div className="mx-auto max-w-4xl p-4 tablet:p-6" dir="rtl">
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-error/20 bg-error-container">
            <SvgIcon size={30} className="text-error">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </SvgIcon>
          </div>
          <p className="text-body-1 font-medium text-on-surface">بارگذاری منبع ناموفق بود</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-button font-medium text-white shadow-sm transition-colors hover:bg-primary-700 active:scale-[0.98] touch-target"
          >
            تلاش دوباره
          </button>
        </div>
      </div>
    );
  }

  if (!source) return null;

  const sourceLink = source.sourceUrl ?? source.officialSourceUrl ?? null;
  const identifiers: { label: string; value: string }[] = [];
  if (source.lawName) identifiers.push({ label: "قانون", value: source.lawName });
  if (source.articleNumber) identifiers.push({ label: "ماده", value: source.articleNumber });
  if (source.judgmentNumber) identifiers.push({ label: "شماره رأی", value: source.judgmentNumber });

  return (
    <div className="mx-auto max-w-4xl p-4 tablet:p-6" dir="rtl">
      {/* Back */}
      <div className="mb-5">
        <Link
          href="/legal-library"
          className="inline-flex items-center gap-1.5 text-body-2 text-muted transition-colors hover:text-on-surface"
        >
          <IconArrowLeft size={16} className="rtl-flip" />
          بازگشت به کتابخانه حقوقی
        </Link>
      </div>

      {/* Header */}
      <header className="mb-5 rounded-2xl border border-divider/60 bg-surface p-5 shadow-sm tablet:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-caption font-medium text-primary-700">
            {source.sourceTypeFa}
          </span>
          <VerificationBadge status={source.verificationStatus} />
        </div>

        <h1 className="mb-3 text-h2 text-on-surface">{source.title}</h1>

        {source.summary && (
          <p className="mb-3 text-body-2 leading-relaxed text-on-surface-variant">{source.summary}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-caption">
          <span className="inline-flex items-center gap-1.5 text-muted">
            <IconBook />
            {source.sourceTypeFa}
          </span>
          {source.publicationDate && (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <IconCalendar />
              تاریخ انتشار: {source.publicationDate}
            </span>
          )}
          {source.authority && (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <IconBuilding />
              {source.authority}
            </span>
          )}
        </div>

        {identifiers.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {identifiers.map((i) => (
              <span
                key={i.label}
                className="inline-flex items-center gap-1 rounded-lg bg-surface-container px-2.5 py-1 text-labelSmall text-on-surface-variant"
              >
                <span className="text-muted">{i.label}:</span>
                {i.value}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Actions */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <ActionButton
          label={source.isBookmarked ? "ذخیره‌شده" : "ذخیره"}
          icon={<IconBookmark filled={source.isBookmarked} />}
          onClick={handleBookmark}
          active={source.isBookmarked}
          loading={setBookmark.isPending}
        />
        <ActionButton
          label={copyFeedback ? "کپی شد" : "کپی ارجاع"}
          icon={copyFeedback ? <IconCheckCircle className="text-success" /> : <IconCopy />}
          onClick={handleCopyCitation}
        />
        {sourceLink ? (
          <a
            href={sourceLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-divider/60 bg-surface px-4 py-2.5 text-button font-medium text-on-surface transition-all duration-200 hover:bg-surface-container active:scale-[0.97] touch-target"
          >
            <IconLinkSource />
            <span className="hidden tablet:inline">مشاهده منبع</span>
          </a>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-xl border border-divider/40 bg-surface-container/50 px-4 py-2.5 text-caption text-muted">
            <IconLinkSource className="opacity-40" />
            لینک منبع ثبت نشده است
          </span>
        )}
        <ActionButton label="اشتراک‌گذاری" icon={<IconShare />} onClick={handleShare} />
      </div>

      {/* Body */}
      <div className="space-y-5">
        {source.body && (
          <SectionBlock title="متن">
            <div className="whitespace-pre-line">{source.body}</div>
          </SectionBlock>
        )}

        {source.simpleExplanation && (
          <SectionBlock title="توضیح ساده">
            <p>{source.simpleExplanation}</p>
          </SectionBlock>
        )}

        {source.practicalApplication && (
          <SectionBlock title="کاربرد عملی">
            <p>{source.practicalApplication}</p>
          </SectionBlock>
        )}

        {source.keyPoints && source.keyPoints.length > 0 && (
          <SectionBlock title="نکات مهم">
            <ul className="space-y-3">
              {source.keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                    <IconDot />
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </SectionBlock>
        )}

        {source.examples && source.examples.length > 0 && (
          <SectionBlock title="مثال‌ها">
            <ul className="space-y-2">
              {source.examples.map((ex, i) => (
                <li key={i} className="whitespace-pre-line">
                  {ex}
                </li>
              ))}
            </ul>
          </SectionBlock>
        )}

        {/* Related sources — real, from the store */}
        {source.relatedSources.length > 0 && (
          <section className="rounded-2xl border border-divider/60 bg-surface p-5 shadow-sm tablet:p-6">
            <h3 className="mb-4 flex items-center gap-2 text-h4 font-semibold text-on-surface">
              <span className="block h-1.5 w-8 rounded-full bg-primary-600" />
              منابع مرتبط
            </h3>
            <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
              {source.relatedSources.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/legal-library/${encodeURIComponent(rel.id)}`}
                  className="group flex flex-col gap-2 rounded-xl border border-divider/60 bg-surface-container p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-elevation-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-divider bg-surface px-2 py-0.5 text-labelSmall font-medium text-on-surface-variant">
                      {rel.sourceTypeFa}
                    </span>
                    <span className="text-labelSmall text-secondary">{rel.relationTypeFa}</span>
                  </div>
                  <h4 className="text-titleSmall leading-snug text-on-surface transition-colors group-hover:text-primary">
                    {rel.title}
                  </h4>
                  {rel.summary && <p className="line-clamp-2 text-caption text-muted">{rel.summary}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Related services — real LEGALIR CTAs */}
        {source.relatedServices.length > 0 && (
          <section className="rounded-2xl border border-divider/60 bg-surface p-5 shadow-sm tablet:p-6">
            <h3 className="mb-4 flex items-center gap-2 text-h4 font-semibold text-on-surface">
              <span className="block h-1.5 w-8 rounded-full bg-primary-600" />
              خدمات مرتبط LEGALIR
            </h3>
            <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2 desktop:grid-cols-3">
              {source.relatedServices.map((svc) => (
                <Link
                  key={svc.id}
                  href={svc.href}
                  className="group flex flex-col gap-2 rounded-xl border border-divider/60 bg-surface-container p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-elevation-1"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-transform duration-200 group-hover:scale-110">
                    <ServiceIcon href={svc.href} />
                  </span>
                  <p className="text-body-2 font-semibold text-on-surface transition-colors group-hover:text-primary">
                    {svc.title}
                  </p>
                  <p className="text-caption leading-relaxed text-muted">{svc.description}</p>
                  <span className="mt-auto inline-flex items-center gap-1 text-labelSmall font-medium text-primary">
                    {svc.cta}
                    <IconArrowLeft size={14} className="rtl-flip" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer meta */}
      <p className="mt-6 text-center text-caption text-muted">
        آخرین به‌روزرسانی: {toPersianDate(source.updatedAt)}
      </p>

      <div className="h-8" />
    </div>
  );
}
