// ============================================================
// LEGALIR — Admin · Users & Organizations (کاربران و سازمان‌ها)
// ============================================================
// Lists platform users with their role, account type and subscription
// state. A super-admin (holding admin:users:manage) may change a user's
// role — the LAST super-admin cannot be demoted (server-enforced lockout
// guard). Mobile numbers are masked by default (the four middle digits hidden
// with a star each) and revealed per row via the eye toggle in the same cell;
// both states render LTR (isolated) within the RTL panel so digits never
// reorder.
// ============================================================

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useChangeStaffRole, useAdminMe } from "@/hooks/useAdmin";
import { useUsersList } from "@/hooks/useAnalyticsDrill";
import { DrillWindowBanner } from "@/components/admin/drill-window-banner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { UserSubscriptionDrawer } from "@/components/admin/user-subscription-drawer";
import { toPersianDate } from "@/lib/persian-utils";
import { ROLE_FA, STAFF_ROLES } from "@legalir/types";
import type { PlatformRole } from "@legalir/types";
import {
  PageHeader,
  DataTable,
  Th,
  Td,
  MaskedMobile,
  Badge,
  StateView,
  LoadingBlock,
  SearchInput,
  Button,
  IdChip,
  InfoBanner,
  Pagination,
  ExportButton,
} from "@/components/admin/ui";
import { DEFAULT_PAGE_SIZE } from "@/lib/admin/pagination";
import { IconWarning } from "@/lib/icons";

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
  return (
    <Suspense fallback={<LoadingBlock rows={6} />}>
      <AdminUsersView />
    </Suspense>
  );
}

function AdminUsersView() {
  const { can } = useAdminMe();
  const canManage = can("admin:users:manage");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [editing, setEditing] = useState<string | null>(null);
  const [billingUserId, setBillingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  // Server-side search: debounce the raw input so typing stays instant while
  // the list re-queries only once the operator pauses.
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  useEffect(() => setPage(1), [debouncedSearch, pageSize]);

  // When opened from a BI KPI (`?fromIso&toIso`) this scopes to that window;
  // otherwise it is the ordinary full user list — one code path either way.
  const query = useUsersList({ search: debouncedSearch, page, pageSize });
  const changeRole = useChangeStaffRole();

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
        description="فهرست کاربران پلتفرم با نقش، نوع حساب و وضعیت اشتراک. شماره‌های تماس به‌صورت پیش‌فرض ماسک هستند و با آیکون چشم هر ردیف به‌طور کامل نمایش داده می‌شوند."
        actions={<ExportButton kind="users" />}
      />

      <DrillWindowBanner subjectFa="کاربران" />

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
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="جستجو در نام، شماره تماس یا شناسه"
          className="min-w-[240px] flex-1"
        />
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
                      {/* The readable system id (LG-…) is the user-facing
                          identifier and the one the search matches; fall back
                          to the internal id for legacy rows not yet backfilled. */}
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <span className="text-caption text-muted">شناسهٔ سیستمی:</span>
                        <IdChip id={u.publicId ?? u.id} />
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <MaskedMobile value={u.mobile} />
                  </Td>
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

            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              itemLabel="کاربر"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />

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
