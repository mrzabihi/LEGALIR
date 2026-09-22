"use client";

// ============================================================
// LEGALIR — Chat escalation: propose lawyers for the chat's topic
// ============================================================
// When a conversation has a detected legal category, the matching engine
// proposes up to two suitable lawyers for that exact topic. The user
// chooses — the engine never auto-assigns. «مشاهده سایر وکلا» opens the
// marketplace pre-filtered to the same category.
// ============================================================

import { useEffect } from "react";
import Link from "next/link";
import { useMatchLawyers } from "@/hooks/useLawyers";
import { IconPerson, IconStar, IconChevronRight, IconBalance } from "@/lib/icons";
import { toPersianNumber } from "@/lib/persian-utils";
import { LEGAL_CATEGORY_FA, type MatchCandidate } from "@legalir/types";

/** How many lawyers the chat proposes inline. */
const INLINE_MATCH_LIMIT = 2;

function CandidateCard({ candidate }: { candidate: MatchCandidate }) {
  const { lawyer, reasonsFa } = candidate;
  const rating = lawyer.performance.averageRating;

  return (
    <Link
      href={`/lawyers/${lawyer.id}`}
      className="group flex items-center gap-3 rounded-xl border border-divider/60 bg-surface p-3 transition-all hover:border-primary/40 hover:shadow-elevation-1"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <IconPerson size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-body-2 font-semibold text-on-surface group-hover:text-primary">
            {lawyer.fullName}
          </span>
          {lawyer.isDemo && (
            <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-caption text-amber-700">
              نمونه
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-caption text-muted">
          {rating !== null && (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <IconStar size={12} />
              {toPersianNumber(rating)}
            </span>
          )}
          {reasonsFa[0] && <span className="truncate">{reasonsFa[0]}</span>}
        </div>
      </div>
      <IconChevronRight size={18} className="shrink-0 text-muted" />
    </Link>
  );
}

export function EscalationCta({ category }: { category?: string | null }) {
  const match = useMatchLawyers();

  // Re-run the match whenever the conversation's topic changes.
  useEffect(() => {
    if (!category) return;
    match.mutate({ category });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const categoryLabel = category ? LEGAL_CATEGORY_FA[category] ?? category : null;
  const candidates = match.data?.candidates ?? [];
  const marketplaceHref = category ? `/lawyers?category=${encodeURIComponent(category)}` : "/lawyers";

  return (
    <div className="rounded-large border border-divider bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <IconBalance size={18} className="text-primary" />
        <p className="text-bodyMedium text-onSurfaceVariant">
          {categoryLabel
            ? `وکلای پیشنهادی برای موضوع «${categoryLabel}»`
            : "نیاز به مشاوره تخصصی دارید؟"}
        </p>
      </div>

      {match.isPending && (
        <div className="space-y-2">
          {Array.from({ length: INLINE_MATCH_LIMIT }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-container" />
          ))}
        </div>
      )}

      {!match.isPending && candidates.length > 0 && (
        <div className="space-y-2">
          {candidates.slice(0, INLINE_MATCH_LIMIT).map((c) => (
            <CandidateCard key={c.lawyer.id} candidate={c} />
          ))}
        </div>
      )}

      {!match.isPending && candidates.length === 0 && (
        <p className="rounded-xl bg-surface-container px-3 py-3 text-bodySmall text-muted">
          {category
            ? "در حال حاضر وکیلی برای این موضوع در دسترس نیست. می‌توانید فهرست کامل را ببینید."
            : "موضوع گفتگو مشخص نشده است. فهرست کامل وکلا را ببینید."}
        </p>
      )}

      <Link
        href={marketplaceHref}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-medium bg-primary px-5 py-3 text-button font-medium text-white transition hover:bg-primary-700 active:scale-[0.98]"
      >
        مشاهده سایر وکلا
        {categoryLabel ? ` در ${categoryLabel}` : ""}
        <IconChevronRight size={18} />
      </Link>

      <p className="mt-2 text-center text-bodySmall text-muted">
        انتخاب وکیل با شماست — سیستم فقط پیشنهاد می‌دهد.
      </p>
    </div>
  );
}
