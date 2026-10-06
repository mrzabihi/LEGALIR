// ============================================================
// LEGALIR — Admin · Admins, Roles & Security Events
//              (مدیران، نقش‌ها و رویدادهای امنیتی)
// ============================================================
// Three related surfaces on one page:
//   • Staff           — platform staff and their role. A super-admin
//                       (admin:staff:manage) can change a role; the LAST
//                       super-admin is protected server-side.
//   • Role matrix     — every role and the permissions it grants, straight
//                       from the shared ROLE_PERMISSIONS map.
//   • Security events — the append-only audit log, filterable by actor,
//                       action key and result (success / failure / denied).
//
// Mobiles are shown MASKED (server-owned). The audit log never carries
// secrets, passwords, OTPs or full bank data — only redacted field diffs.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import {
  useAdminStaff,
  useAdminRoles,
  useChangeStaffRole,
  useAdminAudit,
  useAdminMe,
} from "@/hooks/useAdmin";
import { toPersianNumber, toRelativeTime } from "@/lib/persian-utils";
import { ROLE_FA, STAFF_ROLES } from "@legalir/types";
import type { PlatformRole, AdminAuditEntry } from "@legalir/types";
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
  InfoBanner,
  Section,
  IdChip,
} from "@/components/admin/ui";

const ASSIGNABLE_ROLES: PlatformRole[] = [
  "USER",
  "LAWYER",
  "COMPANY_OWNER",
  "COMPANY_ADMIN",
  "COMPANY_MEMBER",
  ...STAFF_ROLES,
];

const RESULT_TONES: Record<
  AdminAuditEntry["result"],
  "success" | "danger" | "warning"
> = {
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

export default function AdminStaffPage() {
  const { can } = useAdminMe();
  const canManage = can("admin:staff:manage");

  const staff = useAdminStaff();
  const roles = useAdminRoles();
  const changeRole = useChangeStaffRole();

  const [editing, setEditing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  // Audit filters
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [result, setResult] = useState<string>("");
  const [page, setPage] = useState(1);

  const audit = useAdminAudit({
    actorUserId: actor || undefined,
    action: action || undefined,
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
        description="کارکنان پلتفرم، ماتریس دسترسی نقش‌ها و گزارش رویدادهای امنیتی. تغییر نقش نیازمند مجوز مدیریت کارکنان است و سرور آن را مجوزسنجی می‌کند."
      />

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

      {!canManage && (
        <InfoBanner tone="warning">
          شما مجوز مدیریت کارکنان را ندارید؛ فهرست کارکنان فقط‌خواندنی است.
        </InfoBanner>
      )}

      {/* ----- Staff ----- */}
      <Section title="کارکنان پلتفرم" subtitle="کاربرانی با نقش کارمندی و نقش فعلی آن‌ها.">
        <StateView
          query={staff}
          loadingRows={4}
          isEmpty={(d) => d.items.length === 0}
          emptyMessage="کارمندی ثبت نشده است."
        >
          {(data) => (
            <DataTable
              head={
                <tr>
                  <Th>نام</Th>
                  <Th>شماره</Th>
                  <Th>نقش</Th>
                  <Th>سازمان</Th>
                  {canManage && <Th>عملیات</Th>}
                </tr>
              }
            >
              {data.items.map((m) => (
                <tr key={m.id}>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-medium text-on-surface">
                        {m.displayName ?? "بدون نام"}
                      </span>
                      <IdChip id={m.id} />
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
                  {canManage && (
                    <Td>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(m.id)}>
                        تغییر نقش
                      </Button>
                    </Td>
                  )}
                </tr>
              ))}
            </DataTable>
          )}
        </StateView>
      </Section>

      {/* ----- Role matrix ----- */}
      <Section
        title="ماتریس نقش و دسترسی"
        subtitle="هر نقش و مجوزهایی که سرور برای آن اعمال می‌کند."
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
                  <Th>مجوزها</Th>
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
                  <Td className="max-w-[420px]">
                    <div className="flex flex-wrap gap-1">
                      {r.permissions.length === 0 ? (
                        <span className="text-caption text-muted">—</span>
                      ) : (
                        r.permissions.map((p) => (
                          <span
                            key={p}
                            dir="ltr"
                            className="rounded-full border border-divider px-2 py-0.5 font-mono text-caption text-muted"
                          >
                            {p}
                          </span>
                        ))
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </DataTable>
          )}
        </StateView>
      </Section>

      {/* ----- Audit / security events ----- */}
      <Section
        title="رویدادهای امنیتی (ممیزی)"
        subtitle="گزارش فقط‌افزودنی همه عملیات حساس. فیلدهای حساس هرگز در این گزارش ثبت نمی‌شوند."
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <TextInput
            value={actor}
            onChange={(e) => {
              setActor(e.target.value);
              setPage(1);
            }}
            placeholder="شناسه کنشگر"
            className="min-w-[200px]"
          />
          <TextInput
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
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
        توجه: آخرین مدیر ارشد پلتفرم قابل تنزل نیست؛ این محدودیت سمت سرور اعمال می‌شود تا
        دسترسی مدیریتی از دست نرود.
      </Card>
    </div>
  );
}
