// ============================================================
// LEGALIR — Admin · Permissions (کاتالوگ مجوزها)
// ============================================================
// The flat catalog of every permission in the platform, grouped by domain,
// with its action level (مشاهده / مدیریت / تأیید / خروجی …) and the roles
// that actually grant it. This is a read-only mirror of the shared
// `ROLE_PERMISSIONS` model — the same map the server authorizes against — so
// an operator can answer "who can do X?" without reading code.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { useAdminRoles } from "@/hooks/useAdmin";
import type { Permission } from "@legalir/types";
import { toPersianNumber, normalizePersian } from "@/lib/persian-utils";
import {
  PERMISSION_FA,
  PERMISSION_META,
  PERMISSION_LEVEL_FA,
  PERMISSION_GROUP_ORDER,
  permissionLevel,
  ALL_PERMISSIONS,
  rolesWithPermission,
  type PermissionLevel,
} from "@/lib/admin/permission-catalog";
import { PageHeader, Section, Card, Badge, StateView, SearchInput } from "@/components/admin/ui";
import { IconShieldCheck } from "@/lib/icons";

const LEVEL_TONES: Record<
  PermissionLevel,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  view: "neutral",
  create: "info",
  edit: "info",
  delete: "danger",
  approve: "warning",
  manage: "brand",
  export: "info",
  system: "danger",
};

function PermissionRow({ permission }: { permission: Permission }) {
  const granters = rolesWithPermission(permission);
  const level = permissionLevel(permission);
  return (
    <li className="flex flex-col gap-1.5 bg-surface px-4 py-3 tablet:flex-row tablet:items-center tablet:justify-between">
      <div className="min-w-0">
        <p className="text-body-2 font-medium text-on-surface">{PERMISSION_FA[permission]}</p>
        <p dir="ltr" className="mt-0.5 truncate font-mono text-caption text-muted">
          {permission}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={LEVEL_TONES[level]}>{PERMISSION_LEVEL_FA[level]}</Badge>
        {granters.length === 0 ? (
          <span className="text-caption text-muted">به هیچ نقشی تعلق ندارد</span>
        ) : (
          granters.map((g) => (
            <span
              key={g.role}
              className="rounded-full border border-divider px-2 py-0.5 text-caption text-on-surface-variant"
            >
              {g.labelFa}
            </span>
          ))
        )}
      </div>
    </li>
  );
}

export default function AdminPermissionsPage() {
  const roles = useAdminRoles();
  const [search, setSearch] = useState("");
  const q = normalizePersian(search.trim());

  const groups = useMemo(
    () =>
      PERMISSION_GROUP_ORDER.map(({ group, labelFa }) => ({
        labelFa,
        items: ALL_PERMISSIONS.filter((p) => {
          if (PERMISSION_META[p].group !== group) return false;
          if (!q) return true;
          return normalizePersian(PERMISSION_FA[p]).includes(q) || p.toLowerCase().includes(q);
        }),
      })).filter((g) => g.items.length > 0),
    [q]
  );

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div>
      <PageHeader
        icon={<IconShieldCheck size={22} />}
        title="کاتالوگ مجوزها"
        description="همه مجوزهای پلتفرم، گروه‌بندی‌شده بر اساس حوزه و سطح عمل، همراه با نقش‌هایی که هر مجوز را اعطا می‌کنند."
      />

      <StateView query={roles} loadingRows={6} isEmpty={() => false}>
        {() => (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="جست‌وجوی مجوز…"
                className="min-w-[240px]"
              />
              <span className="text-caption text-muted">{toPersianNumber(total)} مجوز یافت شد</span>
            </div>

            {groups.length === 0 ? (
              <Card className="p-8 text-center text-body-2 text-muted">
                مجوزی با این عبارت یافت نشد.
              </Card>
            ) : (
              <div className="space-y-5">
                {groups.map((g) => (
                  <Section key={g.labelFa} title={g.labelFa}>
                    <ul className="divide-y divide-divider overflow-hidden rounded-large border border-divider">
                      {g.items.map((p) => (
                        <PermissionRow key={p} permission={p} />
                      ))}
                    </ul>
                  </Section>
                ))}
              </div>
            )}
          </>
        )}
      </StateView>
    </div>
  );
}
