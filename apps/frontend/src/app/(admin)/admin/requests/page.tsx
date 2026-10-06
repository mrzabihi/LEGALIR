// ============================================================
// LEGALIR — Admin · Requests & Cases (درخواست‌ها و پرونده‌ها)
// ============================================================
// Lists legal requests across the platform with their workflow state and
// category. Read-only on this surface: state transitions are performed by
// the owning user or lawyer through the request APIs, never by an admin;
// admins observe here and act through support/audit when a dispute arises.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { useAdminRequests } from "@/hooks/useAdmin";
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
} from "@/components/admin/ui";
import { IconSearch } from "@/lib/icons";

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
  const [search, setSearch] = useState("");
  const [state, setState] = useState<string>("");
  const [page, setPage] = useState(1);

  const query = useAdminRequests({ search, state: state || undefined, page, pageSize: 25 });

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
        description="فهرست درخواست‌های حقوقی پلتفرم با وضعیت گردش‌کار و دسته‌بندی. این نمایش فقط‌خواندنی است؛ تغییر وضعیت توسط کاربر یا وکیل انجام می‌شود."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted">
            <IconSearch size={16} />
          </span>
          <TextInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
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
    </div>
  );
}
