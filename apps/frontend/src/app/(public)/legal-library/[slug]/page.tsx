// ============================================================
// LEGALIR — Legal Source Detail — /legal-library/[slug]
// ============================================================
// A SERVER component, so a crawler receives the article itself rather than a
// skeleton: the whole point of moving this route into the public group. The
// interactive slice (bookmark / copy-citation / share) is the `SourceActions`
// island below, mirroring the blog article page's split.
//
// Every section renders ONLY when the backend actually has the data (body,
// explanation, key points, examples, related sources, services); nothing is
// fabricated. The route param is the source **id or slug**, resolved by
// `readPublishedSource` — the same call the API handler makes, so the page can
// never show a source the API 404s.
//
// An unknown, draft or archived id calls `notFound()`: a real 404, not a 200
// soft-404. That is the only honest answer once the page is indexable.
// ============================================================

import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { V1LegalSourceDetail } from "@legalir/types";
import { findSessionById } from "@/lib/db";
import { getBookmarkedIds, projectSourceDetail, readPublishedSource } from "@/lib/legal-library-db";
import { toPersianDate } from "@/lib/persian-utils";
import { IconChat, IconCheckCircle, IconContract, IconDocument } from "@/lib/icons";
import { SourceActions } from "./source-actions";

// The library is a JSON DB read from disk at request time.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

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
        verified ? "bg-success-container text-success" : "bg-warning-container text-warning",
      ].join(" ")}
    >
      <IconCheckCircle />
      {label}
    </span>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-large border border-divider bg-surface p-5 shadow-elevation-1 tablet:p-6">
      <h3 className="mb-4 flex items-center gap-2 text-h4 font-semibold text-on-surface">
        <span className="block h-1.5 w-8 rounded-full bg-[var(--brand-gold)]" />
        {title}
      </h3>
      <div className="text-body-2 leading-relaxed text-on-surface">{children}</div>
    </section>
  );
}

function ServiceIcon({ href }: { href: string }) {
  if (href.includes("contract")) return <IconContract size={20} />;
  if (href.includes("document")) return <IconDocument size={20} />;
  return <IconChat size={20} />;
}

// ============================================================
// Page
// ============================================================

export default async function LegalSourceDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const hit = readPublishedSource(slug);
  if (!hit) notFound();

  // Optional session: the detail view is public; a cookie only personalises the
  // bookmark flag. A guest sees an un-bookmarked page and is routed to /login
  // when they press «ذخیره».
  const sessionId = (await cookies()).get("legalir-session")?.value;
  const userId = sessionId ? (findSessionById(sessionId)?.userId ?? null) : null;
  const isBookmarked = userId ? getBookmarkedIds(userId).has(hit.item.id) : false;

  const source: V1LegalSourceDetail = hit.detail
    ? { ...hit.detail, isBookmarked }
    : projectSourceDetail(hit.item, isBookmarked);

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
      <header className="mb-5 rounded-large border border-divider bg-surface p-5 shadow-elevation-1 tablet:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-secondary-container px-3 py-1 text-caption font-medium text-on-secondary-container">
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
                className="inline-flex items-center gap-1 rounded-small bg-surface-container px-2.5 py-1 text-labelSmall text-on-surface-variant"
              >
                <span className="text-muted">{i.label}:</span>
                {i.value}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Actions (client island) */}
      <SourceActions
        id={source.id}
        title={source.title}
        authority={source.authority}
        updatedAt={source.updatedAt}
        sourceUrl={sourceLink}
        isBookmarked={isBookmarked}
      />

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
                  <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
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
          <section className="rounded-large border border-divider bg-surface p-5 shadow-elevation-1 tablet:p-6">
            <h3 className="mb-4 flex items-center gap-2 text-h4 font-semibold text-on-surface">
              <span className="block h-1.5 w-8 rounded-full bg-[var(--brand-gold)]" />
              منابع مرتبط
            </h3>
            <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
              {source.relatedSources.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/legal-library/${encodeURIComponent(rel.id)}`}
                  className="group flex flex-col gap-2 rounded-medium border border-divider bg-surface-container p-4 transition-shadow duration-short3 hover:border-primary hover:shadow-elevation-3"
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
          <section className="rounded-large border border-divider bg-surface p-5 shadow-elevation-1 tablet:p-6">
            <h3 className="mb-4 flex items-center gap-2 text-h4 font-semibold text-on-surface">
              <span className="block h-1.5 w-8 rounded-full bg-[var(--brand-gold)]" />
              خدمات مرتبط LEGALIR
            </h3>
            <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2 desktop:grid-cols-3">
              {source.relatedServices.map((svc) => (
                <Link
                  key={svc.id}
                  href={svc.href}
                  className="group flex flex-col gap-2 rounded-medium border border-divider bg-surface-container p-4 transition-shadow duration-short3 hover:border-primary hover:shadow-elevation-3"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-medium bg-[var(--brand-green)] text-white shadow-elevation-1 transition-transform duration-short3 group-hover:scale-110">
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
