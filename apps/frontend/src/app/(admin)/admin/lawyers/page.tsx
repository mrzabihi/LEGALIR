// ============================================================
// LEGALIR — Admin · Lawyers (وکلا)  ·  management table
// ============================================================
// The full lawyer management surface. Beyond the review decision it shows
// everything an operator needs at a glance — avatar, professional rank,
// issuing organisation, primary specialty, cities, years of experience,
// displayed rating + review count, verification bucket, operator lifecycle
// (فعال/غیرفعال/معلق/حذف‌شده), the featured flag and the last update time —
// with search, a decision-bucket filter, a lifecycle filter, quick
// feature/moderate actions, and a detail drawer for the full edit.
//
// TWO filter axes, because they answer different questions:
//   • bucket   — the DECISION (REVIEW / APPROVED / REJECTED / SUSPENDED). This
//                is the operator's work queue: `?bucket=REVIEW` is the review
//                backlog, and the dashboard's lawyer KPIs and the «وکلای در
//                انتظار تأیید» attention card link straight into it. The URL
//                carries it so the queue is bookmarkable and shareable.
//   • lifecycle— the VISIBILITY state (فعال/غیرفعال/معلق/حذف‌شده), which is
//                independent: a VERIFIED lawyer can be HIDDEN and still be in
//                the APPROVED bucket.
// The server has always supported both (`GET /admin/lawyers`); the page used
// to send only one, so the bucket the table renders was unfilterable.
//
// This table reads the SAME source of truth the public /lawyers marketplace
// reads, so any change here (edit, status, avatar, rating, review, featured)
// is reflected there immediately — there is no second copy.
// ============================================================

"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { snackbar } from "@legalir/ui";
import {
  useAdminLawyers,
  useAdminMe,
  useSetAdminLawyerFeatured,
} from "@/hooks/useAdmin";
import { IconSearch, IconStar } from "@/lib/icons";
import { toPersianCurrency, toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import {
  LAWYER_DECISION_BUCKET_FA,
  LAWYER_DECISION_BUCKETS,
  ADMIN_LAWYER_STATUS_FA,
  LAWYER_PROFESSIONAL_RANK_SHORT_FA,
  type AdminLawyerStatus,
  type LawyerDecisionBucket,
} from "@legalir/types";
import {
  PageHeader,
  DataTable,
  Th,
  Td,
  Badge,
  StateView,
  Button,
  MaskedMobile,
  FilterPills,
  InfoBanner,
  TextInput,
  Pagination,
  ExportButton,
} from "@/components/admin/ui";
import { DEFAULT_PAGE_SIZE } from "@/lib/admin/pagination";
import { LawyerAvatar } from "@/components/lawyers";
import { LawyerDetailDrawer, BUCKET_TONES } from "@/components/admin/lawyer-detail-drawer";
import { specialtyLabel } from "@/lib/lawyers/specialty";

type LifecycleFilter = AdminLawyerStatus | "ALL";
type BucketFilter = LawyerDecisionBucket | "ALL";

const LIFECYCLE_TONES: Record<
  AdminLawyerStatus,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  SUSPENDED: "danger",
  DELETED: "danger",
};

// How long typing must pause before the list auto-searches. Long enough to
// finish a word, short enough to feel eager. Enter / the button bypass it.
const SEARCH_DEBOUNCE_MS = 600;

/** `?bucket=…` is the entry point into a slice of the queue; anything else
 *  (including a hand-typed typo) falls back to «همه» rather than an empty list
 *  the operator cannot explain. */
function readBucket(raw: string | null): BucketFilter {
  return raw && (LAWYER_DECISION_BUCKETS as string[]).includes(raw)
    ? (raw as LawyerDecisionBucket)
    : "ALL";
}

// `useSearchParams` needs a Suspense boundary in a statically-rendered route.
export default function AdminLawyersPage() {
  return (
    <Suspense fallback={null}>
      <LawyersTable />
    </Suspense>
  );
}

