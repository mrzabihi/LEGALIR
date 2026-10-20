// ============================================================
// LEGALIR — Lawyer workbench · Referral queue (درخواست‌ها)
// ============================================================
// The lawyer's queue. Every filter is applied SERVER-side (the lawyer id
// comes from the session, so there is no parameter that could point at
// somebody else's work) and every row carries the facts the spec asks for:
// title + service, request id, client (or organization + representative),
// referral date/time, state, derived priority, SLA deadline + remaining, and
// last activity.
//
// `?bucket=` arrives from a dashboard KPI and reuses the dashboard's own
// predicate, so the count and the rows always agree.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLawyerReferrals } from "@/hooks/useLawyerPortal";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyBlock,
  ErrorBlock,
  Field,
  FilterPills,
  IdChip,
  LoadingBlock,
  Pagination,
  PageHeader,
  SearchInput,
  Select,
  TextInput,
  Th,
  Td,
} from "@/components/admin/ui";
import { PriorityBadge, StateBadge, SlaBadge } from "@/components/lawyer/sla-badge";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import { DEFAULT_PAGE_SIZE } from "@/lib/admin/pagination";
import {
  LAWYER_REFERRAL_PRIORITIES,
  LAWYER_REFERRAL_PRIORITY_FA,
  SLA_HEALTH_FA,
  type LawyerDashboardCounts,
  type LawyerReferralFilters,
  type LawyerReferralListItem,
  type LawyerReferralPriority,
  type LegalRequestState,
  type SlaHealth,
} from "@legalir/types";
import { IconDocument, IconFilter, IconSearch } from "@/lib/icons";
// The shared panel `Button` forwards a fixed prop list, so it drops
// `aria-expanded`/`aria-controls`. A disclosure toggle has to expose those to
// assistive tech, so the toggle renders the product primitive, which spreads
// the remaining button attributes through. Same visual language, same size
// scale as the panel buttons around it.
import { Button as UiButton } from "@legalir/ui";

type Perspective = LawyerReferralListItem["perspective"];

const PERSPECTIVE_FA: Record<Perspective, string> = {
  NEEDS_ACTION: "نیازمند اقدام",
  WAITING_ON_CLIENT: "منتظر موکل",
  ACTIVE: "در جریان",
  DONE: "پایان‌یافته",
};

const BUCKET_FA: Record<keyof LawyerDashboardCounts, string> = {
  newAssignments: "درخواست‌های جدید",
  viewed: "بازشده، منتظر تصمیم",
  accepted: "پذیرفته، هنوز شروع نشده",
  inProgress: "در حال انجام",
  waitingForClient: "منتظر پاسخ موکل",
  completed: "تکمیل‌شده",
  declined: "ردشده",
  cancelled: "لغوشده",
  atRisk: "نزدیک به مهلت",
  breached: "گذشته از مهلت",
};

const BUCKET_KEYS = Object.keys(BUCKET_FA) as (keyof LawyerDashboardCounts)[];

const SLA_KEYS: SlaHealth[] = [
  "ON_TRACK",
  "AT_RISK",
  "BREACHED",
  "PAUSED",
  "MET",
  "MISSED",
  "NONE",
];

const SEARCH_DEBOUNCE_MS = 350;

