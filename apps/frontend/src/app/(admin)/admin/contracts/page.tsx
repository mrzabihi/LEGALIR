// ============================================================
// LEGALIR — Admin · Contracts review queue (قراردادها و بررسی حقوقی)
// ============================================================
// §6/§7: the platform-side queue over every generated contract. The rows are
// DERIVED from the real contract state — the approval badge is true only when
// the CURRENT version still carries a valid, bound admin approval, so a
// contract whose content changed after approval shows as un-approved again.
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
import type { ContractAdminReviewStatus } from "@legalir/types";
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
} from "@/components/admin/ui";
import { DEFAULT_PAGE_SIZE } from "@/lib/admin/pagination";
import { IconSearch, IconEdit, IconCheckCircle } from "@/lib/icons";
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

/** §2.4 — the tone each signature-request status carries in the queue. */
const SIGNATURE_TONES: Record<
  string,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  DRAFT: "neutral",
  SENT: "info",
  PARTIALLY_SIGNED: "warning",
  COMPLETED: "success",
  DECLINED: "danger",
  EXPIRED: "warning",
  CANCELLED: "neutral",
};

export default function AdminContractsPage() {
  const { can } = useAdminMe();
  const canReview = can("admin:contracts:review");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  useEffect(() => setPage(1), [debouncedSearch, status, pageSize]);

  const query = useAdminContracts({
    search: debouncedSearch,
    status: status ? (status as ContractAdminReviewStatus) : undefined,
    page,
    pageSize,
  });

  const counts = query.data?.counts;

  const statusFilters = useMemo(
    () => [
      { value: "", label: "همه" },
      ...REVIEW_STATUSES.map((s) => ({ value: s, label: CONTRACT_ADMIN_REVIEW_STATUS_FA[s] })),
    ],
    []
  );

  return (
    <div>
      <PageHeader
        title="قراردادها و بررسی حقوقی"
        description="صف بررسی قراردادهای تولیدشده. پیش از صدور نسخهٔ نهایی یا آماده‌سازی امضا، هر قرارداد باید از این صف تأیید بگذرد. تأیید به اثر انگشت نسخه گره می‌خورد و پس از هر تغییر محتوا باطل می‌شود."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted">
            <IconSearch size={16} />
          </span>
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو در کد پیگیری، عنوان، مالک یا طرفین"
            className="ps-9"
          />
        </div>
        <FilterPills options={statusFilters} value={status} onChange={(v) => setStatus(v)} />
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
        emptyMessage="قراردادی با این فیلتر یافت نشد."
      >
        {(data) => (
          <>
            <DataTable
              head={
                <tr>
                  <Th>کد پیگیری</Th>
                  <Th>نوع</Th>
                  <Th>وضعیت بررسی</Th>
                  <Th>وضعیت قرارداد</Th>
                  <Th>مالک / طرفین</Th>
                  <Th>نسخه</Th>
                  <Th>وضعیت امضا</Th>
                  <Th>آخرین تغییر</Th>
                  <Th>عملیات</Th>
                </tr>
              }
            >
              {data.items.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-medium text-on-surface">{c.referenceCode}</span>
                      {c.isSample && <Badge tone="warning">نمونه آزمایشی</Badge>}
                      <IdChip id={c.id} />
                    </div>
                  </Td>
                  <Td>{c.typeFa}</Td>
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
                  <Td>
                    <div className="flex flex-col">
                      <span className="text-on-surface-variant">{c.ownerLabelFa}</span>
                      <span className="text-caption text-muted">{c.partySummaryFa}</span>
                    </div>
                  </Td>
                  <Td className="tabular-nums">
                    {c.currentVersionNumber > 0
                      ? `نسخه ${toPersianNumber(c.currentVersionNumber)}`
                      : "—"}
                  </Td>
                  <Td>
                    {/* §2.4 — signing progress is visible from the queue, not
                        only inside the drawer. */}
                    {c.signatureStatus ? (
                      <div className="flex flex-col gap-0.5">
                        <Badge tone={SIGNATURE_TONES[c.signatureStatus] ?? "neutral"}>
                          {c.signatureStatusFa ?? c.signatureStatus}
                        </Badge>
                        <span className="text-caption text-muted tabular-nums">
                          {toPersianNumber(c.signedCount)} از{" "}
                          {toPersianNumber(c.participantCount)} طرف
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{toPersianDate(c.updatedAt)}</Td>
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
