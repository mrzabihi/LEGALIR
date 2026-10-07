"use client";

// ============================================================
// LEGALIR — Document lawyer suggestions
// ============================================================
// Shows a small set of lawyers from the REAL marketplace (the same
// `/api/v1/lawyers` endpoint the /lawyers page uses) as a next step after a
// review — for a real analysis and for a trial scenario alike.
//
// HONESTY RULES:
//   • The lawyers are real marketplace listings, never fabricated. Demo
//     professionals already carry the marketplace's own «نمونه» badge on
//     their card; we never present them as a system recommendation for
//     THIS document.
//   • The section never claims the platform "matched" these lawyers to the
//     user's matter. It is a listing, framed as «وکلای مرتبط».
//   • When the scenario's own category has no real listings yet, we fall
//     back to the rest of the REAL marketplace — clearly labelled as other
//     fields, never silently shown as if the category had matches.
//   • Booking/contact is enabled ONLY because the profile and consultation
//     routes exist in the project (`/lawyers/[id]`, `/consultations/new`).
//     The LawyerCard owns those CTAs; nothing extra is invented here.
//   • In trial mode the section carries the «نمونهٔ آزمایشی» marker so the
//     demo context is unambiguous.
// ============================================================

import Link from "next/link";
import { LawyerCard, LawyerCardSkeleton } from "@/components/lawyers";
import { useLawyers } from "@/hooks/useLawyers";
import { EmptyState, ErrorState } from "@legalir/ui";
import { IconArrowBack, IconUsers } from "@/lib/icons";
import { LEGAL_CATEGORY_FA } from "@legalir/types";
import { TrialBadge } from "./trial-badge";
import type { TrialScenario } from "@/lib/documents/trial-scenarios";

/** The marketplace category a scenario naturally points at. */
const SCENARIO_CATEGORY: Record<TrialScenario["id"], string> = {
  lease: "real_estate",
  car: "contract",
  contracting: "contract",
  nda: "contract",
};

interface DocumentLawyerSuggestionsProps {
  /** Present in trial mode — drives the category and the trial marker. */
  scenario?: TrialScenario | null;
  /** Optional explicit category override (real-analysis path). */
  category?: string | null;
  className?: string;
}

export function DocumentLawyerSuggestions({
  scenario = null,
  category = null,
  className = "",
}: DocumentLawyerSuggestionsProps) {
  const effectiveCategory = category ?? (scenario ? SCENARIO_CATEGORY[scenario.id] : null);

  // Primary listing — the scenario's own category when it has one, otherwise
  // the whole marketplace.
  const primary = useLawyers({
    category: effectiveCategory ?? undefined,
    sort: "rating",
    pageSize: 3,
  });
  const primaryEmpty =
    !primary.isLoading && !primary.isError && (primary.data?.items?.length ?? 0) === 0;

  // Honest fallback: a category with no real listings yet would otherwise show
  // an empty section, so we also surface the rest of the REAL marketplace —
  // explicitly labelled as other fields, never as a match for this document.
  const fallbackEnabled = !!effectiveCategory && primaryEmpty;
  const fallback = useLawyers({ sort: "rating", pageSize: 3 }, { enabled: fallbackEnabled });

  const useFallback = fallbackEnabled && (fallback.data?.items?.length ?? 0) > 0;
  const data = useFallback ? fallback.data : primary.data;
  const isLoading = primary.isLoading || (fallbackEnabled && fallback.isLoading);
  const isError = useFallback ? fallback.isError : primary.isError;

  const categoryLabel = effectiveCategory
    ? LEGAL_CATEGORY_FA[effectiveCategory] ?? effectiveCategory
    : null;

  return (
    <section aria-label="وکلای مرتبط" className={`flex flex-col gap-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IconUsers size={18} className="text-primary" aria-hidden="true" />
          <h3 className="text-titleSmall text-onSurface">وکلای مرتبط</h3>
          {scenario && <TrialBadge />}
        </div>
        <Link
          href="/lawyers"
          className="inline-flex items-center gap-1 text-caption text-primary hover:underline"
        >
          مشاهده همهٔ وکلا
          <IconArrowBack size={14} aria-hidden="true" />
        </Link>
      </div>

      <p className="text-caption text-muted leading-relaxed">
        این وکلا از بازار واقعی لیگالیر هستند
        {categoryLabel && !useFallback ? ` در حوزهٔ «${categoryLabel}»` : ""}
        ، نه پیشنهاد خودکار برای سند شما. برای انتخاب وکیل مناسب، پروفایل و
        تخصص هر نفر را بررسی کنید.
        {useFallback && categoryLabel && (
          <>
            {" "}
            در حوزهٔ «{categoryLabel}» هنوز وکیلی ثبت نشده؛ در ادامه وکلای
            حوزه‌های دیگر نمایش داده می‌شود.
          </>
        )}
      </p>

      {isLoading ? (
        <div className="grid grid-cols-1 tablet:grid-cols-3 gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <LawyerCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="دریافت وکلا ناموفق بود"
          message="در حال حاضر فهرست وکلا در دسترس نیست."
          onRetry={() => {
            primary.refetch();
            if (fallbackEnabled) fallback.refetch();
          }}
        />
      ) : !data?.items?.length ? (
        <EmptyState
          icon={<IconUsers size={48} />}
          title="وکیلی برای نمایش نیست"
          description="در حال حاضر وکیلی در این حوزه ثبت نشده است."
        />
      ) : (
        <div className="grid grid-cols-1 tablet:grid-cols-3 gap-3">
          {data.items.map((lawyer) => (
            <LawyerCard key={lawyer.id} lawyer={lawyer} />
          ))}
        </div>
      )}
    </section>
  );
}
