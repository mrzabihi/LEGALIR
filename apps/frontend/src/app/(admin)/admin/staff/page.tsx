// ============================================================
// LEGALIR — Admin · Staff (مدیران، نقش‌ها و رویدادهای امنیتی)
// ============================================================
// The staff surface: the directory of platform staff, and the append-only
// security-event log. The role→permission matrix and the permission catalog
// live on the sibling sub-pages (/admin/staff/roles, /admin/staff/permissions)
// reached through the shared StaffNav.
//
//   • Staff           — searchable directory. Opening a row shows the full
//                       dossier (identity, org, access, activity) in a drawer.
//                       A super-admin (admin:staff:manage) can reassign a role
//                       inline or from the drawer; the LAST role manager is
//                       protected server-side.
//   • Security events — every sensitive action, filterable by actor, action
//                       key, resource kind, resource id, result and free text,
//                       with the real before → after diff.
//
// The security-event filters live in the URL, so any other surface can link
// straight into the trail for one entity (e.g. the organization dossier links
// to `?resourceType=organization&resourceId=…`). The resource-kind and action
// dropdowns are built from `facets` — the values actually present in the log —
// so they can never offer a filter that matches nothing.
//
// Mobiles are shown MASKED. The audit log never carries secrets.
// ============================================================

"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useAdminStaff,
  useAdminRoles,
  useChangeStaffRole,
  useAdminAudit,
  useAdminMe,
} from "@/hooks/useAdmin";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { toPersianNumber, toRelativeTime } from "@/lib/persian-utils";
import { ROLE_FA, STAFF_ROLES } from "@legalir/types";
import type { PlatformRole, AdminAuditEntry, StaffMember } from "@legalir/types";
import {
  PageHeader,
  Card,
  DataTable,
  Th,
  Td,
  Badge,
  Button,
  StateView,
  Select,
  TextInput,
  SearchInput,
  InfoBanner,
  Section,
  IdChip,
  ExportButton,
  Pagination,
} from "@/components/admin/ui";
import { useClientPagination } from "@/hooks/useClientPagination";
import { StaffNav } from "@/components/admin/staff-nav";
import { StaffDetailDrawer } from "@/components/admin/staff-detail-drawer";
import { AddStaffDialog } from "@/components/admin/add-staff-dialog";

const ASSIGNABLE_ROLES: PlatformRole[] = [
  "USER",
  "LAWYER",
  "COMPANY_OWNER",
  "COMPANY_ADMIN",
  "COMPANY_MEMBER",
  ...STAFF_ROLES,
];

const RESULT_TONES: Record<AdminAuditEntry["result"], "success" | "danger" | "warning"> = {
  success: "success",
  failure: "danger",
  denied: "warning",
};

const RESULT_FA: Record<AdminAuditEntry["result"], string> = {
  success: "موفق",
  failure: "ناموفق",
  denied: "رد شده",
};

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

/** Renders the redacted before → after diff of an audit entry, compactly. */
function AuditDiff({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  const parts: string[] = [];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    const bStr = before?.[k] === undefined ? "—" : String(before[k]);
    const aStr = after?.[k] === undefined ? "—" : String(after[k]);
    parts.push(bStr === aStr ? `${k}: ${aStr}` : `${k}: ${bStr} → ${aStr}`);
  }
  if (parts.length === 0) return <span className="text-outline">—</span>;
  return (
    <span dir="ltr" className="block max-w-[260px] font-mono text-caption">
      {parts.join(" · ")}
    </span>
  );
}

