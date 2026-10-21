// ============================================================
// LEGALIR — Admin · Organization detail drawer
// ============================================================
// The full dossier for one registered legal entity: identity, registration
// identifiers, contact/address, the owning representative, the real members
// (joined to their user identity) and the authorized signatories.
//
// Every value comes from `GET /admin/organizations/:id`, which projects the
// organization, org_members and org_signatories tables directly — nothing is
// synthesised. A missing field renders «ثبت نشده», never a placeholder value.
//
// A staff member holding admin:users:manage can move the entity through its
// lifecycle here; the server validates the status against the seven values the
// product defines and records actor + before → after in the audit log.
// ============================================================

"use client";

import { useState } from "react";
import { Drawer, snackbar } from "@legalir/ui";
import { useAdminOrganization, useSetAdminOrganizationStatus, useAdminMe } from "@/hooks/useAdmin";
import { ORGANIZATION_STATUS_FA, type OrganizationStatus } from "@legalir/types";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import {
  Badge,
  Button,
  Field,
  IdChip,
  LoadingBlock,
  ErrorBlock,
  Select,
  InfoBanner,
} from "@/components/admin/ui";

/** Lifecycle order — mirrors ADMIN_ORG_STATUSES on the server. */
const STATUS_ORDER: OrganizationStatus[] = [
  "DRAFT",
  "PROFILE_INCOMPLETE",
  "PROFILE_COMPLETE",
  "PENDING_VERIFICATION",
  "ACTIVE",
  "REJECTED",
  "SUSPENDED",
];

const STATUS_TONE: Record<
  OrganizationStatus,
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  DRAFT: "neutral",
  PROFILE_INCOMPLETE: "warning",
  PROFILE_COMPLETE: "info",
  PENDING_VERIFICATION: "info",
  ACTIVE: "success",
  REJECTED: "danger",
  SUSPENDED: "danger",
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-large border border-divider bg-surface p-3">
      <h3 className="mb-2 text-titleSmall font-medium text-on-surface">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-body-2">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-end font-medium text-on-surface">{value || "—"}</span>
    </div>
  );
}

const MEMBER_STATUS_FA: Record<string, string> = {
  active: "فعال",
  invited: "دعوت‌شده",
  suspended: "معلق",
};

