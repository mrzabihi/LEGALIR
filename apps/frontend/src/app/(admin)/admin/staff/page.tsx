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
import { usePathname, useSearchParams } from "next/navigation";
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

/** The filter set, mirrored into the address bar so it can be shared. */
interface AuditFilters {
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  q: string;
  result: string;
  page: number;
}

const EMPTY_FILTERS: AuditFilters = {
  actor: "",
  action: "",
  resourceType: "",
  resourceId: "",
  q: "",
  result: "",
  page: 1,
};

/** Read a deep link out of the address bar. */
function readFilters(params: { get(key: string): string | null }): AuditFilters {
  return {
    actor: params.get("actor") ?? "",
    action: params.get("action") ?? "",
    resourceType: params.get("resourceType") ?? "",
    resourceId: params.get("resourceId") ?? "",
    q: params.get("q") ?? "",
    result: params.get("result") ?? "",
    page: Math.max(1, Number(params.get("page") ?? 1) || 1),
  };
}

/**
 * Serialise the filters, dropping anything at its default. An operator who
 * clears a box should not be left with `&actor=` residue in the address they
 * copy out of the bar.
 */
function toQueryString(f: AuditFilters): string {
  const next = new URLSearchParams();
  if (f.actor) next.set("actor", f.actor);
  if (f.action) next.set("action", f.action);
  if (f.resourceType) next.set("resourceType", f.resourceType);
  if (f.resourceId) next.set("resourceId", f.resourceId);
  if (f.q) next.set("q", f.q);
  if (f.result) next.set("result", f.result);
  if (f.page > 1) next.set("page", String(f.page));
  return next.toString();
}

/**
 * The append-only security trail.
 *
 * The URL is the ENTRY point, not the live source of truth: a dossier
 * elsewhere in the panel links straight to the events for one entity
 * (`?resourceType=organization&resourceId=…`), and this section seeds its
 * state from that address on mount. Afterwards the local state drives the
 * query and the address is kept in sync with `history.replaceState` — which
 * does NOT run a Next.js navigation, so filtering here cannot remount the
 * page or reset the sibling staff directory beside it.
 *
 * The resource-kind and action dropdowns are built from the facets the log
 * actually contains — never a static catalog that could offer an empty filter.
 */
function SecurityEventsSection() {
  const params = useSearchParams();
  const pathname = usePathname();

  const [filters, setFilters] = useState<AuditFilters>(() => readFilters(params));
  const { actor, action, resourceType, resourceId, q, result, page } = filters;

  // Text boxes keep their own draft so typing stays instant; the debounced
  // value is what reaches the query.
  const [actorDraft, setActorDraft] = useState(actor);
  const [resourceIdDraft, setResourceIdDraft] = useState(resourceId);
  const [qDraft, setQDraft] = useState(q);
  const debouncedActor = useDebouncedValue(actorDraft.trim(), 300);
  const debouncedResourceId = useDebouncedValue(resourceIdDraft.trim(), 300);
  const debouncedQ = useDebouncedValue(qDraft.trim(), 300);

  const patch = useCallback((next: Partial<AuditFilters>) => {
    setFilters((f) => {
      const merged = { ...f, ...next };
      // Any change other than paging restarts the list at page 1 — page 7 of
      // the old filter is meaningless under a new one.
      if (next.page === undefined) merged.page = 1;
      return merged;
    });
  }, []);

  // Commit the debounced text fields together, so two boxes typed in quick
  // succession do not clobber one another.
  useEffect(() => {
    setFilters((f) =>
      f.actor === debouncedActor && f.resourceId === debouncedResourceId && f.q === debouncedQ
        ? f
        : { ...f, actor: debouncedActor, resourceId: debouncedResourceId, q: debouncedQ, page: 1 }
    );
  }, [debouncedActor, debouncedResourceId, debouncedQ]);

  // Mirror the filters into the address without navigating.
  useEffect(() => {
    const qs = toQueryString(filters);
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }, [filters, pathname]);

  const audit = useAdminAudit({
    actorUserId: actor || undefined,
    action: action || undefined,
    resourceType: resourceType || undefined,
    resourceId: resourceId || undefined,
    search: q || undefined,
    result: (result || undefined) as AdminAuditEntry["result"] | undefined,
    page,
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
      resourceType && !resourceTypes.includes(resourceType)
        ? [...resourceTypes, resourceType].sort()
        : resourceTypes,
    [resourceTypes, resourceType]
  );
  const actionOptions = useMemo(
    () => (action && !actions.includes(action) ? [...actions, action].sort() : actions),
    [actions, action]
  );

  const hasFilters = Boolean(actor || action || resourceType || resourceId || q || result);

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setActorDraft("");
    setResourceIdDraft("");
    setQDraft("");
  }

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
          value={resourceType}
          onChange={(e) => patch({ resourceType: e.target.value })}
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
          value={action}
          onChange={(e) => patch({ action: e.target.value })}
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
          value={result}
          onChange={(e) => patch({ result: e.target.value })}
          className="min-w-[140px]"
        >
          <option value="">همهٔ نتایج</option>
          <option value="success">موفق</option>
          <option value="failure">ناموفق</option>
          <option value="denied">رد شده</option>
        </Select>
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            پاک‌کردن فیلترها
          </Button>
        )}
      </div>

      {(resourceType || resourceId) && (
        <p className="mb-3 text-caption text-muted">
          محدودهٔ منبع:{" "}
          <span dir="ltr" className="font-mono text-on-surface-variant">
            {resourceType || "*"}:{resourceId || "*"}
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
                        patch({ resourceType: e.resourceType, resourceId: e.resourceId })
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
                  onClick={() => patch({ page: Math.max(1, data.page - 1) })}
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
                  onClick={() => patch({ page: data.page + 1 })}
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
