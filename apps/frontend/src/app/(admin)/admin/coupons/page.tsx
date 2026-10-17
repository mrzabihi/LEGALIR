// ============================================================
// LEGALIR — Admin · Discount coupons (کدهای تخفیف)
// ============================================================
// The coupon catalog plus create / edit / disable / archive. The list is gated
// by `admin:billing:read`; every write needs `admin:billing:manage`. Hiding a
// button here is UX only — the admin dispatcher re-checks the permission and
// re-validates the draft server-side (lib/coupons/store + lib/admin/coupons).
//
// HARD RULES this surface honours:
//   • A coupon is NEVER physically deleted. `disable` is a reversible pause,
//     `archive` is the terminal retirement — both keep past orders/usage intact
//     (each order snapshots its own discount; a usage row denormalises the code).
//   • Editing a coupon changes only FUTURE validation. It never rewrites a
//     historical order or a past coupon_usage row.
//   • The catalog never computes a discount — pricing lives in the server quote.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAdminCoupons,
  useCreateAdminCoupon,
  useUpdateAdminCoupon,
  useSetAdminCouponStatus,
  useAdminPlans,
  useAdminMe,
} from "@/hooks/useAdmin";
import { useClientPagination } from "@/hooks/useClientPagination";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import { matchesText } from "@/lib/search/normalize";
import type { AdminCouponDraft, AdminCouponRow } from "@/lib/api/admin";
import { Checkbox, Dialog, snackbar } from "@legalir/ui";
import { COUPON_KIND_FA } from "@legalir/types";
import type { CouponKind, CouponStatus, SubscriptionPlan } from "@legalir/types";
import {
  PageHeader,
  DataTable,
  Th,
  Td,
  Badge,
  StateView,
  Button,
  TextInput,
  TextArea,
  Field,
  Select,
  InfoBanner,
  InlineNotice,
  Section,
  SearchInput,
  FilterPills,
  Pagination,
} from "@/components/admin/ui";

// ---------------------------------------------------------------------------
// Status metadata (label + colour, never colour-only)
// ---------------------------------------------------------------------------

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const STATUS_META: Record<CouponStatus, { labelFa: string; tone: BadgeTone; hint: string }> = {
  active: { labelFa: "فعال", tone: "success", hint: "کد در حال اعمال تخفیف است." },
  disabled: {
    labelFa: "غیرفعال",
    tone: "warning",
    hint: "موقتاً متوقف؛ قابل فعال‌سازی مجدد. سفارش‌های گذشته دست‌نخورده.",
  },
  archived: {
    labelFa: "بایگانی‌شده",
    tone: "neutral",
    hint: "بازنشستهٔ نهایی؛ برای تاریخچه نگه داشته می‌شود و قابل بازگشت نیست.",
  },
};

const STATUS_ORDER: CouponStatus[] = ["active", "disabled", "archived"];

const STATUS_FILTERS: { value: CouponStatus | "all"; label: string }[] = [
  { value: "all", label: "همه" },
  ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].labelFa })),
];

// A coupon is never un-archived through this surface (archive is terminal); a
// pause (disabled) is freely reversible.
const ALLOWED_STATUS_TRANSITIONS: Record<CouponStatus, CouponStatus[]> = {
  active: ["disabled", "archived"],
  disabled: ["active", "archived"],
  archived: [],
};

const KIND_ORDER: CouponKind[] = ["percent", "fixed"];

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

// ---------------------------------------------------------------------------
// Datetime <-> ISO helpers (the input is local wall-clock; the store is ISO)
// ---------------------------------------------------------------------------

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function localInputToIso(local: string): string {
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

// ---------------------------------------------------------------------------
// Draft form model
// ---------------------------------------------------------------------------

interface CouponFormDraft {
  title: string;
  code: string;
  kind: CouponKind;
  value: string;
  percentCap: string;
  /** Plan codes this coupon applies to; empty = every plan. */
  eligiblePlans: string[];
  startsAt: string;
  endsAt: string;
  minOrderAmount: string;
  totalUses: string;
  perUserLimit: string;
  status: CouponStatus;
  internalNotes: string;
}

function emptyDraft(): CouponFormDraft {
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 86_400_000);
  return {
    title: "",
    code: "",
    kind: "percent",
    value: "10",
    percentCap: "100",
    eligiblePlans: [],
    startsAt: isoToLocalInput(now.toISOString()),
    endsAt: isoToLocalInput(end.toISOString()),
    minOrderAmount: "0",
    totalUses: "0",
    perUserLimit: "0",
    status: "active",
    internalNotes: "",
  };
}

