// ============================================================
// LEGALIR — Admin · Users & Organizations (کاربران و سازمان‌ها)
// ============================================================
// Two real registers behind one page title:
//
//   · «کاربران» — platform users with their role, account type and
//     subscription state. A super-admin (holding admin:users:manage) may change
//     a user's role — the LAST super-admin cannot be demoted (server-enforced
//     lockout guard). Mobile numbers are masked by default and revealed per row
//     via the eye toggle in the same cell; both states render LTR (isolated)
//     within the RTL panel so digits never reorder.
//
//   · «سازمان‌ها» — the legal entities registered on the platform, projected
//     from organizations/org_members/org_signatories. The status summary is
//     computed over the WHOLE register, so a filtered page still reports the
//     true shape of the book of business. Opening a row renders the full
//     dossier in a drawer, where a manager can move it through its lifecycle.
// ============================================================

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useChangeStaffRole, useAdminMe, useAdminOrganizations } from "@/hooks/useAdmin";
import { useUsersList } from "@/hooks/useAnalyticsDrill";
import { DrillWindowBanner } from "@/components/admin/drill-window-banner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { UserSubscriptionDrawer } from "@/components/admin/user-subscription-drawer";
import { UserRequestsDrawer } from "@/components/admin/user-requests-drawer";
import { OrganizationDetailDrawer } from "@/components/admin/organization-detail-drawer";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import {
  ORGANIZATION_STATUS_FA,
  ROLE_FA,
  STAFF_ROLES,
  type OrganizationStatus,
  type PlatformRole,
} from "@legalir/types";
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
  InlineNotice,
  Pagination,
  ExportButton,
  Tabs,
  FilterPills,
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

const ORG_STATUS_ORDER: OrganizationStatus[] = [
  "DRAFT",
  "PROFILE_INCOMPLETE",
  "PROFILE_COMPLETE",
  "PENDING_VERIFICATION",
  "ACTIVE",
  "REJECTED",
  "SUSPENDED",
];

const ORG_STATUS_TONE: Record<
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