export default function LawyerReferralsPage() {
  const params = useSearchParams();
  const bucketParam = params.get("bucket");
  const bucket =
    bucketParam && (BUCKET_KEYS as string[]).includes(bucketParam)
      ? (bucketParam as keyof LawyerDashboardCounts)
      : null;

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perspective, setPerspective] = useState<Perspective | "">("");
  const [state, setState] = useState<LegalRequestState | "">("");
  const [slaHealth, setSlaHealth] = useState<SlaHealth | "">("");
  const [priority, setPriority] = useState<LawyerReferralPriority | "">("");
  const [serviceKey, setServiceKey] = useState("");
  const [fromIso, setFromIso] = useState("");
  const [toIso, setToIso] = useState("");
  const [sort, setSort] = useState<NonNullable<LawyerReferralFilters["sort"]>>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  // Mobile-only disclosure: on a phone the nine filter controls stack into
  // ~500px of form and push the first request row below the fold. Search and
  // the perspective pills stay visible; everything else opens on demand.
  // From `tablet` up the toggle is hidden and the controls always show.
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  // Typing only moves the input; the query changes on a pause.
  useEffect(() => {
    const term = searchInput.trim();
    if (term === search) return;
    const timer = setTimeout(() => setSearch(term), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  // Any narrowing returns to the first page, so the operator never lands on a
  // page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [
    search,
    perspective,
    state,
    slaHealth,
    priority,
    serviceKey,
    fromIso,
    toIso,
    sort,
    pageSize,
    bucket,
  ]);

  const filters: LawyerReferralFilters = {
    bucket,
    search: search || null,
    perspective: perspective || null,
    state: state || null,
    slaHealth: slaHealth || null,
    priority: priority || null,
    serviceKey: serviceKey || null,
    fromIso: fromIso ? `${fromIso}T00:00:00.000Z` : null,
    toIso: toIso ? `${toIso}T23:59:59.999Z` : null,
    sort,
    page,
    pageSize,
  };

  const query = useLawyerReferrals(filters);
  const data = query.data;

  const serviceOptions = useMemo(() => data?.facets.services ?? [], [data?.facets.services]);
  const stateOptions = useMemo(() => data?.facets.states ?? [], [data?.facets.states]);

  const activeFilterCount = [
    search,
    perspective,
    state,
    slaHealth,
    priority,
    serviceKey,
    fromIso,
    toIso,
  ].filter(Boolean).length;

  function clearAll() {
    setSearchInput("");
    setSearch("");
    setPerspective("");
    setState("");
    setSlaHealth("");
    setPriority("");
    setServiceKey("");
    setFromIso("");
    setToIso("");
  }

  return (
    <div>
      <PageHeader
        title={bucket ? BUCKET_FA[bucket] : "درخواست‌ها"}
        description="همهٔ درخواست‌های ارجاع‌شده به شما، با وضعیت گردش‌کار و وضعیت مهلت. فیلترها در سرور اعمال می‌شوند."
        icon={<IconDocument size={22} />}
        actions={
          bucket ? (
            <Link
              href="/lawyer/referrals"
              className="text-caption font-medium text-primary hover:underline"
            >
              حذف فیلتر داشبورد
            </Link>
          ) : undefined
        }
      />

      {bucket && (
        <div className="mb-4">
          <Badge tone="brand">{BUCKET_FA[bucket]} — از داشبورد</Badge>
        </div>
      )}

      {/* Filter bar */}
      <Card className="mb-4 p-3 tablet:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <SearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder="جستجو: عنوان، موکل، شناسه…"
                ariaLabel="جستجوی درخواست"
              />
            </div>
            {/* Mobile-only disclosure for the narrowing controls below;
                `aria-controls` ties the toggle to the panel it governs. It
                rides beside the search field so the collapsed bar costs one
                row, and it carries the live count when a filter is active. */}
            <UiButton
              variant="secondary"
              size="small"
              className="tablet:hidden shrink-0"
              onClick={() => setMoreFiltersOpen((v) => !v)}
              aria-expanded={moreFiltersOpen}
              aria-controls="lawyer-referral-more-filters"
              aria-label={
                activeFilterCount > 0
                  ? `فیلترها، ${toPersianNumber(activeFilterCount)} فیلتر فعال`
                  : "نمایش فیلترها"
              }
              startIcon={<IconFilter size={15} />}
            >
              {moreFiltersOpen ? "بستن" : "فیلترها"}
              {activeFilterCount > 0 ? ` (${toPersianNumber(activeFilterCount)})` : ""}
            </UiButton>
          </div>

          <div
            id="lawyer-referral-more-filters"
            className={[
              "w-full flex-col gap-3",
              moreFiltersOpen ? "flex" : "hidden tablet:flex",
            ].join(" ")}
          >
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-full tablet:w-56">
                <Field label="خدمت">
                  <Select
                    value={serviceKey}
                    onChange={(e) => setServiceKey(e.target.value)}
                    aria-label="فیلتر خدمت"
                  >
                    <option value="">همهٔ خدمات</option>
                    {serviceOptions.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.labelFa} ({toPersianNumber(s.count)})
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="w-full tablet:w-48">
                <Field label="وضعیت مهلت">
                  <Select
                    value={slaHealth}
                    onChange={(e) => setSlaHealth(e.target.value as SlaHealth | "")}
                    aria-label="فیلتر وضعیت مهلت"
                  >
                    <option value="">همه</option>
                    {SLA_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {SLA_HEALTH_FA[k]} ({toPersianNumber(data?.facets.sla[k] ?? 0)})
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="w-full tablet:w-40">
                <Field label="اولویت">
                  <Select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as LawyerReferralPriority | "")}
                    aria-label="فیلتر اولویت"
                  >
                    <option value="">همه</option>
                    {LAWYER_REFERRAL_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {LAWYER_REFERRAL_PRIORITY_FA[p]} (
                        {toPersianNumber(
                          data?.facets.priorities.find((f) => f.value === p)?.count ?? 0
                        )}
                        )
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="w-full tablet:w-44">
                <Field label="ترتیب">
                  <Select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as typeof sort)}
                    aria-label="ترتیب نمایش"
                  >
                    <option value="newest">جدیدترین</option>
                    <option value="oldest">قدیمی‌ترین</option>
                    <option value="due">نزدیک‌ترین مهلت</option>
                  </Select>
                </Field>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="w-full tablet:w-40">
                <Field label="از تاریخ ارجاع">
                  <TextInput
                    type="date"
                    value={fromIso}
                    onChange={(e) => setFromIso(e.target.value)}
                    aria-label="از تاریخ"
                  />
                </Field>
              </div>
              <div className="w-full tablet:w-40">
                <Field label="تا تاریخ">
                  <TextInput
                    type="date"
                    value={toIso}
                    onChange={(e) => setToIso(e.target.value)}
                    aria-label="تا تاریخ"
                  />
                </Field>
              </div>
              {stateOptions.length > 0 && (
                <div className="w-full tablet:w-56">
                  <Field label="وضعیت درخواست">
                    <Select
                      value={state}
                      onChange={(e) => setState(e.target.value as LegalRequestState | "")}
                      aria-label="فیلتر وضعیت درخواست"
                    >
                      <option value="">همهٔ وضعیت‌ها</option>
                      {stateOptions.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.labelFa} ({toPersianNumber(s.count)})
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              )}
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  startIcon={<IconFilter size={15} />}
                >
                  پاک کردن فیلترها ({toPersianNumber(activeFilterCount)})
                </Button>
              )}
            </div>
          </div>

          {/* Perspective pills stay outside the disclosure: they are the
              fastest way to narrow the list, so they're always one tap away. */}
          <FilterPills
            value={perspective}
            onChange={setPerspective}
            options={[
              { value: "" as Perspective | "", label: "همه" },
              ...(["NEEDS_ACTION", "WAITING_ON_CLIENT", "ACTIVE", "DONE"] as Perspective[]).map(
                (p) => ({ value: p as Perspective | "", label: PERSPECTIVE_FA[p] })
              ),
            ]}
          />
        </div>
      </Card>

      {query.isLoading ? (
        <LoadingBlock rows={6} />
      ) : query.isError || !data ? (
        <ErrorBlock message="خطا در بارگذاری درخواست‌ها" onRetry={() => query.refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyBlock
          message="درخواستی با این فیلتر یافت نشد."
          hint="فیلترها را تغییر دهید یا از فهرست کامل شروع کنید."
        />
      ) : (
        <>
          <DataTable
            minWidth={1080}
            head={
              <tr>
                <Th>درخواست</Th>
                <Th>موکل</Th>
                <Th>وضعیت</Th>
                <Th>اولویت</Th>
                <Th>مهلت</Th>
                <Th>آخرین رویداد</Th>
                <Th>ارجاع</Th>
                <Th>عملیات</Th>
              </tr>
            }
          >
            {data.items.map((row) => (
              <tr key={row.requestId} className="hover:bg-surface-hover">
                <Td>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-on-surface">{row.title || "بدون عنوان"}</span>
                    <span className="text-caption text-muted">{row.serviceLabelFa}</span>
                    <IdChip id={row.requestId} />
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-col">
                    <span>{row.organizationName ?? row.clientName}</span>
                    {row.organizationName && (
                      <span className="text-caption text-muted">{row.clientName}</span>
                    )}
                  </div>
                </Td>
                <Td>
                  <StateBadge state={row.state} />
                </Td>
                <Td>
                  <PriorityBadge priority={row.priority} />
                </Td>
                <Td>
                  <SlaBadge sla={row.sla} />
                </Td>
                <Td className="text-caption">
                  <div className="flex flex-col">
                    <span>{row.lastActivityFa}</span>
                    <span className="text-muted">{toPersianDate(row.lastActivityAt)}</span>
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-caption">{toPersianDate(row.referredAt)}</Td>
                <Td>
                  <Link
                    href={`/lawyer/referrals/${row.requestId}`}
                    className="inline-flex items-center gap-1 rounded-medium border border-divider px-3 py-1.5 text-caption font-medium text-on-surface-variant transition-colors hover:border-primary-300 hover:text-primary"
                  >
                    <IconSearch size={14} /> مشاهده
                  </Link>
                </Td>
              </tr>
            ))}
          </DataTable>

          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            totalPages={data.totalPages}
            itemLabel="درخواست"
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}
    </div>
  );
}
