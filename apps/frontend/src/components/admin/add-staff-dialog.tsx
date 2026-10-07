// ============================================================
// LEGALIR — Admin · Add staff (promote an existing user)
// ============================================================
// In this platform users self-register (OTP signup) and staff status is a
// ROLE assignment, not a separate account type. So "adding a staff member"
// means finding an existing user and granting them a platform-staff role —
// there is no parallel "create staff" backend, and none is invented here.
//
// It composes the real endpoints the panel already uses:
//   • GET  /admin/users            → search the user directory (admin:users:read)
//   • PATCH /admin/users/:id {role} → assign the role (admin:users:manage)
// The same server lockout guard (last role-manager cannot be demoted) applies.
// ============================================================

"use client";

import { useState } from "react";
import { Dialog, snackbar } from "@legalir/ui";
import { useAdminUsers, useChangeStaffRole } from "@/hooks/useAdmin";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ROLE_FA, STAFF_ROLES, type PlatformRole } from "@legalir/types";
import type { AdminUserRow } from "@/lib/api/admin";
import { toPersianNumber } from "@/lib/persian-utils";
import { Badge, Button, Field, SearchInput, Select, LoadingBlock } from "@/components/admin/ui";

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

export function AddStaffDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<PlatformRole | "">("");
  const [error, setError] = useState<string | null>(null);

  const q = useDebouncedValue(search.trim(), 300);
  const users = useAdminUsers({ search: q || undefined, pageSize: 10 });
  const changeRole = useChangeStaffRole();

  function reset() {
    setSearch("");
    setUserId("");
    setRole("");
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit() {
    if (!userId) {
      setError("یک کاربر را از فهرست انتخاب کنید.");
      return;
    }
    if (!role) {
      setError("نقش کارمندی را انتخاب کنید.");
      return;
    }
    setError(null);
    try {
      await changeRole.mutateAsync({ userId, role });
      snackbar.show({ message: "کارمند افزوده شد.", variant: "success" });
      close();
    } catch (err) {
      setError(errMessage(err, "افزودن کارمند ناموفق بود."));
    }
  }

  const items: AdminUserRow[] = users.data?.items ?? [];
  const selected = items.find((u) => u.id === userId);

  return (
    <Dialog
      open={open}
      onClose={close}
      title="افزودن کارمند"
      description="کاربری را از فهرست کاربران پلتفرم انتخاب و به آن نقش کارمندی بدهید."
      maxWidth="lg"
      actions={
        <>
          <Button variant="ghost" onClick={close} disabled={changeRole.isPending}>
            انصراف
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={changeRole.isPending || !userId || !role}
          >
            {changeRole.isPending ? "در حال ذخیره…" : "افزودن کارمند"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <SearchInput value={search} onChange={setSearch} placeholder="جست‌وجوی نام یا موبایل…" />

        <div className="max-h-64 overflow-y-auto rounded-medium border border-divider">
          {users.isLoading ? (
            <LoadingBlock rows={3} />
          ) : items.length === 0 ? (
            <p className="p-4 text-center text-body-2 text-muted">کاربری با این عبارت یافت نشد.</p>
          ) : (
            <ul className="divide-y divide-divider">
              {items.map((u) => {
                const active = u.id === userId;
                const isStaff = STAFF_ROLES.includes(u.role);
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setUserId(u.id);
                        setError(null);
                      }}
                      aria-pressed={active}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start transition-colors ${
                        active ? "bg-primary-soft" : "hover:bg-surface-hover"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-body-2 font-medium text-on-surface">
                          {u.displayName ?? "بدون نام"}
                        </span>
                        <span dir="ltr" className="block text-caption tabular-nums text-muted">
                          {u.mobileMasked}
                        </span>
                      </span>
                      <Badge tone={isStaff ? "brand" : "neutral"}>{ROLE_FA[u.role] ?? u.role}</Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Field
          label="نقش کارمندی"
          hint={
            selected
              ? `کاربر «${selected.displayName ?? "بدون نام"}» این نقش را دریافت می‌کند.`
              : "ابتدا یک کاربر را انتخاب کنید."
          }
          error={error ?? undefined}
        >
          <Select
            value={role}
            onChange={(e) => {
              setRole(e.target.value as PlatformRole);
              setError(null);
            }}
          >
            <option value="">انتخاب نقش…</option>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_FA[r] ?? r}
              </option>
            ))}
          </Select>
        </Field>

        <p className="text-caption leading-relaxed text-muted">
          {toPersianNumber(STAFF_ROLES.length)} نقش کارمندی موجود است. آخرین مدیری که مجوز مدیریت
          کارکنان را دارد قابل تنزل نیست؛ این محدودیت سمت سرور اعمال می‌شود.
        </p>
      </div>
    </Dialog>
  );
}