export default function AdminStaffPage() {
  const { can } = useAdminMe();
  const canManage = can("admin:staff:manage");
  // The audit feed is its OWN permission; a staff manager may not hold it.
  const canAudit = can("admin:audit:read");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const staff = useAdminStaff({
    search: debouncedSearch || undefined,
    role: roleFilter || undefined,
  });
  const staffItems = staff.data?.items ?? [];
  const staffPager = useClientPagination(staffItems);
  const { reset: resetStaffPage } = staffPager;
  useEffect(() => resetStaffPage(), [resetStaffPage, debouncedSearch, roleFilter]);
  const roles = useAdminRoles();
  const changeRole = useChangeStaffRole();

  const [editing, setEditing] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const roleOptions = useMemo(
    () => ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_FA[r] ?? r })),
    []
  );

  async function onRoleChange(userId: string, role: PlatformRole) {
    setFeedback(null);
    try {
      await changeRole.mutateAsync({ userId, role });
      setEditing(null);
      setFeedback({ tone: "success", text: "نقش کارمند به‌روزرسانی شد." });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "تغییر نقش ناموفق بود") });
    }
  }

  return (
    <div>
      <PageHeader
        title="مدیران، نقش‌ها و رویدادهای امنیتی"
        description="کارکنان پلتفرم، سطح دسترسی نقش‌ها و گزارش رویدادهای امنیتی. تغییر نقش نیازمند مجوز مدیریت کارکنان است و سرور آن را مجوزسنجی می‌کند."
        actions={canAudit ? <ExportButton kind="audit" /> : undefined}
      />
      <StaffNav />

      {feedback && (
        <InfoBanner tone={feedback.tone === "error" ? "warning" : "success"}>
          {feedback.text}
        </InfoBanner>
      )}

      {!canManage && (
        <InfoBanner tone="warning">
          شما مجوز مدیریت کارکنان را ندارید؛ فهرست کارکنان فقط‌خواندنی است.
        </InfoBanner>
      )}

      {/* ----- Staff ----- */}
      <Section
        title="کارکنان پلتفرم"
        subtitle="کاربرانی با نقش کارمندی، و نقش فعلی آن‌ها."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="جست‌وجوی نام یا ایمیل…" />
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="min-w-[160px]"
            >
              <option value="">همه نقش‌ها</option>
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_FA[r] ?? r}
                </option>
              ))}
            </Select>
            {canManage && (
              <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
                افزودن کارمند
              </Button>
            )}
          </div>
        }
      >
        <StateView
          query={staff}
          loadingRows={4}
          isEmpty={(d) => d.items.length === 0}
          emptyMessage="کارمندی با این فیلتر یافت نشد."
        >
          {() => (
            <>
              <DataTable
                head={
                  <tr>
                    <Th>نام</Th>
                    <Th>شماره موبایل</Th>
                    <Th>نقش</Th>
                    <Th>سازمان</Th>
                    <Th>آخرین فعالیت</Th>
                    <Th>عملیات</Th>
                  </tr>
                }
              >
                {staffPager.pageItems.map((m: StaffMember) => (
                  <tr key={m.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-body-2 font-bold text-primary"
                        >
                          {(m.displayName ?? "ک").trim().charAt(0)}
                        </span>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-on-surface">
                            {m.displayName ?? "بدون نام"}
                          </span>
                          <IdChip id={m.id} />
                        </div>
                      </div>
                    </Td>
                    <Td className="tabular-nums" dir="ltr">
                      {m.mobileMasked}
                    </Td>
                    <Td>
                      {editing === m.id ? (
                        <select
                          autoFocus
                          className="rounded-medium border border-divider bg-surface px-2 py-1 text-caption"
                          defaultValue={m.role}
                          onChange={(e) => onRoleChange(m.id, e.target.value as PlatformRole)}
                          onBlur={() => setEditing(null)}
                        >
                          {roleOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge tone="brand">{m.roleFa}</Badge>
                      )}
                    </Td>
                    <Td className="text-caption text-muted" dir="ltr">
                      {m.orgId ?? "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-caption text-muted">
                      {m.lastActiveAt ? toRelativeTime(m.lastActiveAt) : "بدون سابقه"}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setDetailId(m.id)}>
                          مشاهده
                        </Button>
                        {canManage && (
                          <Button size="sm" variant="ghost" onClick={() => setEditing(m.id)}>
                            تغییر نقش
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </DataTable>

              <Pagination
                page={staffPager.page}
                pageSize={staffPager.pageSize}
                total={staffPager.total}
                totalPages={staffPager.totalPages}
                itemLabel="کارمند"
                onPageChange={staffPager.setPage}
                onPageSizeChange={staffPager.setPageSize}
              />
            </>
          )}
        </StateView>
      </Section>

      {/* ----- Role matrix (summary) ----- */}
      <Section
        title="ماتریس نقش و دسترسی"
        subtitle="خلاصهٔ هر نقش و تعداد مجوزها؛ برای جزئیات کامل به «نقش‌ها» و «مجوزها» در بالای صفحه بروید."
      >
        <StateView
          query={roles}
          loadingRows={4}
          isEmpty={(d) => d.items.length === 0}
          emptyMessage="نقشی ثبت نشده است."
        >
          {(data) => (
            <DataTable
              head={
                <tr>
                  <Th>نقش</Th>
                  <Th>نوع</Th>
                  <Th>تعداد مجوز</Th>
                </tr>
              }
            >
              {data.items.map((r) => (
                <tr key={r.role}>
                  <Td className="whitespace-nowrap font-medium text-on-surface">{r.roleFa}</Td>
                  <Td>
                    {r.isSuperAdmin ? (
                      <Badge tone="brand">مدیر ارشد</Badge>
                    ) : r.isStaff ? (
                      <Badge tone="info">کارمند</Badge>
                    ) : (
                      <Badge tone="neutral">کاربر</Badge>
                    )}
                  </Td>
                  <Td className="tabular-nums">{toPersianNumber(r.permissions.length)}</Td>
                </tr>
              ))}
            </DataTable>
          )}
        </StateView>
      </Section>

      {/* ----- Audit / security events (own permission: admin:audit:read) ----- */}
      {canAudit ? (
        // The filter state lives in the URL, so the boundary is required for
        // `useSearchParams` in a statically-rendered route.
        <Suspense
          fallback={
            <Section title="رویدادهای امنیتی (ممیزی)">
              <div className="text-caption text-muted">در حال خواندن فیلترها…</div>
            </Section>
          }
        >
          <SecurityEventsSection />
        </Suspense>
      ) : (
        <Section title="رویدادهای امنیتی (ممیزی)">
          <InfoBanner tone="warning">
            دسترسی به گزارش رویدادهای امنیتی نیازمند مجوز «ممیزی» است. برای مشاهده، با مدیر ارشد
            هماهنگ کنید.
          </InfoBanner>
        </Section>
      )}

      <Card className="p-4 text-caption text-muted">
        توجه: آخرین مدیر ارشد پلتفرم قابل تنزل نیست؛ این محدودیت سمت سرور اعمال می‌شود تا دسترسی
        مدیریتی از دست نرود.
      </Card>

      <StaffDetailDrawer
        staffId={detailId}
        open={detailId !== null}
        onClose={() => setDetailId(null)}
      />

      <AddStaffDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Security events
// ---------------------------------------------------------------------------

/**
 * Rebuild the URL with one audit filter changed. An empty value or page 1
 * removes the parameter, so a cleared filter leaves no residue in the address
 * an operator copies out of the bar.
 */
function auditUrl(
  params: URLSearchParams,
  pathname: string,
  patch: Record<string, string | number>
): string {
  const next = new URLSearchParams(params.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v === "" || v === 0) next.delete(k);
    else next.set(k, String(v));
  }
  const s = next.toString();
  return s ? `${pathname}?${s}` : pathname;
}

/**
 * The append-only security trail.
 *
 * Every filter is a URL parameter, so a dossier elsewhere in the panel can link
 * straight to the events for one entity (`?resourceType=organization&resourceId=…`)
 * instead of telling the operator to go and type two ids by hand. The
 * resource-kind and action dropdowns are built from the facets the log actually
 * contains — never a static catalog that could offer an empty filter.
 */
function SecurityEventsSection() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const applied = useMemo(
    () => ({
      actor: params.get("actor") ?? "",
      action: params.get("action") ?? "",
      resourceType: params.get("resourceType") ?? "",
      resourceId: params.get("resourceId") ?? "",
      q: params.get("q") ?? "",
      result: params.get("result") ?? "",
      page: Math.max(1, Number(params.get("page") ?? 1) || 1),
    }),
    [params]
  );

  const [actorDraft, setActorDraft] = useState(applied.actor);
  const [actionDraft, setActionDraft] = useState(applied.action);
  const [resourceIdDraft, setResourceIdDraft] = useState(applied.resourceId);
  const [qDraft, setQDraft] = useState(applied.q);

  // A deep link changes the URL underneath mounted inputs — re-seed the drafts
  // so each box shows the value that is actually being applied.
  useEffect(() => setActorDraft(applied.actor), [applied.actor]);
  useEffect(() => setActionDraft(applied.action), [applied.action]);
  useEffect(() => setResourceIdDraft(applied.resourceId), [applied.resourceId]);
  useEffect(() => setQDraft(applied.q), [applied.q]);

  const debouncedActor = useDebouncedValue(actorDraft.trim(), 300);
  const debouncedAction = useDebouncedValue(actionDraft.trim(), 300);
  const debouncedResourceId = useDebouncedValue(resourceIdDraft.trim(), 300);
  const debouncedQ = useDebouncedValue(qDraft.trim(), 300);

  const write = useCallback(
    (patch: Record<string, string | number>) =>
      router.replace(auditUrl(params, pathname, patch), { scroll: false }),
    [router, params, pathname]
  );

  // All four text filters are committed in ONE write. Firing one effect per
  // field would race: the second write would rebuild the query string from the
  // same stale `params` and silently drop the first field.
  useEffect(() => {
    if (
      debouncedActor === applied.actor &&
      debouncedAction === applied.action &&
      debouncedResourceId === applied.resourceId &&
      debouncedQ === applied.q
    ) {
      return;
    }
    write({
      actor: debouncedActor,
      action: debouncedAction,
      resourceId: debouncedResourceId,
      q: debouncedQ,
      page: "",
    });
  }, [
    debouncedActor,
    debouncedAction,
    debouncedResourceId,
    debouncedQ,
    applied.actor,
    applied.action,
    applied.resourceId,
    applied.q,
    write,
  ]);

  const audit = useAdminAudit({
    actorUserId: applied.actor || undefined,
    action: applied.action || undefined,
    resourceType: applied.resourceType || undefined,
    resourceId: applied.resourceId || undefined,
    search: applied.q || undefined,
    result: (applied.result || undefined) as AdminAuditEntry["result"] | undefined,
    page: applied.page,
    pageSize: 25,
  });

  const facets = audit.data?.facets;
  const resourceTypes = facets?.resourceTypes ?? [];
  const actions = facets?.actions ?? [];
  const totalPages = audit.data ? Math.max(1, Math.ceil(audit.data.total / audit.data.pageSize)) : 1;

  // A deep link may name a kind the log no longer holds; keep it selectable so
  // the filter is visible, rather than silently rendering "all kinds".
  const resourceTypeOptions = useMemo(
    () =>
      applied.resourceType && !resourceTypes.includes(applied.resourceType)
        ? [...resourceTypes, applied.resourceType].sort()
        : resourceTypes,
    [resourceTypes, applied.resourceType]
  );
  const actionOptions = useMemo(
    () =>
      applied.action && !actions.includes(applied.action)
        ? [...actions, applied.action].sort()
        : actions,
    [actions, applied.action]
  );

  const hasFilters = Boolean(
    applied.actor || applied.action || applied.resourceType || applied.resourceId || applied.q || applied.result
  );

  return (
    <Section
      title="رویدادهای امنیتی (ممیزی)"
      subtitle="گزارش فقط‌افزودنی همه عملیات حساس، همراه با مقدار قبلی و جدید. فیلدهای حساس هرگز ثبت نمی‌شوند."
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={qDraft}
          onChange={setQDraft}
          placeholder="جست‌وجو در کلید عمل و شناسهٔ منبع…"
          className="min-w-[220px]"
        />
        <Select
          aria-label="نوع منبع"
          value={applied.resourceType}
          onChange={(e) => write({ resourceType: e.target.value, page: "" })}
          className="min-w-[170px]"
        >
          <option value="">همهٔ انواع منبع</option>
          {resourceTypeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <TextInput
          value={resourceIdDraft}
          onChange={(e) => setResourceIdDraft(e.target.value)}
          placeholder="شناسهٔ منبع"
          aria-label="شناسهٔ منبع"
          dir="ltr"
          className="min-w-[180px]"
        />
        <Select
          aria-label="کلید عمل"
          value={applied.action}
          onChange={(e) => write({ action: e.target.value, page: "" })}
          className="min-w-[190px]"
        >
          <option value="">همهٔ عمل‌ها</option>
          {actionOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <TextInput
          value={actorDraft}
          onChange={(e) => setActorDraft(e.target.value)}
          placeholder="شناسهٔ کنشگر"
          aria-label="شناسهٔ کنشگر"
          dir="ltr"
          className="min-w-[190px]"
        />
        <Select
          aria-label="نتیجه"
          value={applied.result}
          onChange={(e) => write({ result: e.target.value, page: "" })}
          className="min-w-[140px]"
        >
          <option value="">همهٔ نتایج</option>
          <option value="success">موفق</option>
          <option value="failure">ناموفق</option>
          <option value="denied">رد شده</option>
        </Select>
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={() => router.replace(pathname, { scroll: false })}>
            پاک‌کردن فیلترها
          </Button>
        )}
      </div>

      {(applied.resourceType || applied.resourceId) && (
        <p className="mb-3 text-caption text-muted">
          محدودهٔ منبع:{" "}
          <span dir="ltr" className="font-mono text-on-surface-variant">
            {applied.resourceType || "*"}:{applied.resourceId || "*"}
          </span>
        </p>
      )}

      <StateView
        query={audit}
        loadingRows={6}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="رویدادی با این فیلتر یافت نشد."
      >
        {(data) => (
          <>
            <DataTable
              head={
                <tr>
                  <Th>زمان</Th>
                  <Th>کنشگر</Th>
                  <Th>عمل</Th>
                  <Th>منبع</Th>
                  <Th>تغییر</Th>
                  <Th>نتیجه</Th>
                  <Th>دلیل</Th>
                </tr>
              }
            >
              {data.items.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap text-caption text-muted">
                    {toRelativeTime(e.createdAt)}
                  </Td>
                  <Td>
                    <div className="flex flex-col">
                      <span className="text-caption text-on-surface-variant">{e.actorRole}</span>
                      <IdChip id={e.actorUserId} />
                    </div>
                  </Td>
                  <Td dir="ltr" className="font-mono text-caption text-on-surface-variant">
                    {e.action}
                  </Td>
                  <Td className="text-caption text-muted">
                    {/* Pinning the exact resource is the whole point of the
                        trail: one click narrows 3000 rows to this entity's
                        history. */}
                    <button
                      type="button"
                      dir="ltr"
                      title="نمایش رویدادهای همین منبع"
                      onClick={() =>
                        write({
                          resourceType: e.resourceType,
                          resourceId: e.resourceId,
                          page: "",
                        })
                      }
                      className="rounded-small px-1 text-start font-mono underline decoration-dotted underline-offset-2 transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {e.resourceType}:{e.resourceId}
                    </button>
                  </Td>
                  <Td className="text-caption text-muted">
                    <AuditDiff before={e.before} after={e.after} />
                  </Td>
                  <Td>
                    <Badge tone={RESULT_TONES[e.result]}>{RESULT_FA[e.result]}</Badge>
                  </Td>
                  <Td className="max-w-[220px]">
                    <span className="block truncate text-caption text-muted" title={e.reason ?? ""}>
                      {e.reason ?? "—"}
                    </span>
                  </Td>
                </tr>
              ))}
            </DataTable>

            <div className="mt-3 flex items-center justify-between text-caption text-muted">
              <span>{toPersianNumber(data.total)} رویداد</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={data.page <= 1}
                  onClick={() => write({ page: Math.max(1, data.page - 1) })}
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
                  onClick={() => write({ page: data.page + 1 })}
                >
                  بعدی
                </Button>
              </div>
            </div>
          </>
        )}
      </StateView>
    </Section>
  );
}
