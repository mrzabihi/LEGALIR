// ============================================================
// LEGALIR — Admin · Requests & Cases (درخواست‌ها و پرونده‌ها)
// ============================================================
// Lists legal requests across the platform with their workflow state and
// category. An operator with `admin:requests:manage` opens the per-request
// drawer to assign/change the lawyer and change the status — always through
// the backend's authoritative state machine, and always recorded in both the
// request's own history and the platform audit log. Without that permission
// the surface is purely observational.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminRequests, useAdminMe } from "@/hooks/useAdmin";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { toPersianDate } from "@/lib/persian-utils";
import { LEGAL_REQUEST_STATE_FA, LEGAL_CATEGORY_FA, SLA_HEALTH_FA } from "@legalir/types";
import { lawyerServiceLabel } from "@legalir/types";
import type { SlaHealth } from "@legalir/types";
import {
  PageHeader,
  DataTable,
  Th,
  Td,
  Badge,
  StateView,
  SearchInput,
  Select,
  Button,
  IdChip,
  FilterPills,
  Pagination,
  ExportButton,
} from "@/components/admin/ui";
import { DEFAULT_PAGE_SIZE } from "@/lib/admin/pagination";
import { IconEdit } from "@/lib/icons";
import { RequestDetailDrawer } from "@/components/admin/request-detail-drawer";
import { formatRemaining } from "@/lib/lawyer-portal/sla";

const SLA_TONES: Record<SlaHealth, "neutral" | "success" | "warning" | "danger" | "info"> = {
  ON_TRACK: "success",
  AT_RISK: "warning",
  BREACHED: "danger",
  PAUSED: "info",
  MET: "success",
  MISSED: "warning",
  NONE: "neutral",
};

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

