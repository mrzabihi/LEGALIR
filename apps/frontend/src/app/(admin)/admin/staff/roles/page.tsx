// ============================================================
// LEGALIR — Admin · Roles (نقش‌ها و ماتریس دسترسی)
// ============================================================
// The role → permission matrix, straight from the shared `ROLE_PERMISSIONS`
// map the server authorizes against. Pick a role on the left; the grouped
// permission set appears on the right.
//
// Roles in this platform are code-defined (a role is a key in the shared map,
// not a database row), so this surface is intentionally read-only — editing a
// role is a code change and would not change what the server enforces. The
// "role composer" below is a real, useful preview: it lets an admin see what a
// hand-picked permission set would grant, and which existing role it matches.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { useAdminRoles, useAdminMe } from "@/hooks/useAdmin";
import { ROLE_FA, ROLE_PERMISSIONS, type PlatformRole, type Permission } from "@legalir/types";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  PERMISSION_FA,
  PERMISSION_META,
  PERMISSION_GROUP_ORDER,
} from "@/lib/admin/permission-catalog";
import { PageHeader, Section, Card, Badge, StateView, InfoBanner } from "@/components/admin/ui";
import { IconShield, IconShieldCheck } from "@/lib/icons";

const ROLE_KIND_TONES = {
  super: "brand",
  staff: "info",
  user: "neutral",
} as const;

function RoleComposer() {
  const [selected, setSelected] = useState<Set<Permission>>(new Set());

  const groups = PERMISSION_GROUP_ORDER.map(({ group, labelFa }) => ({
    labelFa,
    items: (Object.keys(PERMISSION_META) as Permission[]).filter(
      (p) => PERMISSION_META[p].group === group
    ),
  })).filter((g) => g.items.length > 0);

  function toggle(p: Permission) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  // The existing role whose permission set exactly equals the selection.
  const equivalent = useMemo(() => {
    if (selected.size === 0) return null;
    const wanted = [...selected].sort();
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS) as [
      PlatformRole,
      Permission[],
    ][]) {
      const have = [...perms].sort();
      if (have.length === wanted.length && have.every((p, i) => p === wanted[i])) {
        return role;
      }
    }
    return null;
  }, [selected]);

  return (
    <Card className="p-4">
      <p className="mb-3 text-body-2 text-muted">
        مجوزهای دلخواه را انتخاب کنید تا ببینید کدام نقش موجود دقیقاً همین دسترسی را می‌دهد.
        این ابزار فقط پیش‌نمایش است و چیزی ذخیره نمی‌کند.
      </p>

      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.labelFa}>
            <p className="mb-1 text-caption font-semibold text-on-surface-variant">{g.labelFa}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((p) => {
                const on = selected.has(p);
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(p)}
                    className={`rounded-full border px-2.5 py-1 text-caption transition-colors ${
                      on
                        ? "border-primary bg-primary-soft font-medium text-primary"
                        : "border-divider bg-surface text-muted hover:border-primary-300 hover:text-on-surface"
                    }`}
                  >
                    {PERMISSION_FA[p]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-divider pt-3 text-body-2">
        <span className="text-muted">مجموع انتخاب‌شده: </span>
        <span className="font-semibold text-on-surface">
          {toPersianNumber(selected.size)} مجوز
        </span>
        {equivalent && (
          <>
            <span className="text-muted"> — معادل نقش </span>
            <span className="font-semibold text-primary">{ROLE_FA[equivalent]}</span>
          </>
        )}
        {selected.size > 0 && !equivalent && (
          <span className="text-muted"> — معادل هیچ نقش موجودی نیست.</span>
        )}
      </div>
    </Card>
  );
}