type View = "users" | "orgs";

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
  const [view, setView] = useState<View>("users");

  return (
    <div>
      <PageHeader
        title="کاربران و سازمان‌ها"
        description="دو دفتر ثبت پلتفرم: کاربران با نقش، نوع حساب و وضعیت اشتراک — و سازمان‌های حقوقی با اعضا، صاحبان امضا و چرخهٔ تأیید."
        actions={view === "users" ? <ExportButton kind="users" /> : undefined}
      />

      <Tabs<View>
        ariaLabel="کاربران یا سازمان‌ها"
        value={view}
        onChange={setView}
        items={[
          { value: "users", label: "کاربران" },
          { value: "orgs", label: "سازمان‌ها" },
        ]}
      />

      {view === "users" ? <UsersPanel /> : <OrganizationsPanel />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users register
// ---------------------------------------------------------------------------

function UsersPanel() {
  const { can } = useAdminMe();
  const canManage = can("admin:users:manage");
  // §8 — reading a user's request history is its own permission, so a staff
  // member who may only inspect requests still gets the drill-down.
  const canReadRequests = can("admin:requests:read");
  const showActions = canManage || canReadRequests;

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [editing, setEditing] = useState<string | null>(null);
  const [billingUserId, setBillingUserId] = useState<string | null>(null);
  const [requestsUser, setRequestsUser] = useState<{ id: string; name: string } | null>(null);
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
      <DrillWindowBanner subjectFa="کاربران" />

      {!canManage && (
        <InfoBanner tone="warning">
          شما مجوز مدیریت نقش‌ها را ندارید؛ این فهرست فقط‌خواندنی است.
        </InfoBanner>
      )}

      {feedback && <InlineNotice tone={feedback.tone}>{feedback.text}</InlineNotice>}

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
                  {showActions && <Th>عملیات</Th>}
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
                  {showActions && (
                    <Td>
                      <div className="flex items-center gap-2">
                        {canManage && (
                          <>
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
                          </>
                        )}
                        {canReadRequests && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setRequestsUser({ id: u.id, name: u.displayName ?? "بدون نام" })
                            }
                          >
                            درخواست‌ها
                          </Button>
                        )}
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

      <UserRequestsDrawer
        userId={requestsUser?.id ?? null}
        userName={requestsUser?.name ?? null}
        canManage={canManage}
        open={Boolean(requestsUser)}
        onClose={() => setRequestsUser(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Organizations register
// ---------------------------------------------------------------------------

function OrganizationsPanel() {
  const { can } = useAdminMe();
  const canManage = can("admin:users:manage");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrganizationStatus | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [openOrgId, setOpenOrgId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  useEffect(() => setPage(1), [debouncedSearch, pageSize, status]);

  const query = useAdminOrganizations({
    search: debouncedSearch || undefined,
    status: status || undefined,
    page,
    pageSize,
  });

  const summary = query.data?.summary;

  return (
    <div>
      {!canManage && (
        <InfoBanner tone="warning">
          شما مجوز مدیریت کاربران را ندارید؛ پرونده‌های سازمان فقط‌خواندنی هستند.
        </InfoBanner>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="جستجو در نام، شناسهٔ ملی، شمارهٔ ثبت، شهر یا نام نماینده"
          className="min-w-[240px]"
        />
        <FilterPills<OrganizationStatus | "">
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: `همه (${toPersianNumber(summary?.total ?? 0)})` },
            ...ORG_STATUS_ORDER.map((s) => ({
              value: s,
              label: `${ORGANIZATION_STATUS_FA[s]} (${toPersianNumber(summary?.[s] ?? 0)})`,
            })),
          ]}
        />
      </div>

      <StateView
        query={query}
        loadingRows={6}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="سازمانی با این فیلتر یافت نشد."
        emptyHint="سازمان‌ها زمانی در این دفتر ثبت ظاهر می‌شوند که یک کاربر حقیقی، پروندهٔ شخص حقوقی بسازد."
      >
        {(data) => (
          <>
            <DataTable
              head={
                <tr>
                  <Th>سازمان</Th>
                  <Th>نوع شخصیت</Th>
                  <Th>شناسهٔ ملی</Th>
                  <Th>نماینده</Th>
                  <Th>اعضا</Th>
                  <Th>امضاها</Th>
                  <Th>وضعیت</Th>
                  <Th>ثبت</Th>
                  <Th>عملیات</Th>
                </tr>
              }
            >
              {data.items.map((o) => (
                <tr key={o.id}>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-medium text-on-surface">{o.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {o.tradeName && (
                          <span className="text-caption text-muted">{o.tradeName}</span>
                        )}
                        <IdChip id={o.id} />
                      </span>
                    </div>
                  </Td>
                  <Td>{o.legalTypeFa ?? "ثبت نشده"}</Td>
                  <Td>
                    {o.nationalId ? (
                      <span dir="ltr" className="tabular-nums">
                        {o.nationalId}
                      </span>
                    ) : (
                      <span className="text-muted">ثبت نشده</span>
                    )}
                  </Td>
                  <Td>{o.ownerNameFa ?? "ثبت نشده"}</Td>
                  <Td className="tabular-nums">{toPersianNumber(o.memberCount)}</Td>
                  <Td className="tabular-nums">{toPersianNumber(o.signatoryCount)}</Td>
                  <Td>
                    <Badge tone={ORG_STATUS_TONE[o.status]}>{o.statusFa}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">{toPersianDate(o.createdAt)}</Td>
                  <Td>
                    <Button size="sm" variant="secondary" onClick={() => setOpenOrgId(o.id)}>
                      پرونده
                    </Button>
                  </Td>
                </tr>
              ))}
            </DataTable>

            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              itemLabel="سازمان"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </StateView>

      <OrganizationDetailDrawer
        orgId={openOrgId}
        open={Boolean(openOrgId)}
        onClose={() => setOpenOrgId(null)}
      />
    </div>
  );
}