function draftFromCoupon(c: AdminCouponRow): CouponFormDraft {
  return {
    title: c.title,
    code: c.code,
    kind: c.kind,
    value: String(c.value),
    percentCap: String(c.percentCap),
    eligiblePlans: [...c.eligiblePlans],
    startsAt: isoToLocalInput(c.startsAt),
    endsAt: isoToLocalInput(c.endsAt),
    minOrderAmount: String(c.minOrderAmount),
    totalUses: String(c.totalUses),
    perUserLimit: String(c.perUserLimit),
    status: c.status,
    internalNotes: c.internalNotes,
  };
}

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

function parseNumSafe(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function parseIntSafe(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) && Number.isInteger(n) ? n : NaN;
}

type CouponFieldErrors = Partial<Record<keyof CouponFormDraft, string>>;

function validateFields(d: CouponFormDraft): CouponFieldErrors {
  const errs: CouponFieldErrors = {};
  const code = d.code.trim().toUpperCase();
  if (!code) errs.code = "کد تخفیف الزامی است.";
  else if (!CODE_RE.test(code)) {
    errs.code = "کد باید ۳ تا ۳۲ نویسه باشد و با حرف یا عدد شروع شود (فقط A–Z، ۰–۹، «-» و «_»).";
  }

  if (!d.title.trim()) errs.title = "عنوان داخلی الزامی است.";

  const value = parseNumSafe(d.value);
  if (!Number.isFinite(value) || value <= 0) errs.value = "مقدار تخفیف باید مثبت باشد.";
  else if (d.kind === "percent" && value > 100) errs.value = "درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.";

  const cap = parseNumSafe(d.percentCap);
  if (!Number.isFinite(cap) || cap <= 0 || cap > 100) {
    errs.percentCap = "سقف درصد باید بین ۱ تا ۱۰۰ باشد.";
  }

  const min = parseNumSafe(d.minOrderAmount);
  if (!Number.isFinite(min) || min < 0) errs.minOrderAmount = "حداقل مبلغ سفارش نامعتبر است.";

  const total = parseIntSafe(d.totalUses);
  if (!Number.isFinite(total) || total < 0) errs.totalUses = "سقف کل مصرف نامعتبر است.";

  const perUser = parseIntSafe(d.perUserLimit);
  if (!Number.isFinite(perUser) || perUser < 0) errs.perUserLimit = "سقف هر کاربر نامعتبر است.";

  if (!d.startsAt) errs.startsAt = "تاریخ شروع الزامی است.";
  if (!d.endsAt) errs.endsAt = "تاریخ پایان الزامی است.";
  if (d.startsAt && d.endsAt) {
    const s = new Date(d.startsAt).getTime();
    const e = new Date(d.endsAt).getTime();
    if (!Number.isNaN(s) && !Number.isNaN(e) && e < s) {
      errs.endsAt = "تاریخ پایان نمی‌تواند پیش از تاریخ شروع باشد.";
    }
  }
  return errs;
}

function hasErrors(errs: CouponFieldErrors): boolean {
  return Object.keys(errs).length > 0;
}

function buildPayload(d: CouponFormDraft): AdminCouponDraft {
  return {
    title: d.title.trim(),
    code: d.code.trim().toUpperCase(),
    kind: d.kind,
    value: parseNumSafe(d.value),
    percentCap: parseNumSafe(d.percentCap),
    eligiblePlans: d.eligiblePlans,
    startsAt: localInputToIso(d.startsAt),
    endsAt: localInputToIso(d.endsAt),
    minOrderAmount: parseNumSafe(d.minOrderAmount),
    totalUses: parseIntSafe(d.totalUses),
    perUserLimit: parseIntSafe(d.perUserLimit),
    status: d.status,
    internalNotes: d.internalNotes.trim(),
    currency: "IRT",
  };
}

/** A short human label for the discount value (percent vs fixed amount). */
function discountLabel(c: AdminCouponRow): string {
  if (c.kind === "percent") return `٪${toPersianNumber(c.value)}`;
  return `${toPersianNumber(c.value)} تومان`;
}

