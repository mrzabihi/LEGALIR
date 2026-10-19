// ============================================================
// LEGALIR — Admin · Judicial review queue (صف بررسی اوراق قضایی)
// ============================================================
// The triage table over every submitted judicial draft. Rows are the
// server's projection (`GET /admin/judicial/reviews`): labels, owner and
// counters only — a draft body is never shipped to the list.
//
// Counts are computed by the server over the UNFILTERED set, so the tabs
// carry stable numbers; switching a tab reads that slice. Opening a row
// gives the reviewer the workspace (drawer) where the single decision is
// recorded.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  JUDICIAL_REVIEW_KIND_FA,
  JUDICIAL_REVIEW_STATUS_FA,
  type JudicialReviewKind,
  type JudicialReviewStatus,
} from "@legalir/types";
import { useAdminJudicialReviews, useAdminMe } from "@/hooks/useAdmin";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import {
  Badge,
  Button,
  DataTable,
  FilterPills,
  IdChip,
  SearchInput,
  Select,
  StateView,
  Tabs,
  Td,
  Th,
  type TabItem,
} from "@/components/admin/ui";
import { IconEdit } from "@/lib/icons";
import { JudicialReviewDrawer } from "./judicial-review-drawer";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const STATUS_TONE: Record<JudicialReviewStatus, Tone> = {
  pending: "warning",
  in_progress: "info",
  waiting_user: "warning",
  changes_requested: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
};

type StatusTab = "open" | "closed" | "all";

export function JudicialReviewQueue() {
  const { can } = useAdminMe();
  const canReview = can("admin:judicial:review");

  const [tab, setTab] = useState<StatusTab>("open");
  const [kind, setKind] = useState<JudicialReviewKind | "all">("all");
  const [status, setStatus] = useState<JudicialReviewStatus | "">("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  // An exact status is only meaningful inside its group; switching the tab
  // clears it so the result can never be silently empty.
  useEffect(() => setStatus(""), [tab]);

  const query = useAdminJudicialReviews({
    status: status || tab,
    kind,
    q: debouncedSearch || undefined,
  });

  const counts = query.data?.counts;

  const tabs: TabItem<StatusTab>[] = useMemo(
    () => [
      { value: "open", label: "باز", badge: counts ? toPersianNumber(counts.open) : undefined },
      {
        value: "closed",
        label: "بسته‌شده",
        badge: counts ? toPersianNumber(counts.closed) : undefined,
      },
      { value: "all", label: "همه", badge: counts ? toPersianNumber(counts.all) : undefined },
    ],
    [counts]
  );

  const kindFilters = useMemo(
    () => [
      { value: "all", label: "همه" },
      { value: "legalir", label: JUDICIAL_REVIEW_KIND_FA.legalir },
      { value: "lawyer", label: JUDICIAL_REVIEW_KIND_FA.lawyer },
    ],
    []
  );

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-title-3 font-bold text-on-surface">صف بررسی اوراق قضایی</h2>
        <p className="mt-1 max-w-3xl text-body-2 text-muted">
          هر متن ارسال‌شده پیش از صدور نسخهٔ نهایی باید از این صف بگذرد. تأیید به نسخهٔ
          ارسال‌شده گره می‌خورد و همان لحظه نسخهٔ نهایی را صادر می‌کند؛ یادداشت‌های داخلی
          هرگز به کاربر نمایش داده نمی‌شوند.
        </p>
      </div>

      {counts && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted">
          <span>در انتظار بررسی: {toPersianNumber(counts.byStatus.pending)}</span>
          <span>در حال بررسی: {toPersianNumber(counts.byStatus.in_progress)}</span>
          <span>نیازمند اصلاح: {toPersianNumber(counts.byStatus.changes_requested)}</span>
          <span>تأییدشده: {toPersianNumber(counts.byStatus.approved)}</span>
        </div>
      )}

      <Tabs items={tabs} value={tab} onChange={setTab} ariaLabel="گروه وضعیت بررسی" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[240px] flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="جستجو در عنوان، کاربر، خدمت یا شناسه"
            ariaLabel="جستجو در صف بررسی"
          />
        </div>
        <FilterPills
          options={kindFilters}
          value={kind}
          onChange={(v) => setKind(v as JudicialReviewKind | "all")}
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as JudicialReviewStatus | "")}
          aria-label="وضعیت دقیق"
          className="w-44"
        >
          <option value="">همهٔ وضعیت‌ها</option>
          {(Object.keys(JUDICIAL_REVIEW_STATUS_FA) as JudicialReviewStatus[]).map((s) => (
            <option key={s} value={s}>
              {JUDICIAL_REVIEW_STATUS_FA[s]}
            </option>
          ))}
        </Select>
      </div>

      <StateView
        query={query}
        loadingRows={6}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="درخواست بررسی‌ای با این فیلتر وجود ندارد."
      >
        {(data) => (
          <DataTable
            head={
              <tr>
                <Th>پرونده</Th>
                <Th>خدمت</Th>
                <Th>نوع بررسی</Th>
                <Th>کاربر</Th>
                <Th>وضعیت بررسی</Th>
                <Th>نسخه</Th>
                <Th>کارشناس</Th>
                <Th>آخرین تغییر</Th>
                <Th>اقدام</Th>
              </tr>
            }
          >
            {data.items.map((row) => (
              <tr key={row.id}>
                <Td>
                  <div className="flex min-w-[180px] flex-col">
                    <span className="font-medium text-on-surface">{row.titleFa}</span>
                    <span className="text-caption text-muted">
                      وضعیت پرونده: {row.requestStatusFa}
                    </span>
                    <IdChip id={row.requestId} />
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-col">
                    <span>{row.serviceFa}</span>
                    {row.documentTypeFa && (
                      <span className="text-caption text-muted">{row.documentTypeFa}</span>
                    )}
                  </div>
                </Td>
                <Td>{row.kindFa}</Td>
                <Td>
                  <div className="flex flex-col">
                    <span>{row.owner.labelFa}</span>
                    {row.owner.mobile && (
                      // Operators see the full contact, LTR (users panel rule).
                      <span className="font-mono text-caption text-muted" dir="ltr">
                        {row.owner.mobile}
                      </span>
                    )}
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-col items-start gap-1">
                    <Badge tone={STATUS_TONE[row.status]} dot>
                      {row.statusFa}
                    </Badge>
                    {row.hasFinalDocument && <Badge tone="success">نسخهٔ نهایی صادر شده</Badge>}
                  </div>
                </Td>
                <Td className="tabular-nums">{toPersianNumber(row.submittedVersionNumber)}</Td>
                <Td className="text-caption">
                  {row.assignedToLabelFa ?? <span className="text-muted">تخصیص‌نشده</span>}
                </Td>
                <Td className="whitespace-nowrap">{toPersianDate(row.updatedAt)}</Td>
                <Td>
                  <Button
                    size="sm"
                    variant="secondary"
                    startIcon={<IconEdit size={15} />}
                    onClick={() => setOpenId(row.id)}
                  >
                    {canReview && row.open ? "بررسی" : "مشاهده"}
                  </Button>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </StateView>

      <JudicialReviewDrawer
        reviewId={openId}
        canReview={canReview}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
