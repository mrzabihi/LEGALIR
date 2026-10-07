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
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import { LEGAL_REQUEST_STATE_FA, LEGAL_CATEGORY_FA } from "@legalir/types";
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
  ExportButton,
} from "@/components/admin/ui";
import { IconSearch, IconEdit } from "@/lib/icons";
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
  const [openId, setOpenId] = useState<string | null>(null);

  // Debounce the search box so the list re-queries on a pause, not per key.
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  useEffect(() => setPage(1), [debouncedSearch]);

  const query = useAdminRequests({
    search: debouncedSearch,
    state: state || undefined,
    page,
    pageSize: 25,
  });

  const totalPages = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize))
    : 1;

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
        <div className="relative min-w-[240px] flex-1">
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted">
            <IconSearch size={16} />
          </span>
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو در عنوان یا شناسه"
            className="ps-9"
          />
        </div>
        <FilterPills
          options={stateFilters}
          value={state}
          onChange={(v) => {
            setState(v);
            setPage(1);
          }}
        />
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

            <div className="mt-3 flex items-center justify-between text-caption text-muted">
              <span>{toPersianNumber(data.total)} درخواست</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={data.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  قبلی
                </Button>
                <span className="tabular-nums">
                  {toPersianNumber(data.page)} / {toPersianNumber(totalPages)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={data.page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  بعدی
                </Button>
              </div>
            </div>
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