export function OrganizationDetailDrawer({
  orgId,
  open,
  onClose,
}: {
  orgId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const query = useAdminOrganization(open ? orgId : null);
  const setStatus = useSetAdminOrganizationStatus();
  const { can } = useAdminMe();
  const canManage = can("admin:users:manage");

  const [draftStatus, setDraftStatus] = useState<OrganizationStatus | "">("");

  const detail = query.data;
  const statusDirty = Boolean(detail && draftStatus !== "" && draftStatus !== detail.status);

  async function saveStatus() {
    if (!detail || !draftStatus) return;
    try {
      await setStatus.mutateAsync({ id: detail.id, status: draftStatus });
      snackbar.show({ message: "وضعیت سازمان به‌روزرسانی شد.", variant: "success" });
      setDraftStatus("");
      void query.refetch();
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "تغییر وضعیت ناموفق بود";
      snackbar.show({ message, variant: "error" });
    }
  }

  return (
    <Drawer open={open} onClose={onClose} position="end" width={560} title="پروندهٔ سازمان">
      {query.isLoading && <LoadingBlock rows={6} />}
      {query.isError && <ErrorBlock onRetry={() => query.refetch()} />}

      {detail && (
        <div className="space-y-4">
          {/* Identity */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-titleLarge text-on-surface">{detail.name}</h2>
              <Badge tone={STATUS_TONE[detail.status]}>{detail.statusFa}</Badge>
              {detail.legalTypeFa && <Badge tone="neutral">{detail.legalTypeFa}</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <IdChip id={detail.id} />
              {detail.tradeName && (
                <span className="text-caption text-muted">نام تجاری: {detail.tradeName}</span>
              )}
            </div>
          </div>

          {/* Registration identifiers */}
          <Block title="شناسه‌های ثبتی">
            <Row
              label="شناسهٔ ملی"
              value={
                detail.nationalId ? (
                  <span dir="ltr" className="tabular-nums">
                    {detail.nationalId}
                  </span>
                ) : (
                  "ثبت نشده"
                )
              }
            />
            <Row
              label="شمارهٔ ثبت"
              value={
                detail.registrationNumber ? (
                  <span dir="ltr" className="tabular-nums">
                    {detail.registrationNumber}
                  </span>
                ) : (
                  "ثبت نشده"
                )
              }
            />
            <Row
              label="کد اقتصادی"
              value={
                detail.economicCode ? (
                  <span dir="ltr" className="tabular-nums">
                    {detail.economicCode}
                  </span>
                ) : (
                  "ثبت نشده"
                )
              }
            />
            <Row
              label="تاریخ ثبت"
              value={detail.registrationDate ? toPersianDate(detail.registrationDate) : "ثبت نشده"}
            />
            <Row label="صنعت" value={detail.industry ?? "ثبت نشده"} />
            <Row label="تاریخ ایجاد پرونده" value={toPersianDate(detail.createdAt)} />
          </Block>

          {/* Contact & address */}
          <Block title="تماس و نشانی">
            <Row
              label="تلفن"
              value={
                detail.phone ? (
                  <span dir="ltr" className="tabular-nums">
                    {detail.phone}
                  </span>
                ) : (
                  "ثبت نشده"
                )
              }
            />
            <Row label="ایمیل" value={detail.email ?? "ثبت نشده"} />
            <Row
              label="وبگاه"
              value={
                detail.website ? (
                  <span dir="ltr">{detail.website}</span>
                ) : (
                  "ثبت نشده"
                )
              }
            />
            <Row
              label="استان / شهر"
              value={
                detail.province || detail.city
                  ? [detail.province, detail.city].filter(Boolean).join(" / ")
                  : "ثبت نشده"
              }
            />
            <Row
              label="کد پستی"
              value={
                detail.postalCode ? (
                  <span dir="ltr" className="tabular-nums">
                    {detail.postalCode}
                  </span>
                ) : (
                  "ثبت نشده"
                )
              }
            />
            <Row label="نشانی" value={detail.address ?? "ثبت نشده"} />
          </Block>

          {/* Owning representative */}
          <Block title="نمایندهٔ دارای دسترسی">
            <Row label="نام" value={detail.ownerNameFa ?? "ثبت نشده"} />
            <Row
              label="موبایل"
              value={
                detail.ownerMobile ? (
                  <span dir="ltr" className="tabular-nums">
                    {detail.ownerMobile}
                  </span>
                ) : (
                  "ثبت نشده"
                )
              }
            />
            <Row label="شناسهٔ کاربر" value={<IdChip id={detail.ownerUserId} />} />
          </Block>

          {/* Members */}
          <Block title={`اعضای سازمان (${toPersianNumber(detail.members.length)})`}>
            {detail.members.length === 0 ? (
              <p className="text-body-2 text-muted">هیچ عضوی برای این سازمان ثبت نشده است.</p>
            ) : (
              <ul className="divide-y divide-divider">
                {detail.members.map((m) => (
                  <li key={m.id} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-on-surface">
                        {m.displayNameFa ?? "بدون نام"}
                      </span>
                      <Badge tone="neutral">{m.roleFa}</Badge>
                      <Badge tone={m.status === "active" ? "success" : "warning"}>
                        {MEMBER_STATUS_FA[m.status] ?? m.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
                      {m.publicId && <IdChip id={m.publicId} />}
                      {m.title && <span>{m.title}</span>}
                      {m.mobile && (
                        <span dir="ltr" className="tabular-nums">
                          {m.mobile}
                        </span>
                      )}
                      <span>عضویت: {m.joinedAt ? toPersianDate(m.joinedAt) : "ثبت نشده"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          {/* Authorized signatories */}
          <Block title={`صاحبان امضای مجاز (${toPersianNumber(detail.signatories.length)})`}>
            {detail.signatories.length === 0 ? (
              <p className="text-body-2 text-muted">
                هیچ صاحب امضایی برای این سازمان ثبت نشده است.
              </p>
            ) : (
              <ul className="divide-y divide-divider">
                {detail.signatories.map((s) => (
                  <li key={s.id} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-on-surface">{s.fullName}</span>
                      {s.position && <Badge tone="neutral">{s.position}</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
                      {s.nationalCode && (
                        <span dir="ltr" className="tabular-nums">
                          کد ملی: {s.nationalCode}
                        </span>
                      )}
                      {s.authorityType && <span>نوع اختیار: {s.authorityType}</span>}
                      {s.phone && (
                        <span dir="ltr" className="tabular-nums">
                          {s.phone}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          {/* Lifecycle status */}
          {canManage ? (
            <Block title="وضعیت سازمان">
              <Field
                label="وضعیت جدید"
                hint="تغییر وضعیت با نام شما و مقدار قبل/بعد در گزارش رویدادها ثبت می‌شود."
              >
                <Select
                  value={draftStatus || detail.status}
                  onChange={(e) => setDraftStatus(e.target.value as OrganizationStatus)}
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {ORGANIZATION_STATUS_FA[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="mt-2 flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!statusDirty || setStatus.isPending}
                  onClick={saveStatus}
                >
                  {setStatus.isPending ? "در حال ذخیره…" : "ذخیرهٔ وضعیت"}
                </Button>
              </div>
            </Block>
          ) : (
            <InfoBanner tone="info">
              برای تغییر وضعیت سازمان، مجوز «مدیریت کاربران» لازم است.
            </InfoBanner>
          )}

          <p className="text-caption leading-relaxed text-muted">
            اطلاعات این پرونده از ثبت سازمان توسط نمایندهٔ آن می‌آید؛ برای مشاهدهٔ رویدادهای مرتبط، از
            فیلتر «شناسهٔ منبع» در بخش رویدادها استفاده کنید.
          </p>
        </div>
      )}
    </Drawer>
  );
}
