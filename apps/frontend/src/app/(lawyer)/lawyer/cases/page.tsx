// ============================================================
// LEGALIR — Lawyer workbench · Caseload (پرونده‌ها)
// ============================================================
// The lawyer's own caseload: every case they own or were granted a membership
// on, with the operational facts that decide what to open next —
//
//   · the relation, so «ارجاع‌شده به شما» is never confused with full access;
//   · the nearest OPEN deadline, or an explicit «بدون اقدام زمان‌دار» (never a
//     fabricated date) and the overdue one that pulled the row to the top;
//   · open / blocked task counts and the attached document count.
//
// Filtering, search, sorting and pagination are SERVER-side (`/api/v1/lawyer/
// cases`), and the summary tiles above the table are computed over the WHOLE
// caseload, so narrowing the list never makes the workload look smaller.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLawyerCases } from "@/hooks/useLawyerPortal";
import {
  Badge,
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
  StatCard,
  Td,
  Th,
} from "@/components/admin/ui";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import { DEFAULT_PAGE_SIZE } from "@/lib/admin/pagination";
import {
  CASE_LIFECYCLE_FA,
  LAWYER_CASE_RELATION_FA,
  type CaseLifecycleStatus,
  type LawyerCaseFilters,
  type LawyerCaseListItem,
  type LawyerCaseRelation,
} from "@legalir/types";
import { IconBriefcase, IconSearch, IconWarning } from "@/lib/icons";

type LifecyclePill = CaseLifecycleStatus | "overdue" | "";

const LIFECYCLE_KEYS: CaseLifecycleStatus[] = ["ACTIVE", "ON_HOLD", "CLOSED", "ARCHIVED"];

const SEARCH_DEBOUNCE_MS = 350;

function lifecycleTone(lifecycle: string): "success" | "warning" | "neutral" | "info" {
  if (lifecycle === "ACTIVE") return "success";
  if (lifecycle === "ON_HOLD") return "warning";
  if (lifecycle === "ARCHIVED") return "neutral";
  return "info";
}

function relationTone(relation: LawyerCaseRelation): "brand" | "neutral" | "info" | "warning" {
  if (relation === "assigned") return "brand";
  if (relation === "owner") return "info";
  if (relation === "limited") return "warning";
  return "neutral";
}

/** The deadline cell: overdue first, then nearest open, else an honest label. */
function DeadlineCell({ row }: { row: LawyerCaseListItem }) {
  if (row.overdueAt) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 text-caption font-medium text-error-700">
          <IconWarning size={13} aria-hidden="true" /> گذشته از مهلت
        </span>
        <span className="text-caption tabular-nums text-muted">{toPersianDate(row.overdueAt)}</span>
      </div>
    );
  }
  if (row.nextDeadlineAt) {
    return (
      <span className="text-caption tabular-nums text-on-surface">
        {toPersianDate(row.nextDeadlineAt)}
      </span>
    );
  }
  return <span className="text-caption text-muted">بدون اقدام زمان‌دار</span>;
}

