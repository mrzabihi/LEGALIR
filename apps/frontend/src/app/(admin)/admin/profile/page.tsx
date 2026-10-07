// ============================================================
// LEGALIR — Admin · My Profile (پروفایل من)
// ============================================================
// The staff member's OWN identity. This is the destination the admin header
// user-menu links to (it used to push `/profile`, which only exists under the
// app group and 404'd for an admin session).
//
// Everything here is real: identity + account facts come from the same
// `GET /api/v1/me` the whole app reads, and the access list is the exact
// permission set the server enforces for the caller's role. Department /
// position are NOT part of the platform model, so they are not fabricated —
// the Organization section states plainly that the role is the source of access.
// ============================================================

"use client";

import { useAdminMe } from "@/hooks/useAdmin";
import { ROLE_FA, ROLE_PERMISSIONS, type Permission } from "@legalir/types";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import {
  PERMISSION_FA,
  PERMISSION_META,
  PERMISSION_GROUP_ORDER,
} from "@/lib/admin/permission-catalog";
import {
  PageHeader,
  Section,
  Card,
  Badge,
  StateView,
  ErrorBlock,
  IdChip,
} from "@/components/admin/ui";
import { IconPerson, IconShieldCheck, IconEmail, IconPhone } from "@/lib/icons";

const ACCOUNT_TYPE_FA: Record<string, string> = {
  PERSONAL: "شخصی",
  LAWYER: "وکیل",
  BUSINESS: "سازمانی",
  individual: "شخصی",
  legal: "حقوقی",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-divider py-2.5 text-body-2 last:border-0">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-end font-medium text-on-surface">{value || "—"}</span>
    </div>
  );
}

/** The caller's granted permissions, grouped by domain — the "access level". */
function AccessList({ permissions }: { permissions: Permission[] }) {
  const groups = PERMISSION_GROUP_ORDER.map(({ group, labelFa }) => ({
    labelFa,
    items: permissions.filter((p) => PERMISSION_META[p].group === group),
  })).filter((g) => g.items.length > 0);

  if (groups.length === 0) {
    return <p className="text-body-2 text-muted">این نقش هیچ مجوزی ندارد.</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.labelFa}>
          <p className="mb-1.5 text-caption font-semibold text-on-surface-variant">{g.labelFa}</p>
          <ul className="grid gap-1.5 tablet:grid-cols-2">
            {g.items.map((p) => (
              <li key={p} className="flex items-center gap-1.5 text-body-2 text-on-surface-variant">
                <IconShieldCheck size={15} className="shrink-0 text-success-600" aria-hidden="true" />
                <span>{PERMISSION_FA[p]}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function AdminProfilePage() {
  const me = useAdminMe();
  const data = me.data;
  const role = me.role;

  const displayName = data?.profile?.displayName ?? data?.user?.mobileDisplay ?? "کاربر";
  const initial = displayName.trim().charAt(0) || "ک";
  const permissions: Permission[] = role ? [...(ROLE_PERMISSIONS[role] ?? [])] : [];

  return (
    <div>
      <PageHeader
        icon={<IconPerson size={22} />}
        title="پروفایل من"
        description="اطلاعات حساب، نقش سیستمی و سطح دسترسی شما در پنل مدیریت."
      />

      <StateView query={me} loadingRows={4} isEmpty={() => false}>
        {() => (
          <>
            {/* Identity */}
            <Section title="اطلاعات حساب">
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-h3 font-bold text-on-primary">
                    {initial}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-titleLarge font-bold text-on-surface">{displayName}</h2>
                      {role && <Badge tone="brand">{ROLE_FA[role] ?? role}</Badge>}
                      <Badge tone="success" dot>
                        فعال
                      </Badge>
                    </div>
                    <div className="mt-1">
                      <IdChip id={data?.user.id ?? ""} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-x-6 tablet:grid-cols-2">
                  <Row
                    label="شماره موبایل"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <IconPhone size={14} className="text-outline" aria-hidden="true" />
                        <span dir="ltr" className="tabular-nums">
                          {data?.user.mobileDisplay}
                        </span>
                      </span>
                    }
                  />
                  <Row
                    label="ایمیل"
                    value={
                      data?.profile.email ? (
                        <span className="inline-flex items-center gap-1.5">
                          <IconEmail size={14} className="text-outline" aria-hidden="true" />
                          <span dir="ltr">{data.profile.email}</span>
                        </span>
                      ) : (
                        "ثبت نشده"
                      )
                    }
                  />
                  <Row
                    label="نوع حساب"
                    value={
                      ACCOUNT_TYPE_FA[data?.user.platformAccountType ?? ""] ??
                      ACCOUNT_TYPE_FA[data?.user.accountType ?? ""] ??
                      "—"
                    }
                  />
                  <Row
                    label="تاریخ عضویت"
                    value={data?.user.createdAt ? toPersianDate(data.user.createdAt) : "—"}
                  />
                </div>
              </Card>
            </Section>

            {/* Organization */}
            <Section
              title="سازمان و نقش"
              subtitle="نقش سیستمی، مبنای اصلی سطح دسترسی در پلتفرم است."
            >
              <Card className="p-4">
                <Row label="نقش سیستمی" value={role ? (ROLE_FA[role] ?? role) : "—"} />
                <Row
                  label="شناسهٔ سازمان"
                  value={
                    data?.user.orgId ? (
                      <span dir="ltr" className="font-mono text-caption">
                        {data.user.orgId}
                      </span>
                    ) : (
                      "وابسته به سازمان نیست"
                    )
                  }
                />
                <Row label="وضعیت حساب" value="فعال" />
                <p className="mt-3 text-caption leading-relaxed text-muted">
                  در این پلتفرم سطح دسترسی از طریق «نقش» تعیین می‌شود؛ سمت یا واحد سازمانی جداگانه
                  نگهداری نمی‌شود. برای تغییر نقش یا مجوزها با مدیر ارشد پلتفرم هماهنگ کنید.
                </p>
              </Card>
            </Section>

            {/* Access level */}
            <Section
              title="سطح دسترسی"
              subtitle="مجوزهای واقعی که سرور برای نقش شما اعمال می‌کند."
              actions={<Badge tone="info">{toPersianNumber(permissions.length)} مجوز</Badge>}
            >
              <Card className="p-4">
                <AccessList permissions={permissions} />
              </Card>
            </Section>
          </>
        )}
      </StateView>

      {me.isError && (
        <ErrorBlock onRetry={() => me.refetch()} message="دریافت پروفایل ناموفق بود" />
      )}
    </div>
  );
}