// ---------------------------------------------------------------------------
// Create / edit dialog
// ---------------------------------------------------------------------------

function CouponFormDialog({
  open,
  onClose,
  coupon,
}: {
  open: boolean;
  onClose: () => void;
  coupon: AdminCouponRow | null;
}) {
  const isCreate = coupon === null;
  const plansQuery = useAdminPlans();
  const create = useCreateAdminCoupon();
  const update = useUpdateAdminCoupon();

  const [draft, setDraft] = useState<CouponFormDraft>(() =>
    coupon ? draftFromCoupon(coupon) : emptyDraft()
  );
  const [fieldErrors, setFieldErrors] = useState<CouponFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Re-seed the form whenever the dialog opens for a (possibly different) coupon.
  useEffect(() => {
    if (open) {
      setDraft(coupon ? draftFromCoupon(coupon) : emptyDraft());
      setFieldErrors({});
      setError(null);
    }
  }, [open, coupon]);

  const plans: SubscriptionPlan[] = plansQuery.data?.items ?? [];
  const pending = create.isPending || update.isPending;

  function set(patch: Partial<CouponFormDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function togglePlan(code: string) {
    setDraft((prev) => ({
      ...prev,
      eligiblePlans: prev.eligiblePlans.includes(code)
        ? prev.eligiblePlans.filter((p) => p !== code)
        : [...prev.eligiblePlans, code],
    }));
  }

  const dirty = useMemo(() => {
    const base = coupon ? draftFromCoupon(coupon) : emptyDraft();
    return JSON.stringify(base) !== JSON.stringify(draft);
  }, [coupon, draft]);

  function requestClose() {
    if (pending) return;
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  function close() {
    setConfirmDiscard(false);
    onClose();
  }

  async function doSave() {
    const errs = validateFields(draft);
    if (hasErrors(errs)) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setError(null);
    try {
      const payload = buildPayload(draft);
      if (isCreate) {
        const created = await create.mutateAsync(payload);
        snackbar.show({ message: `کد تخفیف «${created.code}» ساخته شد.`, variant: "success" });
      } else {
        const updated = await update.mutateAsync({ id: coupon.id, input: payload });
        snackbar.show({
          message: `کد «${updated.code}» به‌روزرسانی شد. سفارش‌های گذشته دست‌نخورده می‌مانند.`,
          variant: "success",
        });
      }
      close();
    } catch (err) {
      setError(errMessage(err, "ذخیرهٔ کد تخفیف ناموفق بود."));
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        title={isCreate ? "ایجاد کد تخفیف" : `ویرایش کد ${coupon?.code ?? ""}`}
        description={
          isCreate
            ? "کد تخفیف را بسازید. پس از ذخیره، این کد در اعتبارسنجی پرداخت قابل استفاده است."
            : "ویرایش کد فقط اعتبارسنجی پیشِ‌رو را تغییر می‌دهد؛ سفارش‌ها و مصرف‌های گذشته ثابت می‌مانند."
        }
        maxWidth="4xl"
        actions={
          <>
            <Button variant="ghost" onClick={requestClose} disabled={pending}>
              انصراف
            </Button>
            <Button variant="primary" onClick={doSave} disabled={pending}>
              {pending ? "در حال ذخیره…" : isCreate ? "ایجاد کد" : "ذخیره تغییرات"}
            </Button>
          </>
        }
      >
        {error && <InlineNotice tone="error">{error}</InlineNotice>}

        <Section title="اطلاعات داخلی">
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 tablet:grid-cols-2">
            <Field
              label="عنوان داخلی"
              required
              error={fieldErrors.title}
              hint="فقط برای کارکنان؛ به کاربر نمایش داده نمی‌شود."
            >
              <TextInput
                value={draft.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="کمپین نوروز"
                aria-invalid={Boolean(fieldErrors.title)}
              />
            </Field>
            <Field
              label="کد تخفیف"
              required
              error={fieldErrors.code}
              hint="۳ تا ۳۲ نویسه؛ فقط حروف بزرگ، عدد، «-» و «_». کد با حروف بزرگ و بدون فاصله یکتا می‌شود."
            >
              <TextInput
                dir="ltr"
                value={draft.code}
                onChange={(e) => set({ code: e.target.value.toUpperCase() })}
                placeholder="NOWRUZ25"
                aria-invalid={Boolean(fieldErrors.code)}
              />
            </Field>
            <Field label="وضعیت" hint="وضعیت اعتبار کد در اعتبارسنجی پرداخت.">
              <Select
                value={draft.status}
                onChange={(e) => set({ status: e.target.value as CouponStatus })}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].labelFa}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Section>

        <Section title="تخفیف">
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 tablet:grid-cols-2">
            <Field label="نوع تخفیف" required>
              <Select
                value={draft.kind}
                onChange={(e) => set({ kind: e.target.value as CouponKind })}
              >
                {KIND_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {COUPON_KIND_FA[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={draft.kind === "percent" ? "مقدار (درصد)" : "مقدار (تومان)"}
              required
              error={fieldErrors.value}
              hint={
                draft.kind === "percent"
                  ? "درصد تخفیف از مبلغ پایه (۱ تا ۱۰۰)."
                  : "مبلغ ثابت تخفیف به تومان؛ در محاسبه هرگز منفی نمی‌شود."
              }
            >
              <TextInput
                type="number"
                min={1}
                max={draft.kind === "percent" ? 100 : undefined}
                value={draft.value}
                onChange={(e) => set({ value: e.target.value })}
                aria-invalid={Boolean(fieldErrors.value)}
              />
            </Field>
            <Field
              label="سقف درصد"
              error={fieldErrors.percentCap}
              hint="حداکثر درصد تخفیف مؤثر (۱ تا ۱۰۰). روی هر دو نوع پس از محدودسازی اعمال می‌شود."
            >
              <TextInput
                type="number"
                min={1}
                max={100}
                value={draft.percentCap}
                onChange={(e) => set({ percentCap: e.target.value })}
                aria-invalid={Boolean(fieldErrors.percentCap)}
              />
            </Field>
            <Field
              label="حداقل مبلغ سفارش (تومان)"
              error={fieldErrors.minOrderAmount}
              hint="صفر یعنی بدون حداقل."
            >
              <TextInput
                type="number"
                min={0}
                value={draft.minOrderAmount}
                onChange={(e) => set({ minOrderAmount: e.target.value })}
                aria-invalid={Boolean(fieldErrors.minOrderAmount)}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="پلن‌های مجاز"
          subtitle="اگر هیچ پلنی انتخاب نشود، کد روی همهٔ پلن‌ها معتبر است."
        >
          {plansQuery.isLoading ? (
            <p className="text-body-2 text-muted">در حال بارگذاری پلن‌ها…</p>
          ) : plans.length === 0 ? (
            <p className="text-body-2 text-muted">پلنی یافت نشد.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 tablet:grid-cols-2 desktop:grid-cols-3">
              {plans.map((p) => (
                <div
                  key={p.code}
                  className="flex items-center gap-2 rounded-large border border-divider px-3 py-2.5"
                >
                  <Checkbox
                    label={<span className="truncate">{p.nameFa}</span>}
                    checked={draft.eligiblePlans.includes(p.code)}
                    onChange={() => togglePlan(p.code)}
                    className="min-w-0"
                  />
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="بازهٔ اعتبار">
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 tablet:grid-cols-2">
            <Field label="شروع" required error={fieldErrors.startsAt}>
              <TextInput
                type="datetime-local"
                value={draft.startsAt}
                onChange={(e) => set({ startsAt: e.target.value })}
                aria-invalid={Boolean(fieldErrors.startsAt)}
              />
            </Field>
            <Field label="پایان" required error={fieldErrors.endsAt}>
              <TextInput
                type="datetime-local"
                value={draft.endsAt}
                onChange={(e) => set({ endsAt: e.target.value })}
                aria-invalid={Boolean(fieldErrors.endsAt)}
              />
            </Field>
          </div>
        </Section>

        <Section title="سهمیهٔ مصرف">
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 tablet:grid-cols-2">
            <Field label="سقف کل مصرف" error={fieldErrors.totalUses} hint="صفر یعنی نامحدود.">
              <TextInput
                type="number"
                min={0}
                value={draft.totalUses}
                onChange={(e) => set({ totalUses: e.target.value })}
                aria-invalid={Boolean(fieldErrors.totalUses)}
              />
            </Field>
            <Field label="سقف هر کاربر" error={fieldErrors.perUserLimit} hint="صفر یعنی نامحدود.">
              <TextInput
                type="number"
                min={0}
                value={draft.perUserLimit}
                onChange={(e) => set({ perUserLimit: e.target.value })}
                aria-invalid={Boolean(fieldErrors.perUserLimit)}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="یادداشت داخلی" hint="فقط برای کارکنان؛ هرگز به کاربر نمایش داده نمی‌شود.">
              <TextArea
                rows={3}
                value={draft.internalNotes}
                onChange={(e) => set({ internalNotes: e.target.value })}
                placeholder="مثلاً: بازگشت وجه تا پایان فصل، فقط برای پلن سالانه."
              />
            </Field>
          </div>
        </Section>
      </Dialog>

      {/* Unsaved-changes warning — closes only on explicit discard. */}
      <Dialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="تغییرات ذخیره‌نشده"
        description="تغییرات این فرم ذخیره نشده است. با بستن، این تغییرات از دست می‌رود."
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmDiscard(false)}>
              بازگشت به فرم
            </Button>
            <Button variant="danger" onClick={close}>
              بستن بدون ذخیره
            </Button>
          </>
        }
      >
        <p className="text-body-2 text-on-surface-variant">
          اگر می‌خواهید تغییرات را نگه دارید، «بازگشت به فرم» را بزنید و سپس ذخیره کنید.
        </p>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminCouponsPage() {
  const { can } = useAdminMe();
  const canManage = can("admin:billing:manage");
  const coupons = useAdminCoupons();
  const plansQuery = useAdminPlans();
  const setStatus = useSetAdminCouponStatus();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CouponStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AdminCouponRow | null>(null);

  const planNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of plansQuery.data?.items ?? []) map.set(p.code, p.nameFa);
    return map;
  }, [plansQuery.data]);

  const visible = useMemo(() => {
    const rows = coupons.data?.items ?? [];
    return rows
      .filter((c) => (statusFilter === "all" ? true : c.status === statusFilter))
      .filter(
        (c) =>
          !search.trim() ||
          // Shared normalisation lane (Persian/Arabic digits + letter forms).
          matchesText(search, c.code, c.title, ...(c.eligiblePlans ?? []))
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [coupons.data, search, statusFilter]);

  const pager = useClientPagination(visible);
  const { reset: resetPager } = pager;
  useEffect(() => {
    resetPager();
  }, [resetPager, search, statusFilter]);

  async function changeStatus(id: string, status: CouponStatus) {
    try {
      await setStatus.mutateAsync({ id, status });
      snackbar.show({
        message: `وضعیت کد تخفیف به «${STATUS_META[status].labelFa}» تغییر کرد.`,
        variant: "success",
      });
    } catch (err) {
      snackbar.show({ message: errMessage(err, "تغییر وضعیت ناموفق بود."), variant: "error" });
    }
  }

  const editTarget = editId
    ? (coupons.data?.items ?? []).find((c) => c.id === editId) ?? null
    : null;

  return (
    <div>
      <PageHeader
        title="کدهای تخفیف"
        description="کاتالوگ کدهای تخفیف و سهمیهٔ مصرف. ویرایش کد فقط اعتبارسنجی پیشِ‌رو را تغییر می‌دهد؛ سفارش‌های گذشته دست‌نخورده می‌مانند."
        actions={
          canManage && (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              ایجاد کد تخفیف
            </Button>
          )
        }
      />

      {!canManage && (
        <InfoBanner tone="info">
          ساخت و ویرایش کد تخفیف نیازمند مجوز مدیریت صورت‌حساب است؛ در این نما فقط‌خواندنی می‌توانید
          کاتالوگ و آمار مصرف را ببینید.
        </InfoBanner>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="جست‌وجوی کد، عنوان یا پلن…" />
        <FilterPills options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
      </div>

      <StateView
        query={coupons}
        loadingRows={4}
        isEmpty={() => visible.length === 0}
        emptyMessage="کد تخفیفی با این فیلتر یافت نشد."
      >
        {() => (
          <>
          <DataTable
            head={
              <tr>
                <Th>کد / عنوان</Th>
                <Th>وضعیت</Th>
                <Th>تخفیف</Th>
                <Th>پلن‌های مجاز</Th>
                <Th>اعتبار</Th>
                <Th>مصرف</Th>
                <Th>اقدام‌ها</Th>
              </tr>
            }
          >
            {pager.pageItems.map((c) => {
              const meta = STATUS_META[c.status];
              const transitions = ALLOWED_STATUS_TRANSITIONS[c.status];
              const totalLabel = c.totalUses === 0 ? "نامحدود" : toPersianNumber(c.totalUses);
              return (
                <tr key={c.id}>
                  <Td>
                    <span className="font-medium text-on-surface" dir="ltr">
                      {c.code}
                    </span>
                    <span className="block text-caption text-muted">{c.title}</span>
                  </Td>
                  <Td>
                    <Badge tone={meta.tone} dot title={meta.hint}>
                      {meta.labelFa}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className="tabular-nums font-medium text-on-surface">
                      {discountLabel(c)}
                    </span>
                    <span className="block text-caption text-muted">
                      {COUPON_KIND_FA[c.kind]} · سقف ٪{toPersianNumber(c.percentCap)}
                    </span>
                    {c.minOrderAmount > 0 && (
                      <span className="block text-caption text-muted">
                        حداقل {toPersianNumber(c.minOrderAmount)} تومان
                      </span>
                    )}
                  </Td>
                  <Td className="text-body-2 text-on-surface-variant">
                    {(c.eligiblePlans ?? []).length === 0 ? (
                      "همهٔ پلن‌ها"
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {c.eligiblePlans.map((code) => (
                          <Badge key={code} tone="brand">
                            {planNameByCode.get(code) ?? code}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-caption text-muted">
                    <span className="block">{toPersianDate(c.startsAt)}</span>
                    <span className="block">تا {toPersianDate(c.endsAt)}</span>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums text-body-2 text-on-surface-variant">
                    <span className="font-medium text-on-surface">
                      {toPersianNumber(c.usageCount)}
                    </span>
                    <span className="text-muted"> / {totalLabel}</span>
                    {c.perUserLimit > 0 && (
                      <span className="block text-caption text-muted">
                        هر کاربر {toPersianNumber(c.perUserLimit)}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => setEditId(c.id)}>
                        ویرایش
                      </Button>
                      {canManage &&
                        transitions.map((t) => (
                          <Button
                            key={t}
                            size="sm"
                            variant={t === "active" ? "tonal" : "ghost"}
                            disabled={setStatus.isPending}
                            onClick={() => {
                              if (t === "archived") setArchiveTarget(c);
                              else void changeStatus(c.id, t);
                            }}
                          >
                            {t === "active" ? "فعال‌سازی" : t === "disabled" ? "غیرفعال" : "بایگانی"}
                          </Button>
                        ))}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </DataTable>

          <Pagination
            page={pager.page}
            pageSize={pager.pageSize}
            total={pager.total}
            totalPages={pager.totalPages}
            itemLabel="کد تخفیف"
            onPageChange={pager.setPage}
            onPageSizeChange={pager.setPageSize}
          />
          </>
        )}
      </StateView>

      {canManage && createOpen && (
        <CouponFormDialog open onClose={() => setCreateOpen(false)} coupon={null} />
      )}
      {canManage && editTarget && (
        <CouponFormDialog
          key={editTarget.id}
          open
          onClose={() => setEditId(null)}
          coupon={editTarget}
        />
      )}

      <Dialog
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        title="بایگانی کد تخفیف"
        description="کد بایگانی‌شده بازنشستهٔ نهایی است و دیگر اعمال نمی‌شود؛ اما حذف فیزیکی نمی‌شود تا سفارش‌های گذشته و مصرف‌ها حفظ شوند."
        actions={
          <>
            <Button variant="ghost" onClick={() => setArchiveTarget(null)}>
              انصراف
            </Button>
            <Button
              variant="danger"
              disabled={setStatus.isPending}
              onClick={() => {
                const target = archiveTarget;
                setArchiveTarget(null);
                if (target) void changeStatus(target.id, "archived");
              }}
            >
              بایگانی کن
            </Button>
          </>
        }
      >
        <p className="text-body-2 text-on-surface-variant">
          آیا از بایگانی کد «{archiveTarget?.code}» مطمئن هستید؟ این کد برای تاریخچه نگه داشته می‌شود
          و از این پس در پرداخت‌ها اعمال نمی‌شود.
        </p>
      </Dialog>
    </div>
  );
}