export default function LawyerCasesPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  // One pill set carries both the lifecycle filter and the overdue toggle:
  // they are mutually exclusive views of the same list, and two separate
  // controls would let the reader set a combination that returns nothing.
  const [pill, setPill] = useState<LifecyclePill>("");
  const [sort, setSort] = useState<NonNullable<LawyerCaseFilters["sort"]>>("deadline");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  // Typing moves only the input; the query changes on a pause.
  useEffect(() => {
    const term = searchInput.trim();
    if (term === search) return;
    const timer = setTimeout(() => setSearch(term), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  // Any narrowing returns to page one, so the reader never lands on a page
  // that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [search, pill, sort, pageSize]);

  const filters: LawyerCaseFilters = {
    lifecycle: pill && pill !== "overdue" ? pill : null,
    search: search || null,
    overdueOnly: pill === "overdue",
    page,
    pageSize,
    sort,
  };

  const query = useLawyerCases(filters);
  const data = query.data;

  return (
    <div>
      <PageHeader
        title="پرونده‌ها"
        description="پرونده‌هایی که به شما ارجاع شده یا در آن‌ها همکاری دارید، با مهلت‌ها و وظایف باز. فیلترها در سرور اعمال می‌شوند."
        icon={<IconBriefcase size={22} />}
      />

      {/* Summary — computed over the whole caseload, not the visible page. */}
      <div className="mb-4 grid gap-3 mobile:grid-cols-2 laptop:grid-cols-4">
        <StatCard
          label="کل پرونده‌ها"
          value={toPersianNumber(data?.summary.total ?? 0)}
          hint={`${toPersianNumber(data?.summary.active ?? 0)} در جریان`}
        />
        <StatCard
          label="در جریان"
          value={toPersianNumber(data?.summary.active ?? 0)}
          hint={`${toPersianNumber(data?.summary.onHold ?? 0)} متوقف`}
        />
        <StatCard
          label="گذشته از مهلت"
          value={toPersianNumber(data?.summary.overdue ?? 0)}
          tone="danger"
          hint="مهلت باز و منقضی"
        />
        <StatCard
          label="با وظیفهٔ باز"
          value={toPersianNumber(data?.summary.withOpenTasks ?? 0)}
          hint="حداقل یک وظیفهٔ ناتمام"
        />
      </div>

      <Card className="mb-4 p-3 tablet:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <SearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder="جستجو: عنوان پرونده، موکل یا دسته…"
                ariaLabel="جستجوی پرونده"
              />
            </div>
            <div className="w-full tablet:w-48">
              <Field label="ترتیب">
                <Select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof sort)}
                  aria-label="ترتیب نمایش پرونده‌ها"
                >
                  <option value="deadline">اولویت مهلت</option>
                  <option value="updated">آخرین تغییر</option>
                  <option value="title">عنوان</option>
                </Select>
              </Field>
            </div>
          </div>

          <FilterPills<LifecyclePill>
            value={pill}
            onChange={setPill}
            options={[
              { value: "", label: "همه" },
              ...LIFECYCLE_KEYS.map((l) => ({ value: l as LifecyclePill, label: CASE_LIFECYCLE_FA[l] })),
              { value: "overdue", label: "گذشته از مهلت" },
            ]}
          />
        </div>
      </Card>

      {query.isLoading ? (
        <LoadingBlock rows={6} />
      ) : query.isError || !data ? (
        <ErrorBlock message="خطا در بارگذاری پرونده‌ها" onRetry={() => query.refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyBlock
          message="پرونده‌ای با این فیلتر یافت نشد."
          hint="با پذیرش یک درخواست، پروندهٔ آن به‌طور خودکار به این فهرست اضافه می‌شود."
        />
      ) : (
        <>
          <DataTable
            minWidth={1000}
            head={
              <tr>
                <Th>پرونده</Th>
                <Th>موکل</Th>
                <Th>نسبت شما</Th>
                <Th>وضعیت</Th>
                <Th>مهلت</Th>
                <Th>کار</Th>
                <Th>آخرین تغییر</Th>
                <Th>عملیات</Th>
              </tr>
            }
          >
            {data.items.map((row) => (
              <tr key={row.caseId} className="hover:bg-surface-hover">
                <Td>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-on-surface">{row.title}</span>
                    <span className="text-caption text-muted">
                      {row.categoryLabelFa}
                      {row.stageLabelFa ? ` · ${row.stageLabelFa}` : ""}
                    </span>
                    <IdChip id={row.caseId} />
                  </div>
                </Td>
                <Td>{row.clientNameFa}</Td>
                <Td>
                  <Badge tone={relationTone(row.relation)}>
                    {LAWYER_CASE_RELATION_FA[row.relation]}
                  </Badge>
                </Td>
                <Td>
                  <Badge tone={lifecycleTone(row.lifecycle)}>{row.lifecycleLabelFa}</Badge>
                </Td>
                <Td>
                  <DeadlineCell row={row} />
                </Td>
                <Td>
                  <div className="flex flex-col gap-0.5 text-caption">
                    <span className="text-on-surface">
                      {toPersianNumber(row.openTasks)} وظیفهٔ باز
                    </span>
                    {row.blockedTasks > 0 && (
                      <span className="text-warning-700">
                        {toPersianNumber(row.blockedTasks)} مسدود
                      </span>
                    )}
                    <span className="text-muted">{toPersianNumber(row.documentCount)} سند</span>
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-caption">{toPersianDate(row.updatedAt)}</Td>
                <Td>
                  <Link
                    href={row.href}
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
            itemLabel="پرونده"
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}
    </div>
  );
}