export default function AdminRolesPage() {
  const roles = useAdminRoles();
  const { can } = useAdminMe();
  const [selectedRole, setSelectedRole] = useState<PlatformRole | null>(null);

  const activeRole = selectedRole ?? roles.data?.items[0]?.role ?? null;
  const activeDescriptor = roles.data?.items.find((r) => r.role === activeRole);

  const grouped = activeDescriptor
    ? PERMISSION_GROUP_ORDER.map(({ group, labelFa }) => ({
        labelFa,
        items: activeDescriptor.permissions.filter((p) => PERMISSION_META[p].group === group),
      })).filter((g) => g.items.length > 0)
    : [];

  return (
    <div>
      <PageHeader
        icon={<IconShield size={22} />}
        title="نقش‌ها و ماتریس دسترسی"
        description="هر نقش و مجوزهایی که سرور برای آن اعمال می‌کند. در این پلتفرم نقش‌ها کدپایه‌اند و کاربردشان توسط سرور مجوزسنجی می‌شود."
      />

      <InfoBanner tone="info">
        نقش‌ها بخشی از معماری امنیتی سرور هستند و از طریق کد تعریف می‌شوند؛ برای همین در پنل
        فقط نمایش داده می‌شوند. تخصیص نقش به کارکنان از صفحهٔ «کارکنان» انجام می‌شود.
      </InfoBanner>

      <StateView
        query={roles}
        loadingRows={6}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="نقشی ثبت نشده است."
      >
        {(data) => (
          <div className="grid gap-5 tablet:grid-cols-[260px_1fr]">
            {/* Role selector */}
            <Card className="p-2">
              <ul className="max-h-[70vh] space-y-0.5 overflow-y-auto">
                {data.items.map((r) => {
                  const active = r.role === activeRole;
                  const tone = r.isSuperAdmin ? "super" : r.isStaff ? "staff" : "user";
                  return (
                    <li key={r.role}>
                      <button
                        type="button"
                        onClick={() => setSelectedRole(r.role)}
                        aria-current={active ? "true" : undefined}
                        className={`flex w-full items-center justify-between gap-2 rounded-medium px-3 py-2 text-start text-body-2 transition-colors ${
                          active
                            ? "bg-primary-soft font-medium text-primary"
                            : "text-on-surface-variant hover:bg-surface-hover"
                        }`}
                      >
                        <span className="truncate">{r.roleFa}</span>
                        <Badge tone={ROLE_KIND_TONES[tone]}>
                          {toPersianNumber(r.permissions.length)}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {/* Selected role detail */}
            <Card className="p-5">
              {!activeDescriptor ? (
                <p className="text-body-2 text-muted">نقشی انتخاب نشده است.</p>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <h2 className="text-titleLarge font-bold text-on-surface">
                      {activeDescriptor.roleFa}
                    </h2>
                    {activeDescriptor.isSuperAdmin ? (
                      <Badge tone="brand">مدیر ارشد</Badge>
                    ) : activeDescriptor.isStaff ? (
                      <Badge tone="info">کارمند</Badge>
                    ) : (
                      <Badge tone="neutral">کاربر</Badge>
                    )}
                    <Badge tone="neutral">
                      {toPersianNumber(activeDescriptor.permissions.length)} مجوز
                    </Badge>
                  </div>

                  {grouped.length === 0 ? (
                    <p className="text-body-2 text-muted">این نقش مجوزی ندارد.</p>
                  ) : (
                    <div className="space-y-4">
                      {grouped.map((g) => (
                        <div key={g.labelFa}>
                          <p className="mb-1.5 text-caption font-semibold text-on-surface-variant">
                            {g.labelFa}
                          </p>
                          <ul className="grid gap-1.5 tablet:grid-cols-2">
                            {g.items.map((p) => (
                              <li
                                key={p}
                                className="flex items-center gap-1.5 text-body-2 text-on-surface-variant"
                              >
                                <IconShieldCheck
                                  size={15}
                                  className="shrink-0 text-success-600"
                                  aria-hidden="true"
                                />
                                <span>{PERMISSION_FA[p]}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>
        )}
      </StateView>

      {can("admin:staff:manage") && (
        <div className="mt-6">
          <Section
            title="ترکیب‌بندی دسترسی (پیش‌نمایش)"
            subtitle="انتخاب مجوزهای دلخواه و یافتن نقش معادل — بدون ذخیره‌سازی."
          >
            <RoleComposer />
          </Section>
        </div>
      )}
    </div>
  );
}
