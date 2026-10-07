// ============================================================
// LEGALIR — Recommended lawyers for a contract service
// ============================================================
// Surfaces REAL lawyers from the existing marketplace. Nothing here is
// invented: the roster comes from `useLawyers`, ranking from
// `featuredLawyers`, and every number rendered (rating, experience,
// availability) is derived by the shared lawyer components from real
// fields. Demo profiles keep their «نمونه» badge, so they are never shown
// as real practitioners.
//
// Specialities are matched against the same `category` codes the lawyers
// registry uses. When a speciality yields no lawyer, the section falls back
// to the featured roster rather than hiding — but it never fabricates one.

"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLawyers } from "@/hooks/useLawyers";
import { featuredLawyers } from "@/lib/lawyers/grouping";
import type { LawyerSpecialtyCode } from "@/lib/contract-services";
import { IconHandshake, IconRefresh } from "@/lib/icons";
import { LawyerCard, LawyerCardSkeleton } from "@/components/lawyers";
import { toPersianNumber } from "@/lib/persian-utils";

interface ContractLawyerSuggestionProps {
  /** Related specialisations, most relevant first. */
  specialties: LawyerSpecialtyCode[];
  title?: string;
  description?: string;
  /** Empty-state heading used only if the roster has no verified lawyers. */
  emptyHint?: string;
}

export function ContractLawyerSuggestion({
  specialties,
  title = "وکیل متخصص این قرارداد",
  description = "برای بررسی و تنظیم دقیق‌تر، می‌توانید با وکیل متخصص این حوزه مشاوره بگیرید.",
  emptyHint = "در حال حاضر وکیل تأییدشده‌ای در این تخصص ثبت نشده است.",
}: ContractLawyerSuggestionProps) {
  const primary = specialties[0];

  const { data, isLoading, isError, refetch } = useLawyers({
    category: primary,
    sort: "relevance",
    pageSize: 24,
  });
  // Defensive fallback: a broad query when the specialty filter is empty.
  const fallback = useLawyers({ sort: "relevance", pageSize: 12 });

  const items = useMemo(() => data?.items ?? [], [data]);
  const fallbackItems = useMemo(() => fallback.data?.items ?? [], [fallback.data]);

  // Prefer lawyers actually specialised in the requested area; if none are
  // verified for it, show the featured roster instead of an empty section.
  const lawyers = useMemo(() => {
    const scoped = featuredLawyers(items, 4);
    if (scoped.length > 0) return scoped;
    return featuredLawyers(fallbackItems, 4);
  }, [items, fallbackItems]);

  const loading = isLoading || fallback.isLoading;

  return (
    <section
      aria-labelledby="contract-lawyer-title"
      className="rounded-xlarge border border-[color:var(--color-outline-variant)] bg-surface-container-low p-5 tablet:p-6"
    >
      <div className="mb-4 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-gradient-to-br from-primary-700 to-primary-900 text-white shadow-elevation-1"
        >
          <IconHandshake size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="contract-lawyer-title" className="text-h4 font-bold text-on-surface">
            {title}
          </h2>
          <p className="mt-1 text-body-2 text-on-surface-variant">{description}</p>
        </div>
        <Link
          href="/lawyers"
          className="hidden shrink-0 rounded-small text-caption font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 tablet:inline"
        >
          مشاهده همه وکلا
        </Link>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 laptop:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <LawyerCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && !loading && (
        <div className="flex flex-col items-center gap-2 rounded-large bg-error/10 p-5 text-center">
          <p className="text-body-2 text-error">دریافت فهرست وکلا با مشکل مواجه شد.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-caption text-primary transition hover:bg-primary/10"
          >
            <IconRefresh size={16} />
            تلاش مجدد
          </button>
        </div>
      )}

      {!loading && !isError && lawyers.length === 0 && (
        <p className="rounded-large border border-[color:var(--color-outline-variant)] bg-surface px-4 py-5 text-center text-body-2 text-on-surface-variant">
          {emptyHint}
        </p>
      )}

      {!loading && !isError && lawyers.length > 0 && (
        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 laptop:grid-cols-3">
          {lawyers.map((lawyer) => (
            <LawyerCard key={lawyer.id} lawyer={lawyer} />
          ))}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-on-surface-variant/70">
        {toPersianNumber(lawyers.length)} وکیل از میان وکلای تأییدشده نمایش داده شده است. وکلای
        نمونه با نشان «نمونه» مشخص می‌شوند.
      </p>
    </section>
  );
}
