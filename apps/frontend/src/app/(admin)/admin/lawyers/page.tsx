// ============================================================
// LEGALIR — Admin · Lawyers (وکلا)  ·  management table
// ============================================================
// The full lawyer management surface. Beyond the review decision it shows
// everything an operator needs at a glance — avatar, professional rank,
// issuing organisation, primary specialty, cities, years of experience,
// displayed rating + review count, verification bucket, operator lifecycle
// (فعال/غیرفعال/معلق/حذف‌شده), the featured flag and the last update time —
// with search and a lifecycle filter, quick feature/moderate actions, and a
// detail drawer for the full edit.
//
// This table reads the SAME source of truth the public /lawyers marketplace
// reads, so any change here (edit, status, avatar, rating, review, featured)
// is reflected there immediately — there is no second copy.
// ============================================================

"use client";

import { useState } from "react";
import { snackbar } from "@legalir/ui";
import {
  useAdminLawyers,
  useAdminMe,
  useSetAdminLawyerFeatured,
} from "@/hooks/useAdmin";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import {
  LAWYER_DECISION_BUCKET_FA,
  ADMIN_LAWYER_STATUS_FA,
  LAWYER_PROFESSIONAL_RANK_SHORT_FA,
  type AdminLawyerStatus,
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
import { LawyerAvatar } from "@/components/lawyers";
import { LawyerDetailDrawer, BUCKET_TONES } from "@/components/admin/lawyer-detail-drawer";
import { specialtyLabel } from "@/lib/lawyers/specialty";

type LifecycleFilter = AdminLawyerStatus | "ALL";

const LIFECYCLE_TONES: Record<
  AdminLawyerStatus,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  SUSPENDED: "danger",
  DELETED: "danger",
};

export default function AdminLawyersPage() {
  const { can } = useAdminMe();
  const canReview = can("admin:lawyer:verify");
  const canFeature = can("admin:lawyer:feature");

  const [lifecycle, setLifecycle] = useState<LifecycleFilter>("ALL");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // Debounce the input so the queue re-queries on a pause, not per key.
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const query = useAdminLawyers({
    lifecycle: lifecycle === "ALL" ? undefined : lifecycle,
    search: debouncedSearch || undefined,
  });
  const feature = useSetAdminLawyerFeatured();

  const filters = [
    { value: "ALL" as const, label: "همه" },
    ...(["ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"] as AdminLawyerStatus[]).map((s) => ({
      value: s,
      label: ADMIN_LAWYER_STATUS_FA[s],
    })),
  ];

  async function toggleFeatured(id: string, next: boolean) {
    try {
      await feature.mutateAsync({ id, featured: next });
      snackbar.show({
        message: next ? "وکیل در بخش پیشنهادی برجسته شد." : "برجسته‌سازی لغو شد.",
        variant: "success",
      });
    } catch {
      snackbar.show({ message: "تغییر برجسته‌سازی ناموفق بود", variant: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title="وکلا"
        description="مدیریت کامل وکلای پلتفرم. هر تغییر (ویرایش، وضعیت، آواتار، امتیاز، نظر، برجسته‌سازی) بلافاصله در سایت عمومی LegalIR بازتاب داده می‌شود."
        actions={<ExportButton kind="lawyers" />}
      />

      {!canReview && (
        <InfoBanner tone="warning">
          شما مجوز بررسی و تأیید وکلا را ندارید؛ این فهرست فقط‌خواندنی است و امکان ثبت تصمیم وجود ندارد.
        </InfoBanner>
      )}

      <div className="mb-4 flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
        <FilterPills options={filters} value={lifecycle} onChange={setLifecycle} />
        <div className="w-full tablet:w-72">
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو: نام، پروانه، تخصص، شهر، موبایل…"
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
                  <Th>وکیل</Th>
                  <Th>پایه / سازمان</Th>
                  <Th>تخصص اصلی</Th>
                  <Th>شهر</Th>
                  <Th>سابقه</Th>
                  <Th>امتیاز</Th>
                  <Th>نظرات</Th>
                  <Th>تأیید</Th>
                  <Th>وضعیت</Th>
                  <Th>برجسته</Th>
                  <Th>آخرین بروزرسانی</Th>
                  <Th>عملیات</Th>
                </tr>
              }
            >
              {data.items.map((l) => {
                const otherCount = Math.max(0, l.specializations.length - 1);
                return (
                  <tr key={l.id} className="hover:bg-surface-hover">
                    <Td>
                      <div className="flex items-center gap-3">
                        <LawyerAvatar
                          name={l.fullName}
                          avatarUrl={l.avatarUrl}
                          avatarType={l.avatarType}
                          size={40}
                        />
                        <div className="flex min-w-0 flex-col">
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
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-caption text-on-surface-variant">
                          {l.professionalRank
                            ? LAWYER_PROFESSIONAL_RANK_SHORT_FA[l.professionalRank]
                            : "—"}
                        </span>
                        <span dir="ltr" className="text-caption text-muted tabular-nums">
                          {l.licenseNumber ?? "—"}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <span className="text-caption text-on-surface-variant">
                        {l.primarySpecialtyId ? specialtyLabel(l.primarySpecialtyId) : "—"}
                        {otherCount > 0 ? (
                          <span className="text-muted"> +{toPersianNumber(otherCount)}</span>
                        ) : null}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-caption text-on-surface-variant">
                      {l.cities || "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-caption">
                      {l.yearsExperience != null ? `${toPersianNumber(l.yearsExperience)} سال` : "—"}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      {l.displayRating != null
                        ? toPersianNumber(Number(l.displayRating.toFixed(1)))
                        : "—"}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      {toPersianNumber(l.displayReviewCount)}
                    </Td>
                    <Td>
                      <Badge tone={BUCKET_TONES[l.bucket]}>{LAWYER_DECISION_BUCKET_FA[l.bucket]}</Badge>
                    </Td>
                    <Td>
                      <Badge tone={LIFECYCLE_TONES[l.lifecycle]} dot>
                        {ADMIN_LAWYER_STATUS_FA[l.lifecycle]}
                      </Badge>
                    </Td>
                    <Td>
                      {l.featured ? (
                        <Badge tone="brand">برجسته</Badge>
                      ) : (
                        <span className="text-caption text-muted">—</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-caption text-muted">
                      {toPersianDate(l.updatedAt)}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setOpenId(l.id)}>
                          مدیریت
                        </Button>
                        {canFeature && (
                          <Button
                            size="sm"
                            variant={l.featured ? "tonal" : "ghost"}
                            title={l.featured ? "لغو برجسته‌سازی" : "برجسته‌سازی"}
                            disabled={feature.isPending}
                            onClick={() => toggleFeatured(l.id, !l.featured)}
                          >
                            {l.featured ? "لغو" : "برجسته"}
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
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
