// ============================================================
// LEGALIR — Admin · Contracts review queue (قراردادها و بررسی حقوقی)
// ============================================================
// §6/§7: the platform-side queue over every generated contract. The rows are
// DERIVED from the real contract state — the approval badge is true only when
// the CURRENT version still carries a valid, bound admin approval, so a
// contract whose content changed after approval shows as un-approved again.
//
// The table is a TRIAGE surface: only the columns an operator needs to pick the
// next row are shown here. Version history, signing progress and the rendered
// document live in the drawer, which loads them on demand — so no column ever
// has to compress to fit, and the row never repeats what the drawer shows.
//
// Every filter is server-side (`type`, `from`, `to`, `sort`, `search`,
// `status`) and resets pagination, so what the operator sees is exactly the
// filtered slice the API returned — never a client-side echo of one page.
//
// An operator with `admin:contracts:review` opens the drawer to judge the
// rendered document and record the ONE decision the backend allows. Without
// that permission the surface is purely observational.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminContracts, useAdminMe } from "@/hooks/useAdmin";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import { CONTRACT_ADMIN_REVIEW_STATUS_FA } from "@legalir/types";
import type { ContractAdminReviewStatus, ContractTypeId } from "@legalir/types";
import {
  PageHeader,
  DataTable,
  Th,
  Td,
  Badge,
  StateView,
  TextInput,
  Button,
  IdChip,
  FilterPills,
  Pagination,
  SearchInput,
  Select,
  Field,
  InlineNotice,
} from "@/components/admin/ui";
import type { AdminContractsSort } from "@/lib/api/admin";
import { DEFAULT_PAGE_SIZE } from "@/lib/admin/pagination";
import { IconEdit, IconCheckCircle, IconRefresh } from "@/lib/icons";
import { ContractDetailDrawer } from "@/components/admin/contract-detail-drawer";

const REVIEW_STATUSES: ContractAdminReviewStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
  "CANCELLED",
];

const STATUS_TONES: Record<
  string,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CHANGES_REQUESTED: "warning",
  CANCELLED: "neutral",
};

/** The orderings the API accepts; labels are worded per the column they sort. */
const SORT_OPTIONS: { value: AdminContractsSort; label: string }[] = [
  { value: "updated_desc", label: "آخرین تغییر (جدیدترین)" },
  { value: "updated_asc", label: "آخرین تغییر (قدیمی‌ترین)" },
  { value: "created_desc", label: "تاریخ ایجاد (جدیدترین)" },
  { value: "created_asc", label: "تاریخ ایجاد (قدیمی‌ترین)" },
  { value: "reference_asc", label: "کد پیگیری (الفبا)" },
];

const DEFAULT_SORT: AdminContractsSort = "updated_desc";

