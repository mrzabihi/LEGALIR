// ============================================================
// LEGALIR — Admin · Path discovery (پیشنهاد مسیر حقوقی)
// ============================================================
// The operational view of the «از کجا شروع کنم؟» intake: how the engine
// analysed the requests that came through it, what it recommended, and what
// the users actually chose.
//
// The panel is deliberately honest about provenance. Every metric is derived
// from the REAL discovery records the flow persisted — the model/rules split
// is stated, a confidence figure appears only where the engine estimated one,
// and the engine's recommendation is always shown apart from the user's
// choice. A request that never went through the intake is excluded from every
// denominator, so an operator never reads a real zero as a failure.
//
// Access is gated on `admin:requests:read` (the server re-checks it); the
// blocked state is a plain explanation, never a silent empty dashboard.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminDiscovery, useAdminMe } from "@/hooks/useAdmin";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { toPersianDate } from "@/lib/persian-utils";
import { LEGAL_REQUEST_STATE_FA, LEGAL_CATEGORY_FA } from "@legalir/types";
import {
  PageHeader,
  DataTable,
  Th,
  Td,
  Badge,
  StateView,
  SearchInput,
  Button,
  IdChip,
  FilterPills,
  Pagination,
  Section,
  StatCard,
  InfoBanner,
} from "@/components/admin/ui";
import { DEFAULT_PAGE_SIZE } from "@/lib/admin/pagination";
import { discoveryIntentLabel } from "@/lib/intake/discovery";
import { IconSparkle, IconEdit } from "@/lib/icons";
import { RequestDetailDrawer } from "@/components/admin/request-detail-drawer";

const STATE_TONES: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "brand"> = {
  DRAFT: "neutral",
  INTAKE: "info",
  MATCHING: "info",
  ASSIGNED: "brand",
  IN_PROGRESS: "brand",
  AWAITING_CLIENT: "warning",
  AWAITING_LAWYER: "warning",
  COMPLETED: "success",
  CLOSED: "neutral",
  CANCELLED: "danger",
  DISPUTED: "danger",
};

const fa = (n: number) => n.toLocaleString("fa-IR");

