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
//                       key and result, with the real before → after diff.
//
// Mobiles are shown MASKED. The audit log never carries secrets.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "@/components/admin/ui";
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

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const staff = useAdminStaff({
    search: debouncedSearch || undefined,
    role: roleFilter || undefined,
  });
  const roles = useAdminRoles();
  const changeRole = useChangeStaffRole();

  const [editing, setEditing] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  // Audit filters
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [result, setResult] = useState<string>("");
  const [page, setPage] = useState(1);

  const debouncedActor = useDebouncedValue(actor.trim(), 300);
  const debouncedAction = useDebouncedValue(action.trim(), 300);
  useEffect(() => setPage(1), [debouncedActor, debouncedAction]);

  const audit = useAdminAudit({
    actorUserId: debouncedActor || undefined,
    action: debouncedAction || undefined,
    result: (result || undefined) as AdminAuditEntry["result"] | undefined,
    page,
    pageSize: 25,
  });

  const roleOptions = useMemo(
    () => ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_FA[r] ?? r })),
    []
  );

  const totalPages = audit.data
    ? Math.max(1, Math.ceil(audit.data.total / audit.data.pageSize))
    : 1;

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
        actions={<ExportButton kind="audit" />}
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
          {(data) => (
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
              {data.items.map((m: StaffMember) => (
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

      {/* ----- Audit / security events ----- */}
      <Section
        title="رویدادهای امنیتی (ممیزی)"
        subtitle="گزارش فقط‌افزودنی همه عملیات حساس، همراه با مقدار قبلی و جدید. فیلدهای حساس هرگز ثبت نمی‌شوند."
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <TextInput
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="شناسه کنشگر"
            className="min-w-[200px]"
          />
          <TextInput
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="کلید عمل (مثلاً plan.update)"
            className="min-w-[200px]"
          />
          <Select
            value={result}
            onChange={(e) => {
              setResult(e.target.value);
              setPage(1);
            }}
            className="min-w-[140px]"
          >
            <option value="">همه نتایج</option>
            <option value="success">موفق</option>
            <option value="failure">ناموفق</option>
            <option value="denied">رد شده</option>
          </Select>
        </div>

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
                      <span dir="ltr">
                        {e.resourceType}:{e.resourceId}
                      </span>
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
            </>
          )}
        </StateView>
      </Section>

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
