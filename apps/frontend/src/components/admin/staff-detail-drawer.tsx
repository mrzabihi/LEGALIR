// ============================================================
// LEGALIR — Admin · Staff detail drawer
// ============================================================
// The full dossier for one staff member: identity, organization, the exact
// permission set their role grants, and the truthful activity timestamps.
// Nothing is fabricated — every value comes from `GET /admin/staff/:id`,
// which reads the user row, the role map and the session table directly.
//
// A super-admin (admin:staff:manage) can reassign the role from here; the
// server re-checks the permission and refuses to demote the last role manager.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { Drawer, snackbar } from "@legalir/ui";
import { useAdminStaffMember, useChangeStaffRole, useAdminMe } from "@/hooks/useAdmin";
import { ROLE_FA, STAFF_ROLES, type PlatformRole } from "@legalir/types";
import { toPersianDate, toRelativeTime, toPersianNumber } from "@/lib/persian-utils";
import {
  PERMISSION_FA,
  PERMISSION_META,
  PERMISSION_GROUP_ORDER,
} from "@/lib/admin/permission-catalog";
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

const ASSIGNABLE_ROLES: PlatformRole[] = [
  "USER",
  "LAWYER",
  "COMPANY_OWNER",
  "COMPANY_ADMIN",
  "COMPANY_MEMBER",
  ...STAFF_ROLES,
];

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

export function StaffDetailDrawer({
  staffId,
  open,
  onClose,
}: {
  staffId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const query = useAdminStaffMember(open ? staffId : null);
  const changeRole = useChangeStaffRole();
  const { can, data: me } = useAdminMe();
  const canManage = can("admin:staff:manage");

  const [role, setRole] = useState<PlatformRole | "">("");

  // Reset the draft role whenever a different member is opened.
  useEffect(() => {
    setRole("");
  }, [staffId]);

  const detail = query.data;
  const isSelf = detail?.id === me?.user.id;
  const roleDirty = detail ? role !== "" && role !== detail.role : false;

  async function saveRole() {
    if (!detail || !role) return;
    try {
      await changeRole.mutateAsync({ userId: detail.id, role: role as PlatformRole });
      snackbar.show({ message: "نقش کارمند به‌روزرسانی شد.", variant: "success" });
      setRole("");
      void query.refetch();
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "تغییر نقش ناموفق بود";
      snackbar.show({ message, variant: "error" });
    }
  }

  const groups = detail
    ? PERMISSION_GROUP_ORDER.map(({ group, labelFa }) => ({
        labelFa,
        items: detail.permissions.filter((p) => PERMISSION_META[p].group === group),
      })).filter((g) => g.items.length > 0)
    : [];

  return (
    <Drawer open={open} onClose={onClose} position="end" width={520} title="پروندهٔ کارمند">
      {query.isLoading && <LoadingBlock rows={6} />}
      {query.isError && <ErrorBlock onRetry={() => query.refetch()} />}

      {detail && (
        <div className="space-y-4">
          {/* Identity */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-titleLarge text-on-surface">{detail.displayName ?? "بدون نام"}</h2>
              <Badge tone="brand">{detail.roleFa}</Badge>
              {detail.isSuperAdmin && <Badge tone="info">مدیر ارشد</Badge>}
              {isSelf && <Badge tone="neutral">خودتان</Badge>}
            </div>
            <div className="mt-1">
              <IdChip id={detail.id} />
            </div>
          </div>

          {/* Personal / contact */}
          <Block title="اطلاعات فردی و تماس">
            <Row label="نام نمایشی" value={detail.displayName ?? "بدون نام"} />
            <Row
              label="شماره موبایل"
              value={
                <span dir="ltr" className="tabular-nums">
                  {detail.mobileMasked}
                </span>
              }
            />
            <Row label="ایمیل" value={detail.email ?? "ثبت نشده"} />
          </Block>

          {/* Organization + role */}
          <Block title="سازمان و نقش">
            <Row label="نقش فعلی" value={detail.roleFa} />
            <Row
              label="سازمان"
              value={detail.orgName ?? detail.orgId ?? "وابسته به سازمان نیست"}
            />
            <Row label="تاریخ عضویت" value={toPersianDate(detail.createdAt)} />
            <Row
              label="آخرین فعالیت"
              value={detail.lastActiveAt ? toRelativeTime(detail.lastActiveAt) : "بدون سابقه"}
            />
          </Block>

          {/* Role assignment */}
          {canManage && (
            <Block title="تخصیص نقش">
              {isSelf && (
                <div className="mb-2">
                  <InfoBanner tone="warning">
                    تغییر نقش حساب خودتان ممکن است دسترسی شما را محدود کند.
                  </InfoBanner>
                </div>
              )}
              <Field
                label="نقش جدید"
                hint="مدیر ارشدی که تنها دارندهٔ مجوز مدیریت کارکنان است قابل تنزل نیست."
              >
                <Select
                  value={role || detail.role}
                  onChange={(e) => setRole(e.target.value as PlatformRole)}
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_FA[r] ?? r}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="mt-2 flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!roleDirty || changeRole.isPending}
                  onClick={saveRole}
                >
                  {changeRole.isPending ? "در حال ذخیره…" : "ذخیرهٔ نقش"}
                </Button>
              </div>
            </Block>
          )}

          {/* Access control */}
          <Block title={`سطح دسترسی (${toPersianNumber(detail.permissions.length)} مجوز)`}>
            {groups.length === 0 ? (
              <p className="text-body-2 text-muted">این نقش مجوزی ندارد.</p>
            ) : (
              <div className="space-y-3">
                {groups.map((g) => (
                  <div key={g.labelFa}>
                    <p className="mb-1 text-caption font-semibold text-on-surface-variant">
                      {g.labelFa}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {g.items.map((p) => (
                        <span
                          key={p}
                          className="rounded-full border border-divider px-2 py-0.5 text-caption text-on-surface-variant"
                        >
                          {PERMISSION_FA[p]}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Block>

          <p className="text-caption leading-relaxed text-muted">
            برای مشاهدهٔ رویدادهای امنیتی این کارمند، از فیلتر «شناسهٔ کنشگر» در بخش رویدادهای
            پایین صفحهٔ کارکنان استفاده کنید.
          </p>
        </div>
      )}
    </Drawer>
  );
}
