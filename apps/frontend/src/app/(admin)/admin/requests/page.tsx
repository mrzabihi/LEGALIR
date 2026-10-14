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
  ExportButton,
} from "@/components/admin/ui";
import { DEFAULT_PAGE_SIZE } from "@/lib/admin/pagination";
import { IconEdit } from "@/lib/icons";
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

export default function AdminRequestsPage() {
  const { can } = useAdminMe();
  const canManage = can("admin:requests:manage");
  const [search, setSearch] = useState("");
  const [state, setState] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);

  // Debounce the search box so the list re-queries on a pause, not per key.
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  useEffect(() => setPage(1), [debouncedSearch, state, pageSize]);

  const query = useAdminRequests({
    search: debouncedSearch,
    state: state || undefined,
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

  return (
    <div>
      <PageHeader
        title="درخواست‌ها و پرونده‌ها"
        description="فهرست درخواست‌های حقوقی پلتفرم با وضعیت گردش‌کار و دسته‌بندی. با دسترسی مدیریت می‌توانید وکیل را تخصیص/تغییر دهید و وضعیت را — فقط در چارچوب ماشین وضعیت بک‌اند — عوض کنید."
        actions={<ExportButton kind="requests" />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="جستجو در عنوان، کاربر یا شناسه"
          className="min-w-[240px] flex-1"
        />
        <FilterPills options={stateFilters} value={state} onChange={setState} />
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
                  <Th>وضعیت</Th>
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
                  <Td>
                    <Badge tone={STATE_TONES[r.state] ?? "neutral"}>
                      {LEGAL_REQUEST_STATE_FA[r.state as keyof typeof LEGAL_REQUEST_STATE_FA] ??
                        r.state}
                    </Badge>
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