function LawyersTable() {
  const { can } = useAdminMe();
  const canReview = can("admin:lawyer:verify");
  const canFeature = can("admin:lawyer:feature");

  const params = useSearchParams();
  const pathname = usePathname();
  const [bucket, setBucket] = useState<BucketFilter>(() => readBucket(params.get("bucket")));
  // `?demo=false` comes from the dashboard drill links, whose KPI counted real
  // profiles only. It is a landing scope, not a pill: the table still shows
  // sample rows (with a «نمونه» badge) when the operator arrives normally.
  const [realOnly, setRealOnly] = useState(() => params.get("demo") === "false");
  const [lifecycle, setLifecycle] = useState<LifecycleFilter>("ALL");
  // `searchInput` is what the operator is typing; `appliedSearch` is the term
  // actually sent to the API. They are kept separate on purpose: typing only
  // moves the input, and the query changes solely on a debounce, an Enter or
  // the search button — never on every keystroke.
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);

  // Any change to the query narrows the result set, so return to page 1. The
  // ref mirror lets the guard skip the set when we are already on page 1 —
  // otherwise a re-applied change would schedule a redundant bailout render
  // (and re-invoke the query hook once more for nothing).
  const pageRef = useRef(page);
  pageRef.current = page;
  useEffect(() => {
    if (pageRef.current !== 1) setPage(1);
  }, [appliedSearch, bucket, realOnly, lifecycle, pageSize]);

  // Mirror the bucket scope into the address WITHOUT navigating.
  // `router.replace` here would be a full RSC round-trip per pill click — the
  // same trap the audit trail hit — and would also re-run this page's hooks.
  useEffect(() => {
    const parts: string[] = [];
    if (bucket !== "ALL") parts.push(`bucket=${bucket}`);
    if (realOnly) parts.push("demo=false");
    const qs = parts.length ? `?${parts.join("&")}` : "";
    window.history.replaceState(null, "", qs ? `${pathname}${qs}` : pathname);
  }, [bucket, realOnly, pathname]);

  // Each applied term gets its own cache key, so a late response for an old
  // term can never overwrite the results of the newer one.
  const query = useAdminLawyers({
    bucket: bucket === "ALL" ? undefined : bucket,
    lifecycle: lifecycle === "ALL" ? undefined : lifecycle,
    demo: realOnly ? false : undefined,
    search: appliedSearch || undefined,
    page,
    pageSize,
  });
  const feature = useSetAdminLawyerFeatured();

  // Auto-run once the operator pauses typing. A term already applied is
  // skipped, so the pause that follows a confirmed Enter — or a keystroke that
  // cancels a pending term back to the applied value — sends nothing.
  useEffect(() => {
    const term = searchInput.trim();
    if (term === appliedSearch) return;
    const timer = setTimeout(() => setAppliedSearch(term), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, appliedSearch]);

  // Enter in the field, or the search button: commit now and short-circuit the
  // pending debounce. Repeating the applied term is a no-op. The page resets to
  // the first window whenever the applied term changes (see the effect above).
  function commitSearch() {
    const term = searchInput.trim();
    if (term === appliedSearch) return;
    setAppliedSearch(term);
  }

  const bucketFilters: { value: BucketFilter; label: string }[] = [
    { value: "ALL", label: "همه" },
    ...LAWYER_DECISION_BUCKETS.map((b) => ({ value: b, label: LAWYER_DECISION_BUCKET_FA[b] })),
  ];

  const lifecycleFilters: { value: LifecycleFilter; label: string }[] = [
    { value: "ALL", label: "همه" },
    ...(["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"] as AdminLawyerStatus[]).map((s) => ({
      value: s,
      label: ADMIN_LAWYER_STATUS_FA[s],
    })),
  ];

  async function toggleFeatured(id: string, next: boolean) {
    try {
      await feature.mutateAsync({ id, featured: next });
      snackbar.show({
        message: next ? "وکیل در بخش پیشنهادی برجسته شد." : "برجسته‌سازی لغو شد.",
        variant: "success",
      });
    } catch {
      snackbar.show({ message: "تغییر برجسته‌سازی ناموفق بود", variant: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title="وکلا"
        description="مدیریت کامل وکلای پلتفرم. هر تغییر (ویرایش، وضعیت، آواتار، امتیاز، نظر، برجسته‌سازی) بلافاصله در سایت عمومی LegalIR بازتاب داده می‌شود."
        actions={<ExportButton kind="lawyers" />}
      />

      {!canReview && (
        <InfoBanner tone="warning">
          شما مجوز بررسی و تأیید وکلا را ندارید؛ این فهرست فقط‌خواندنی است و امکان ثبت تصمیم وجود ندارد.
        </InfoBanner>
      )}

      {realOnly && (
        // Arrived from a dashboard KPI, which counts real profiles only. Say so
        // — a silently narrowed list reads as missing data — and offer the way
        // back to the full table.
        <InfoBanner tone="info">
          این فهرست فقط پروفایل‌های واقعی را نشان می‌دهد تا با عددی که از داشبورد آمده
          بخواند؛ پروفایل‌های نمونه پنهان‌اند.{" "}
          <button
            type="button"
            onClick={() => setRealOnly(false)}
            className="font-medium text-primary underline underline-offset-2 hover:text-primary-600"
          >
            نمایش همهٔ پروفایل‌ها
          </button>
        </InfoBanner>
      )}

      <div className="mb-4 flex flex-col gap-3">
        {/* The decision axis first: it is the work queue, and it is the one
            axis the dashboard links into. */}
        <FilterPills
          options={bucketFilters}
          value={bucket}
          onChange={setBucket}
          label="تصمیم بررسی"
        />
        <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
          <FilterPills
            options={lifecycleFilters}
            value={lifecycle}
            onChange={setLifecycle}
            label="وضعیت نمایش"
          />
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              commitSearch();
            }}
            className="flex w-full items-center gap-2 tablet:w-80"
          >
            <div className="relative flex-1">
              <IconSearch
                size={16}
                className="pointer-events-none absolute inset-y-0 start-3 my-auto text-outline"
                aria-hidden="true"
              />
              <TextInput
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="جستجو: نام، پروانه، تخصص، شهر، موبایل…"
                aria-label="جستجوی وکیل"
                className="ps-9"
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              ariaLabel="اعمال جستجو"
              title="اعمال جستجو"
              className="px-2.5"
              startIcon={<IconSearch size={16} aria-hidden="true" />}
              loading={query.isFetching}
            />
          </form>
        </div>
      </div>

      <StateView
        query={query}
        loadingRows={6}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="وکیلی با این فیلتر یافت نشد."
      >
        {(data) => (
          <>
            {/*
              EIGHT columns, not twelve. The four ways an operator scans this
              list — who, what they practise, how they are rated, whether they
              are live — each get ONE cell, with the related secondary value
              stacked beneath the primary instead of taking a column of its
              own. Nothing is dropped: mobile, licence number, extra
              specialities, experience and the featured flag are all still on
              screen, just not each in a lane of their own.
            */}
            <DataTable
              head={
                <tr>
                  <Th>وکیل</Th>
                  <Th>تخصص و پایه</Th>
                  <Th>شهر / سابقه</Th>
                  <Th>امتیاز</Th>
                  <Th>درآمد</Th>
                  <Th>تأیید / وضعیت</Th>
                  <Th>بروزرسانی</Th>
                  <Th>عملیات</Th>
                </tr>
              }
            >
              {data.items.map((l) => {
                const otherCount = Math.max(0, l.specializations.length - 1);
                return (
                  <tr key={l.id} className="hover:bg-surface-hover">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <LawyerAvatar
                          name={l.fullName}
                          avatarUrl={l.avatarUrl}
                          avatarType={l.avatarType}
                          size={36}
                        />
                        <div className="flex min-w-0 max-w-40 flex-col">
                          <span className="flex items-center gap-1.5 font-medium text-on-surface">
                            <span className="truncate">{l.fullName}</span>
                            {l.isDemo && (
                              <Badge tone="neutral" title="پروفایل نمونه / داده توسعه">
                                نمونه
                              </Badge>
                            )}
                          </span>
                          {/* The row id is not repeated here: it is already on
                              the drawer header and in the URL, and the chip was
                              the single widest thing in the table. */}
                          <MaskedMobile value={l.mobile} className="text-caption" />
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-caption text-on-surface-variant">
                          {l.primarySpecialtyId ? specialtyLabel(l.primarySpecialtyId) : "—"}
                          {otherCount > 0 ? (
                            <span className="text-muted"> +{toPersianNumber(otherCount)}</span>
                          ) : null}
                        </span>
                        <span className="text-caption text-muted">
                          {l.professionalRank
                            ? LAWYER_PROFESSIONAL_RANK_SHORT_FA[l.professionalRank]
                            : "—"}
                          {l.licenseNumber ? (
                            <span dir="ltr" className="ms-1 tabular-nums">
                              · {l.licenseNumber}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-caption text-on-surface-variant">
                          {l.cities || "—"}
                        </span>
                        <span className="text-caption text-muted">
                          {l.yearsExperience != null
                            ? `${toPersianNumber(l.yearsExperience)} سال سابقه`
                            : "سابقه ثبت نشده"}
                        </span>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {l.displayRating != null && l.displayReviewCount > 0 ? (
                        <span className="tabular-nums text-on-surface">
                          {toPersianNumber(Number(l.displayRating.toFixed(1)))}
                          <span className="text-muted"> از ۵</span>
                          <span className="block text-caption text-muted">
                            {toPersianNumber(l.displayReviewCount)} رأی
                          </span>
                        </span>
                      ) : (
                        <span className="text-caption text-muted">بدون امتیاز</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {l.income.hasData ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="tabular-nums text-body-2 text-on-surface">
                            {toPersianCurrency(l.income.netEarned)}
                          </span>
                          <span className="text-caption text-muted">
                            {l.income.outstanding > 0
                              ? `${toPersianCurrency(l.income.outstanding)} مانده`
                              : "تسویه‌شده"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-caption text-muted">بدون تسویه</span>
                      )}
                    </Td>
                    <Td>
                      {/* The review decision and the operator lifecycle both
                          answer "is this lawyer live" — one cell, the decision
                          on top. */}
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone={BUCKET_TONES[l.bucket]}>
                          {LAWYER_DECISION_BUCKET_FA[l.bucket]}
                        </Badge>
                        <Badge tone={LIFECYCLE_TONES[l.lifecycle]} dot>
                          {ADMIN_LAWYER_STATUS_FA[l.lifecycle]}
                        </Badge>
                        {l.featured && <Badge tone="brand">برجسته</Badge>}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-caption text-muted">
                      {toPersianDate(l.updatedAt)}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setOpenId(l.id)}>
                          مدیریت
                        </Button>
                        {canFeature && (
                          // Icon-only so the actions fit on one 1280px screen.
                          // The label lives in aria-label/title for AT and hover.
                          <Button
                            size="sm"
                            variant={l.featured ? "tonal" : "ghost"}
                            ariaLabel={l.featured ? "لغو برجسته‌سازی" : "برجسته‌سازی"}
                            title={l.featured ? "لغو برجسته‌سازی" : "برجسته‌سازی"}
                            disabled={feature.isPending}
                            className="px-2"
                            startIcon={<IconStar size={16} aria-hidden="true" />}
                            onClick={() => toggleFeatured(l.id, !l.featured)}
                          />
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </DataTable>

            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              itemLabel="وکیل"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </StateView>

      <LawyerDetailDrawer
        lawyerId={openId}
        open={openId !== null}
        onClose={() => setOpenId(null)}
        canReview={canReview}
      />
    </div>
  );
}
