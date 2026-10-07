// ============================================================
// LEGALIR — Admin · Lawyers (وکلا)
// ============================================================
// The lawyer review queue. Every lawyer carries an explicit verification
// state; a profile that has merely been *submitted* is never shown as
// verified. A reviewer records a decision (تأیید / رد / تعلیق) together with
// a mandatory reason — the decision, its actor and its timestamp are written
// to the lawyer's history and the platform audit trail server-side.
//
// This queue reads the SAME source of truth the public /lawyers marketplace
// reads, so a decision here is reflected there immediately (no second status).
// ============================================================

"use client";

import { useState } from "react";
import { useAdminLawyers, useAdminMe } from "@/hooks/useAdmin";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import {
  LAWYER_DECISION_BUCKETS,
  LAWYER_DECISION_BUCKET_FA,
  LEGAL_CATEGORY_FA,
  type LawyerDecisionBucket,
} from "@legalir/types";
import {
  PageHeader,
  DataTable,
  Th,
  Td,
  Badge,
  StateView,
  Button,
  IdChip,
  FilterPills,
  InfoBanner,
  TextInput,
  ExportButton,
} from "@/components/admin/ui";
import { LawyerDetailDrawer, BUCKET_TONES } from "@/components/admin/lawyer-detail-drawer";

type BucketFilter = LawyerDecisionBucket | "ALL";

export default function AdminLawyersPage() {
  const { can } = useAdminMe();
  const canReview = can("admin:lawyer:verify");

  const [bucket, setBucket] = useState<BucketFilter>("ALL");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // Debounce the input so the queue re-queries on a pause, not per key.
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const query = useAdminLawyers({
    bucket: bucket === "ALL" ? undefined : bucket,
    search: debouncedSearch || undefined,
  });

  const filters = [
    { value: "ALL" as const, label: "همه" },
    ...LAWYER_DECISION_BUCKETS.map((b) => ({ value: b, label: LAWYER_DECISION_BUCKET_FA[b] })),
  ];

  return (
    <div>
      <PageHeader
        title="وکلا"
        description="صف بررسی وکلای پلتفرم. تصمیم‌های ثبت‌شده روی سایت عمومی LegalIR بازتاب داده می‌شوند."
        actions={<ExportButton kind="lawyers" />}
      />

      {!canReview && (
        <InfoBanner tone="warning">
          شما مجوز بررسی و تأیید وکلا را ندارید؛ این فهرست فقط‌خواندنی است و امکان ثبت تصمیم یا ارسال پیام
          وجود ندارد.
        </InfoBanner>
      )}

      <div className="mb-4 flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
        <FilterPills options={filters} value={bucket} onChange={setBucket} />
        <div className="w-full tablet:w-72">
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو: نام، پروانه، شهر، موبایل…"
            aria-label="جستجوی وکیل"
          />
        </div>
      </div>

      <StateView
        query={query}
        loadingRows={6}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="وکیلی با این فیلتر یافت نشد."
      >
        {(data) => (
          <>
            <DataTable
              head={
                <tr>
                  <Th>نام وکیل</Th>
                  <Th>موبایل</Th>
                  <Th>تخصص</Th>
                  <Th>تاریخ ثبت‌نام</Th>
                  <Th>وضعیت</Th>
                  <Th>آخرین تغییر وضعیت</Th>
                  <Th>تصمیم‌گیرنده</Th>
                  <Th>عملیات</Th>
                </tr>
              }
            >
              {data.items.map((l) => (
                <tr key={l.id} className="hover:bg-surface-hover">
                  <Td>
                    <div className="flex flex-col">
                      <span className="flex items-center gap-2 font-medium text-on-surface">
                        {l.fullName}
                        {l.isDemo && (
                          <Badge tone="neutral" title="پروفایل نمونه / داده توسعه">
                            نمونه
                          </Badge>
                        )}
                      </span>
                      <IdChip id={l.id} />
                    </div>
                  </Td>
                  <Td>
                    <span dir="ltr" className="tabular-nums">
                      {l.mobileMasked}
                    </span>
                  </Td>
                  <Td>
                    {l.specializations.length > 0 ? (
                      <span className="text-caption text-muted">
                        {l.specializations
                          .slice(0, 2)
                          .map((s) => LEGAL_CATEGORY_FA[s.category] ?? s.category)
                          .join("، ")}
                        {l.specializations.length > 2 ? " …" : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{toPersianDate(l.createdAt)}</Td>
                  <Td>
                    <Badge tone={BUCKET_TONES[l.bucket]}>{LAWYER_DECISION_BUCKET_FA[l.bucket]}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {l.lastDecision ? toPersianDate(l.lastDecision.createdAt) : "—"}
                  </Td>
                  <Td>{l.lastDecision ? l.lastDecision.actorName : "—"}</Td>
                  <Td>
                    <Button size="sm" variant="secondary" onClick={() => setOpenId(l.id)}>
                      بررسی
                    </Button>
                  </Td>
                </tr>
              ))}
            </DataTable>

            <div className="mt-3 text-caption text-muted">{toPersianNumber(data.total)} وکیل</div>
          </>
        )}
      </StateView>

      <LawyerDetailDrawer
        lawyerId={openId}
        open={openId !== null}
        onClose={() => setOpenId(null)}
        canReview={canReview}
      />
    </div>
  );
}