export default function AdminRequestsPage() {
  const { can } = useAdminMe();
  const canManage = can("admin:requests:manage");
  const [search, setSearch] = useState("");
  const [state, setState] = useState<string>("");
  // §8 — oversight filters. Kept as raw form values so the operator can pick
  // a half-filled range without firing a query per keystroke.
  const [lawyerId, setLawyerId] = useState<string>("");
  const [serviceKey, setServiceKey] = useState<string>("");
  const [slaHealth, setSlaHealth] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);

  // Debounce the search box so the list re-queries on a pause, not per key.
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  useEffect(
    () => setPage(1),
    [debouncedSearch, state, lawyerId, serviceKey, slaHealth, fromDate, toDate, pageSize]
  );

  // `date` inputs are day-granular; widen them to inclusive instants so the
  // server's ISO comparison covers the whole chosen day.
  const fromIso = fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : undefined;
  const toIso = toDate ? new Date(`${toDate}T23:59:59.999`).toISOString() : undefined;

  const query = useAdminRequests({
    search: debouncedSearch,
    state: state || undefined,
    lawyerId: lawyerId || undefined,
    serviceKey: serviceKey || undefined,
    slaHealth: (slaHealth || undefined) as SlaHealth | undefined,
    fromIso,
    toIso,
    page,
    pageSize,
  });

  const stateFilters = useMemo(
    () => [
      { value: "", label: "همه" },
      ...Object.entries(LEGAL_REQUEST_STATE_FA).map(([value, label]) => ({ value, label })),
    ],
    []
  );

  // Option vocabularies come from the server's facets so every choice is
  // guaranteed to match at least one row.
  const lawyerOptions = query.data?.facets.lawyers ?? [];
  const serviceOptions = query.data?.facets.services ?? [];
  const hasFilters = Boolean(lawyerId || serviceKey || slaHealth || fromDate || toDate);

  return (
    <div>
      <PageHeader
        title="درخواست‌ها و پرونده‌ها"
        description="فهرست درخواست‌های حقوقی پلتفرم با وضعیت گردش‌کار و دسته‌بندی. با دسترسی مدیریت می‌توانید وکیل را تخصیص/تغییر دهید و وضعیت را — فقط در چارچوب ماشین وضعیت بک‌اند — عوض کنید."
        actions={<ExportButton kind="requests" />}
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="جستجو در عنوان، کاربر یا شناسه"
          className="min-w-[240px] flex-1"
        />
        <FilterPills options={stateFilters} value={state} onChange={setState} />
      </div>

      {/* §8 — lawyer / service / referral window / SLA health. Each select is
          populated from the server's own facets, so no option is dead. */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-caption text-muted">
          وکیل
          <Select
            value={lawyerId}
            onChange={(e) => setLawyerId(e.target.value)}
            aria-label="فیلتر وکیل"
            className="min-w-[180px]"
          >
            <option value="">همه</option>
            {lawyerOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.fullName ?? l.id}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-caption text-muted">
          خدمت
          <Select
            value={serviceKey}
            onChange={(e) => setServiceKey(e.target.value)}
            aria-label="فیلتر خدمت"
            className="min-w-[180px]"
          >
            <option value="">همه</option>
            {serviceOptions.map((k) => (
              <option key={k} value={k}>
                {lawyerServiceLabel(k)}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-caption text-muted">
          وضعیت SLA
          <Select
            value={slaHealth}
            onChange={(e) => setSlaHealth(e.target.value)}
            aria-label="فیلتر وضعیت SLA"
            className="min-w-[160px]"
          >
            <option value="">همه</option>
            {(Object.keys(SLA_HEALTH_FA) as SlaHealth[]).map((h) => (
              <option key={h} value={h}>
                {SLA_HEALTH_FA[h]}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-caption text-muted">
          ارجاع از
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="از تاریخ ارجاع"
            className="h-10 rounded-medium border border-divider bg-surface px-3 text-caption"
          />
        </label>
        <label className="flex flex-col gap-1 text-caption text-muted">
          تا
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="تا تاریخ ارجاع"
            className="h-10 rounded-medium border border-divider bg-surface px-3 text-caption"
          />
        </label>
        {hasFilters && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setLawyerId("");
              setServiceKey("");
              setSlaHealth("");
              setFromDate("");
              setToDate("");
            }}
          >
            پاک‌کردن فیلترها
          </Button>
        )}
      </div>

      <StateView
        query={query}
        loadingRows={6}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="درخواستی با این فیلتر یافت نشد."
      >
        {(data) => (
          <>
            <DataTable
              head={
                <tr>
                  <Th>عنوان</Th>
                  <Th>دسته</Th>
                  <Th>خدمت</Th>
                  <Th>وضعیت</Th>
                  <Th>SLA</Th>
                  <Th>کاربر</Th>
                  <Th>وکیل</Th>
                  <Th>ایجاد</Th>
                  <Th>آخرین تغییر</Th>
                  <Th>عملیات</Th>
                </tr>
              }
            >
              {data.items.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-medium text-on-surface">{r.title || "بدون عنوان"}</span>
                      <IdChip id={r.id} />
                    </div>
                  </Td>
                  <Td>{LEGAL_CATEGORY_FA[r.category] ?? r.category}</Td>
                  <Td className="whitespace-nowrap">
                    {r.serviceKey ? lawyerServiceLabel(r.serviceKey) : "—"}
                  </Td>
                  <Td>
                    <Badge tone={STATE_TONES[r.state] ?? "neutral"}>
                      {LEGAL_REQUEST_STATE_FA[r.state as keyof typeof LEGAL_REQUEST_STATE_FA] ??
                        r.state}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-0.5">
                      <Badge tone={SLA_TONES[r.sla.health]}>{r.sla.healthFa}</Badge>
                      {r.sla.dueAt && (
                        <span className="text-caption text-muted tabular-nums">
                          {r.sla.paused ? "متوقف — " : ""}
                          {formatRemaining(r.sla.remainingMs)}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>{r.userDisplayName ?? "—"}</Td>
                  <Td>
                    {r.selectedLawyerId ? <IdChip id={r.selectedLawyerId} /> : "—"}
                  </Td>
                  <Td className="whitespace-nowrap">{toPersianDate(r.createdAt)}</Td>
                  <Td className="whitespace-nowrap">{toPersianDate(r.updatedAt)}</Td>
                  <Td>
                    <Button
                      size="sm"
                      variant="secondary"
                      startIcon={<IconEdit size={15} />}
                      onClick={() => setOpenId(r.id)}
                    >
                      {canManage ? "مدیریت" : "مشاهده"}
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
      </StateView>

      <RequestDetailDrawer
        requestId={openId}
        canManage={canManage}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
