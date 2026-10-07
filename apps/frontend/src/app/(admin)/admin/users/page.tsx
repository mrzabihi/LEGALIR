// ============================================================
// LEGALIR — Admin · Users & Organizations (کاربران و سازمان‌ها)
// ============================================================
// Lists platform users with their role, account type and subscription
// state. A super-admin (holding admin:users:manage) may change a user's
// role — the LAST super-admin cannot be demoted (server-enforced lockout
// guard). Mobile numbers are masked by the server; the panel never sees or
// shows a full number.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminUsers, useChangeStaffRole, useAdminMe } from "@/hooks/useAdmin";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { UserSubscriptionDrawer } from "@/components/admin/user-subscription-drawer";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import { ROLE_FA, STAFF_ROLES } from "@legalir/types";
import type { PlatformRole } from "@legalir/types";
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
  InfoBanner,
  ExportButton,
} from "@/components/admin/ui";
import { IconSearch, IconWarning } from "@/lib/icons";

const ASSIGNABLE_ROLES: PlatformRole[] = [
  "USER",
  "LAWYER",
  "COMPANY_OWNER",
  "COMPANY_ADMIN",
  "COMPANY_MEMBER",
  ...STAFF_ROLES,
];

function RoleBadge({ role }: { role: PlatformRole }) {
  const isStaff = STAFF_ROLES.includes(role);
  return <Badge tone={isStaff ? "brand" : "neutral"}>{ROLE_FA[role] ?? role}</Badge>;
}

export default function AdminUsersPage() {
  const { can } = useAdminMe();
  const canManage = can("admin:users:manage");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);
  const [billingUserId, setBillingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  // Server-side search: debounce the raw input so typing stays instant while
  // the list re-queries only once the operator pauses.
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  useEffect(() => setPage(1), [debouncedSearch]);

  const query = useAdminUsers({ search: debouncedSearch, page, pageSize: 25 });
  const changeRole = useChangeStaffRole();

  const totalPages = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize))
    : 1;

  const roleOptions = useMemo(
    () => ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_FA[r] ?? r })),
    []
  );

  async function onRoleChange(userId: string, role: PlatformRole) {
    setFeedback(null);
    try {
      await changeRole.mutateAsync({ userId, role });
      setEditing(null);
      setFeedback({ tone: "success", text: "نقش کاربر با موفقیت تغییر کرد." });
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "تغییر نقش ناموفق بود";
      setFeedback({ tone: "error", text: message });
    }
  }

  return (
    <div>
      <PageHeader
        title="کاربران و سازمان‌ها"
        description="فهرست کاربران پلتفرم با نقش، نوع حساب و وضعیت اشتراک. شماره‌های تماس به‌صورت پوشیده نمایش داده می‌شوند."
        actions={<ExportButton kind="users" />}
      />

      {!canManage && (
        <InfoBanner tone="warning">
          شما مجوز مدیریت نقش‌ها را ندارید؛ این فهرست فقط‌خواندنی است.
        </InfoBanner>
      )}

      {feedback && (
        <div
          className={`mb-4 rounded-large border p-3 text-body-2 ${
            feedback.tone === "error"
              ? "border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted">
            <IconSearch size={16} />
          </span>
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو در نام، شماره پوشیده یا شناسه"
            className="ps-9"
          />
        </div>
      </div>

      <StateView
        query={query}
        loadingRows={6}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="کاربری با این فیلتر یافت نشد."
      >
        {(data) => (
          <>
            <DataTable
              head={
                <tr>
                  <Th>نام</Th>
                  <Th>شماره</Th>
                  <Th>نقش</Th>
                  <Th>نوع حساب</Th>
                  <Th>اشتراک</Th>
                  <Th>عضویت</Th>
                  {canManage && <Th>عملیات</Th>}
                </tr>
              }
            >
              {data.items.map((u) => (
                <tr key={u.id}>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-medium text-on-surface">
                        {u.displayName ?? "بدون نام"}
                      </span>
                      <IdChip id={u.id} />
                    </div>
                  </Td>
                  <Td className="tabular-nums">{u.mobileMasked}</Td>
                  <Td>
                    {editing === u.id ? (
                      <select
                        autoFocus
                        className="rounded-medium border border-divider bg-surface px-2 py-1 text-caption"
                        defaultValue={u.role}
                        onChange={(e) => onRoleChange(u.id, e.target.value as PlatformRole)}
                        onBlur={() => setEditing(null)}
                      >
                        {roleOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <RoleBadge role={u.role} />
                    )}
                  </Td>
                  <Td>{u.accountType}</Td>
                  <Td>
                    {u.hasActiveSubscription ? (
                      <Badge tone="success">فعال</Badge>
                    ) : (
                      <Badge tone="neutral">ندارد</Badge>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{toPersianDate(u.createdAt)}</Td>
                  {canManage && (
                    <Td>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setFeedback(null);
                            setEditing(u.id);
                          }}
                        >
                          تغییر نقش
                        </Button>
                        <Button size="sm" variant="tonal" onClick={() => setBillingUserId(u.id)}>
                          اشتراک و انرژی
                        </Button>
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </DataTable>

            <div className="mt-3 flex items-center justify-between text-caption text-muted">
              <span>{toPersianNumber(data.total)} کاربر</span>
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

            {canManage && (
              <p className="mt-4 flex items-center gap-1.5 text-caption text-muted">
                <IconWarning size={14} /> آخرین مدیر ارشد پلتفرم قابل تنزل نیست؛ سرور این عملیات را رد
                می‌کند.
              </p>
            )}
          </>
        )}
      </StateView>

      <UserSubscriptionDrawer
        userId={billingUserId}
        open={Boolean(billingUserId)}
        onClose={() => setBillingUserId(null)}
      />
    </div>
  );
}