export default function AdminContractsPage() {
  const { can } = useAdminMe();
  const canReview = can("admin:contracts:review");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<AdminContractsSort>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  // A reversed window would return nothing at all, which reads as "no results"
  // rather than as a mistake. Detect it, say so, and leave the range off the
  // request so the rest of the filters keep working.
  const rangeInvalid = Boolean(from && to && from > to);

  useEffect(
    () => setPage(1),
    [debouncedSearch, status, type, from, to, sort, pageSize, rangeInvalid]
  );

  const query = useAdminContracts({
    search: debouncedSearch || undefined,
    status: status ? (status as ContractAdminReviewStatus) : undefined,
    type: type ? (type as ContractTypeId) : undefined,
    from: rangeInvalid ? undefined : from || undefined,
    to: rangeInvalid ? undefined : to || undefined,
    sort,
    page,
    pageSize,
  });

  const counts = query.data?.counts;
  const typeOptions = query.data?.types ?? [];

  const hasActiveFilters = Boolean(
    debouncedSearch || status || type || from || to || sort !== DEFAULT_SORT
  );

  const statusFilters = useMemo(
    () => [
      { value: "", label: "همه" },
      ...REVIEW_STATUSES.map((s) => ({ value: s, label: CONTRACT_ADMIN_REVIEW_STATUS_FA[s] })),
    ],
    []
  );

  function resetFilters() {
    setSearch("");
    setStatus("");
    setType("");
    setFrom("");
    setTo("");
    setSort(DEFAULT_SORT);
  }

  return (
    <div>
      <PageHeader
        title="قراردادها و بررسی حقوقی"
        description="صف بررسی قراردادهای تولیدشده. پیش از صدور نسخهٔ نهایی یا آماده‌سازی امضا، هر قرارداد باید از این صف تأیید بگذرد. تأیید به اثر انگشت نسخه گره می‌خورد و پس از هر تغییر محتوا باطل می‌شود."
      />

      {/* Priority 1 — free text and the review state, the two filters used on
          every visit. Everything narrower sits on the row below. */}
      <div className="mb-4">
        <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="جستجو در کد پیگیری، عنوان، مالک یا طرفین"
            className="tablet:min-w-[260px] tablet:flex-1"
          />
          <FilterPills options={statusFilters} value={status} onChange={setStatus} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 tablet:grid-cols-4 laptop:grid-cols-5">
          <Field label="نوع قرارداد">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">همه انواع</option>
              {typeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.labelFa}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="آخرین تغییر از">
            <TextInput
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="تا تاریخ">
            <TextInput
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Field label="مرتب‌سازی">
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as AdminContractsSort)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="col-span-2 flex items-end tablet:col-span-4 laptop:col-span-1">
            <Button
              variant="ghost"
              size="sm"
              startIcon={<IconRefresh size={15} />}
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="w-full laptop:w-auto"
            >
              پاک‌کردن فیلترها
            </Button>
          </div>
        </div>

        {rangeInvalid && (
          <InlineNotice tone="warning" className="mt-3">
            بازهٔ تاریخ نامعتبر است: «از» بعد از «تا» انتخاب شده. تا اصلاح آن، بازه در جستجو
            اعمال نمی‌شود.
          </InlineNotice>
        )}
      </div>

      {counts && (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-caption text-muted">
          <span>در انتظار: {toPersianNumber(counts.pending)}</span>
          <span>تأییدشده: {toPersianNumber(counts.approved)}</span>
          <span>ردشده: {toPersianNumber(counts.rejected)}</span>
          <span>نیازمند اصلاح: {toPersianNumber(counts.changesRequested)}</span>
        </div>
      )}

      <StateView
        query={query}
        loadingRows={6}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage={
          hasActiveFilters
            ? "قراردادی با این فیلترها یافت نشد."
            : "هنوز قراردادی در صف بررسی ثبت نشده است."
        }
      >
        {(data) => (
          <>
            <DataTable
              minWidth={480}
              head={
                <tr>
                  <Th>کد پیگیری</Th>
                  <Th className="hidden tablet:table-cell">نوع</Th>
                  <Th>وضعیت بررسی</Th>
                  <Th>وضعیت قرارداد</Th>
                  <Th className="hidden laptop:table-cell">مالک / طرفین</Th>
                  <Th className="hidden desktop:table-cell">آخرین تغییر</Th>
                  <Th>عملیات</Th>
                </tr>
              }
            >
              {data.items.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-on-surface">{c.referenceCode}</span>
                        {c.isSample && <Badge tone="warning">نمونه آزمایشی</Badge>}
                      </div>
                      <IdChip id={c.id} />
                    </div>
                  </Td>
                  <Td className="hidden tablet:table-cell">{c.typeFa}</Td>
                  <Td>
                    {c.adminReviewStatus ? (
                      <Badge tone={STATUS_TONES[c.adminReviewStatus] ?? "neutral"} dot>
                        {c.adminReviewStatusFa ?? c.adminReviewStatus}
                      </Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="brand">{c.stateFa}</Badge>
                      {c.adminApproved && (
                        <Badge tone="success" title="نسخهٔ فعلی تأییدشده است">
                          <IconCheckCircle size={13} />
                        </Badge>
                      )}
                    </div>
                  </Td>
                  <Td className="hidden laptop:table-cell">
                    <div className="flex max-w-[220px] flex-col">
                      <span className="truncate text-on-surface-variant" title={c.ownerLabelFa}>
                        {c.ownerLabelFa}
                      </span>
                      <span
                        className="truncate text-caption text-muted"
                        title={c.partySummaryFa}
                      >
                        {c.partySummaryFa}
                      </span>
                    </div>
                  </Td>
                  <Td className="hidden whitespace-nowrap tabular-nums desktop:table-cell">
                    {toPersianDate(c.updatedAt)}
                  </Td>
                  <Td>
                    <Button
                      size="sm"
                      variant="secondary"
                      startIcon={<IconEdit size={15} />}
                      onClick={() => setOpenId(c.id)}
                    >
                      {canReview ? "بررسی" : "مشاهده"}
                    </Button>
                  </Td>
                </tr>
              ))}
            </DataTable>

            <Pagination
              page={data.pagination.page}
              pageSize={data.pagination.pageSize}
              total={data.pagination.total}
              totalPages={data.pagination.totalPages}
              itemLabel="قرارداد"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </StateView>

      <ContractDetailDrawer
        contractId={openId}
        canReview={canReview}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