export default function AdminDiscoveryPage() {
  const { can } = useAdminMe();
  const allowed = can("admin:requests:read");

  const [search, setSearch] = useState("");
  const [source, setSource] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  useEffect(() => setPage(1), [debouncedSearch, source, pageSize]);

  const query = useAdminDiscovery({
    search: debouncedSearch,
    source: source ? (source as "ai" | "rules") : undefined,
    page,
    pageSize,
  });

  const sourceFilters = useMemo(
    () => [
      { value: "", label: "همه" },
      { value: "ai", label: "تحلیل با مدل" },
      { value: "rules", label: "تحلیل با قواعد" },
    ],
    []
  );

  // The category distribution with a Persian label, kept in the server's order.
  const categoryRows = useMemo(
    () =>
      (query.data?.stats.byCategory ?? []).map((c) => ({
        ...c,
        label: LEGAL_CATEGORY_FA[c.key] ?? c.key,
      })),
    [query.data]
  );

  if (!allowed) {
    return (
      <div>
        <PageHeader
          title="مسیر پیشنهادی حقوقی"
          icon={<IconSparkle size={22} />}
          description="تحلیل درخواست‌هایی که از مسیر «از کجا شروع کنم؟» گذشته‌اند."
        />
        <InfoBanner tone="warning">
          برای مشاهدهٔ این بخش به مجوز «مشاهدهٔ درخواست‌ها» نیاز دارید. این بخش برای حساب شما در
          دسترس نیست.
        </InfoBanner>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="مسیر پیشنهادی حقوقی"
        icon={<IconSparkle size={22} />}
        description="درخواست‌هایی که کاربر بدون دانستن مسیر مناسب ثبت کرده است: برداشت موتور از مسئله، مسیرهای پیشنهادی و مسیر نهایی برگزیدهٔ کاربر. همهٔ اعداد از رکوردهای واقعی جریان کشف مسیر محاسبه می‌شوند."
      />

      <StateView
        query={query}
        loadingRows={8}
        isEmpty={(d) => d.stats.total === 0}
        emptyMessage="هنوز درخواستی از مسیر «از کجا شروع کنم؟» ثبت نشده است."
        emptyHint="به‌محض ثبت اولین درخواست از این جریان، تحلیل و آمار آن اینجا نمایش داده می‌شود."
      >
        {(data) => {
          const s = data.stats;
          return (
            <>
              {/* ── Cohort KPIs ─────────────────────────────────── */}
              <div className="mb-6 grid grid-cols-2 gap-3 tablet:grid-cols-4 laptop:grid-cols-5">
                <StatCard
                  label="کل درخواست‌های کشف مسیر"
                  value={fa(s.total)}
                  hint="درخواست‌های دارای رکورد تحلیل مسیر"
                  accent
                  icon={<IconSparkle size={18} />}
                />
                <StatCard
                  label="تحلیل با مدل"
                  value={fa(s.bySource.ai)}
                  hint="تحلیل ساختارمند توسط مدل زبانی"
                />
                <StatCard
                  label="تحلیل با قواعد"
                  value={fa(s.bySource.rules)}
                  hint="بازگشت به تحلیل قطعی قواعد (بدون مدل)"
                />
                <StatCard
                  label="میانگین اطمینان"
                  value={s.avgConfidence === null ? "—" : `${fa(s.avgConfidence)}٪`}
                  hint={
                    s.avgConfidence === null
                      ? "هیچ تحلیلی عدد اطمینان تخمین نزده است"
                      : "فقط روی تحلیل‌هایی که اطمینان تخمین زده‌اند"
                  }
                  unavailable={s.avgConfidence === null}
                  unavailableLabel="—"
                />
                <StatCard
                  label="نیازمند وکیل"
                  value={fa(s.needsLawyer)}
                  hint="درخواست‌هایی که موتور نیاز به وکیل را علامت زده است"
                  tone="warning"
                />
              </div>

              <div className="mb-6 grid grid-cols-1 gap-3 laptop:grid-cols-2">
                {/* ── Intent distribution ─────────────────────── */}
                <Section
                  title="توزیع مسیرها بر پایه مقصد"
                  subtitle="تفکیک «پیشنهادشده» از «انتخاب‌شده» — یک پیشنهاد هرگز به‌جای انتخاب گزارش نمی‌شود."
                >
                  <div className="overflow-hidden rounded-large border border-divider">
                    <DataTable
                      bare
                      minWidth={420}
                      head={
                        <tr>
                          <Th>مسیر</Th>
                          <Th>پیشنهاد اول</Th>
                          <Th>پیشنهادشده</Th>
                          <Th>انتخاب کاربر</Th>
                        </tr>
                      }
                    >
                      {s.byIntent.map((row) => (
                        <tr key={row.intent}>
                          <Td className="font-medium text-on-surface">
                            {discoveryIntentLabel(row.intent)}
                          </Td>
                          <Td className="tabular-nums">{fa(row.primary)}</Td>
                          <Td className="tabular-nums">{fa(row.recommended)}</Td>
                          <Td className="tabular-nums">{fa(row.chosen)}</Td>
                        </tr>
                      ))}
                    </DataTable>
                  </div>
                </Section>

                {/* ── Inferred-area distribution ──────────────── */}
                <Section
                  title="توزیع زمینهٔ استنباط‌شده"
                  subtitle="زمینه‌ای که موتور از متن کاربر برداشت کرده است (نه انتخاب صریح کاربر)."
                >
                  {categoryRows.length === 0 ? (
                    <p className="rounded-large border border-divider p-4 text-caption text-muted">
                      زمینه‌ای استنباط نشده است.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-large border border-divider">
                      <DataTable
                        bare
                        minWidth={320}
                        head={
                          <tr>
                            <Th>زمینهٔ حقوقی</Th>
                            <Th>تعداد</Th>
                          </tr>
                        }
                      >
                        {categoryRows.map((row) => (
                          <tr key={row.key}>
                            <Td className="font-medium text-on-surface">{row.label}</Td>
                            <Td className="tabular-nums">{fa(row.count)}</Td>
                          </tr>
                        ))}
                      </DataTable>
                    </div>
                  )}
                </Section>
              </div>

              {/* ── The requests ─────────────────────────────── */}
              <Section
                title="درخواست‌های تحلیل‌شده"
                subtitle="برای مشاهدهٔ برداشت کامل، مسیرهای پیشنهادی و گردش وضعیت، هر ردیف را باز کنید."
              >
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="جستجو در عنوان، خلاصه، کاربر یا شناسه"
                    className="min-w-[240px] flex-1"
                  />
                  <FilterPills options={sourceFilters} value={source} onChange={setSource} />
                </div>

                {data.items.length === 0 ? (
                  <div className="rounded-large border border-divider p-6 text-center text-body-2 text-muted">
                    درخواستی با این فیلتر یافت نشد.
                  </div>
                ) : (
                  <>
                    <DataTable
                      head={
                        <tr>
                          <Th>درخواست</Th>
                          <Th>کاربر</Th>
                          <Th>زمینه</Th>
                          <Th>منبع</Th>
                          <Th>پیشنهاد / انتخاب</Th>
                          <Th>اطمینان</Th>
                          <Th>وضعیت</Th>
                          <Th>ایجاد</Th>
                          <Th>عملیات</Th>
                        </tr>
                      }
                    >
                      {data.items.map((r) => (
                        <tr key={r.id}>
                          <Td>
                            <div className="flex max-w-[18rem] flex-col">
                              <span className="font-medium text-on-surface">
                                {r.title || "بدون عنوان"}
                              </span>
                              <span className="truncate text-caption text-muted" title={r.summaryFa}>
                                {r.summaryFa}
                              </span>
                              <IdChip id={r.id} />
                            </div>
                          </Td>
                          <Td>{r.userDisplayName ?? "—"}</Td>
                          <Td>{LEGAL_CATEGORY_FA[r.inferredCategory ?? ""] ?? "—"}</Td>
                          <Td>
                            <Badge tone={r.source === "ai" ? "info" : "neutral"}>
                              {r.source === "ai" ? "مدل" : "قواعد"}
                            </Badge>
                          </Td>
                          <Td>
                            <div className="flex flex-col gap-1">
                              {r.topIntent && (
                                <span className="text-caption text-on-surface-variant">
                                  پیشنهاد: {discoveryIntentLabel(r.topIntent)}
                                </span>
                              )}
                              <span className="text-caption text-muted">
                                انتخاب:{" "}
                                {r.selectedIntent ? discoveryIntentLabel(r.selectedIntent) : "—"}
                              </span>
                            </div>
                          </Td>
                          <Td className="tabular-nums">
                            {r.confidence === null ? "—" : `${fa(r.confidence)}٪`}
                          </Td>
                          <Td>
                            <Badge tone={STATE_TONES[r.state] ?? "neutral"}>
                              {LEGAL_REQUEST_STATE_FA[
                                r.state as keyof typeof LEGAL_REQUEST_STATE_FA
                              ] ?? r.state}
                            </Badge>
                          </Td>
                          <Td className="whitespace-nowrap">{toPersianDate(r.createdAt)}</Td>
                          <Td>
                            <Button
                              size="sm"
                              variant="secondary"
                              startIcon={<IconEdit size={15} />}
                              onClick={() => setOpenId(r.id)}
                            >
                              مشاهده
                            </Button>
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
              </Section>
            </>
          );
        }}
      </StateView>

      <RequestDetailDrawer
        requestId={openId}
        canManage={can("admin:requests:manage")}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
