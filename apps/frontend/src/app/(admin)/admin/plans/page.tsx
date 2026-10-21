// ============================================================
// LEGALIR — Admin · Plans, Subscription & Quota (پلن‌ها، اشتراک و سهمیه)
// ============================================================
// The plan catalog plus create/manage. Building, editing, publishing and
// archiving a plan requires `admin:system:manage` (a super-admin capability);
// everyone with `admin:plans:read` sees the catalog read-only. Every write is
// re-checked server-side (lib/rbac.ts) — hiding a button here is UX only.
//
// Editing a plan writes a field-level audit entry in the same pass and NEVER
// retroactively changes live subscriptions (each carries a frozen
// `planSnapshot` taken at purchase time). A plan is never hard-deleted; it is
// deactivated or archived instead so its order/subscription history stands.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAdminPlans,
  useAdminPlan,
  useUpdateAdminPlan,
  useCreateAdminPlan,
  useSetAdminPlanStatus,
  useAdminReports,
  useAdminMe,
} from "@/hooks/useAdmin";
import { useClientPagination } from "@/hooks/useClientPagination";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import { matchesText } from "@/lib/search/normalize";
import { computeDiscountPercent, applyDiscount, type DiscountKind } from "@/lib/usage/plan-pricing";
import type { AdminPlanUpdate, AdminPlanCreateInput } from "@/lib/api/admin";
import type { Plan, PlanStatus, SubscriptionPlan } from "@legalir/types";
import { Dialog, SwitchRow, snackbar } from "@legalir/ui";
import { PlanCard } from "@/components/subscription/plan-card";
import {
  StackedBarChart,
  ChartFrame,
  ChartSkeleton,
  ChartEmpty,
  type StackRow,
  type StackSegment,
} from "@/components/admin/charts";
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
  ExportButton,
  Pagination,
} from "@/components/admin/ui";

// ---------------------------------------------------------------------------
// Status metadata (label + colour, never colour-only)
// ---------------------------------------------------------------------------

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const STATUS_META: Record<PlanStatus, { labelFa: string; tone: BadgeTone; hint: string }> = {
  draft: { labelFa: "پیش‌نویس", tone: "neutral", hint: "در حال آماده‌سازی؛ قابل خرید نیست." },
  active: { labelFa: "فعال", tone: "success", hint: "برای خرید کاربران در دسترس است." },
  inactive: {
    labelFa: "غیرفعال",
    tone: "warning",
    hint: "خرید جدید متوقف است؛ اشتراک‌های موجود دست‌نخورده.",
  },
  archived: { labelFa: "بایگانی", tone: "neutral", hint: "بازنشسته؛ تاریخچه حفظ می‌شود." },
};

const STATUS_ORDER: PlanStatus[] = ["active", "draft", "inactive", "archived"];

const STATUS_FILTERS: { value: PlanStatus | "all"; label: string }[] = [
  { value: "all", label: "همه" },
  ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].labelFa })),
];

const ALLOWED_STATUS_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  draft: ["active", "archived"],
  active: ["inactive", "archived"],
  inactive: ["active", "archived"],
  archived: [],
};

/**
 * The period a plan is sold for, worded from its real `durationDays`. Whole
 * years and whole months read as such; anything else stays in days so the
 * label never rounds a 31-day plan into «یک‌ماهه».
 */
function periodLabelFa(days: number): string {
  if (days >= 365 && days % 365 === 0) {
    const years = days / 365;
    return years === 1 ? "یک‌ساله" : `${toPersianNumber(years)} ساله`;
  }
  if (days >= 60 && days % 30 === 0) {
    return `${toPersianNumber(days / 30)} ماهه`;
  }
  return `${toPersianNumber(days)} روزه`;
}

/** The impact of a status change, stated before the operator confirms it. */
const STATUS_IMPACT_FA: Partial<Record<PlanStatus, string>> = {
  active:
    "پلن بلافاصله در صفحهٔ اشتراک برای خرید نمایش داده می‌شود. اشتراک‌های خریداری‌شده تغییری نمی‌کنند.",
  inactive:
    "خرید جدید این پلن متوقف می‌شود؛ اشتراک‌های فعال فعلی دست‌نخورده می‌مانند و به کار خود ادامه می‌دهند.",
  archived:
    "پلن بایگانی‌شده دیگر قابل خرید نیست؛ اشتراک‌های فعال و تاریخچهٔ سفارش‌ها حفظ می‌شوند.",
};

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

// ---------------------------------------------------------------------------
// Draft form model
// ---------------------------------------------------------------------------

interface PlanDraft {
  code: string;
  nameFa: string;
  shortDescriptionFa: string;
  descriptionFa: string;
  status: PlanStatus;
  displayOrder: string;
  tags: string;
  durationDays: string;
  activityCostPoints: string;
  dailyRequestLimit: string;
  tokenLimit: string;
  aiMessageLimit: string;
  documentAnalysisLimit: string;
  contractDraftLimit: string;
  contractCreationLimit: string;
  listPrice: string;
  salePrice: string;
  discountKind: DiscountKind;
  discountValue: string;
  contractCreationUnlimited: boolean;
  featuresText: string;
}

function emptyDraft(): PlanDraft {
  return {
    code: "",
    nameFa: "",
    shortDescriptionFa: "",
    descriptionFa: "",
    // New plans go live by default so a plan the operator just created is
    // immediately purchasable on /subscription. A draft is still one click
    // away in the status select (and status transitions stay audited).
    status: "active",
    displayOrder: "",
    tags: "",
    durationDays: "31",
    activityCostPoints: "100",
    dailyRequestLimit: "50",
    tokenLimit: "3000000",
    aiMessageLimit: "3000",
    documentAnalysisLimit: "5",
    contractDraftLimit: "3",
    contractCreationLimit: "3",
    listPrice: "5000000",
    salePrice: "2500000",
    discountKind: "percent",
    discountValue: "",
    contractCreationUnlimited: false,
    featuresText: "",
  };
}

function draftFromPlan(p: SubscriptionPlan): PlanDraft {
  return {
    code: p.code,
    nameFa: p.nameFa,
    shortDescriptionFa: p.shortDescriptionFa ?? "",
    descriptionFa: p.descriptionFa,
    status: p.status ?? (p.isActive ? "active" : "inactive"),
    displayOrder: p.displayOrder === undefined ? "" : String(p.displayOrder),
    tags: (p.tags ?? []).join("، "),
    durationDays: String(p.durationDays),
    activityCostPoints: String(p.activityCostPoints),
    dailyRequestLimit: String(p.dailyRequestLimit),
    tokenLimit: String(p.tokenLimit),
    aiMessageLimit: String(p.aiMessageLimit),
    documentAnalysisLimit: String(p.documentAnalysisLimit),
    contractDraftLimit: String(p.contractDraftLimit),
    contractCreationLimit: String(p.contractCreationLimit),
    listPrice: String(p.listPrice),
    salePrice: String(p.salePrice),
    discountKind: "percent",
    discountValue: "",
    contractCreationUnlimited: p.contractCreationUnlimited,
    featuresText: p.features.join("\n"),
  };
}

const CODE_RE = /^[a-z][a-z0-9_-]{1,31}$/;

function parseIntSafe(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Per-field validation errors, keyed by the draft field they belong to. */
type PlanFieldErrors = Partial<Record<keyof PlanDraft, string>>;

/** True when `v` parses to a non-negative integer. */
function isNonNegInt(v: string): boolean {
  const n = parseIntSafe(v);
  return Number.isInteger(n) && n >= 0;
}

/**
 * Client-side validation mirroring the server rules, returning a map keyed
 * by field so each message can be shown beside the input it belongs to.
 */
function validateDraftFields(d: PlanDraft, isCreate: boolean): PlanFieldErrors {
  const e: PlanFieldErrors = {};

  if (isCreate) {
    const code = d.code.trim().toLowerCase();
    if (!code) e.code = "شناسهٔ سیستمی الزامی است.";
    else if (!CODE_RE.test(code))
      e.code = "قالب نامعتبر؛ با حرف کوچک شروع و فقط حروف کوچک، عدد، خط تیره یا زیرخط (۲ تا ۳۲ نویسه).";
  }

  if (!d.nameFa.trim()) e.nameFa = "نام نمایشی فارسی الزامی است.";
  if (!(parseIntSafe(d.durationDays) > 0)) e.durationDays = "مدت اشتراک باید عددی مثبت باشد.";
  if (!(parseIntSafe(d.activityCostPoints) > 0))
    e.activityCostPoints = "هزینهٔ هر فعالیت باید عددی مثبت باشد.";

  if (!isNonNegInt(d.dailyRequestLimit)) e.dailyRequestLimit = "عدد صحیح و نامنفی وارد کنید.";
  if (!isNonNegInt(d.tokenLimit)) e.tokenLimit = "عدد صحیح و نامنفی وارد کنید.";
  if (!isNonNegInt(d.aiMessageLimit)) e.aiMessageLimit = "عدد صحیح و نامنفی وارد کنید.";
  if (!isNonNegInt(d.documentAnalysisLimit))
    e.documentAnalysisLimit = "عدد صحیح و نامنفی وارد کنید.";
  if (!isNonNegInt(d.contractDraftLimit)) e.contractDraftLimit = "عدد صحیح و نامنفی وارد کنید.";
  if (!isNonNegInt(d.contractCreationLimit))
    e.contractCreationLimit = "عدد صحیح و نامنفی وارد کنید.";

  const list = parseIntSafe(d.listPrice);
  const sale = parseIntSafe(d.salePrice);
  if (!isNonNegInt(d.listPrice)) e.listPrice = "قیمت فهرست باید عدد صحیح و نامنفی (تومان) باشد.";
  if (!isNonNegInt(d.salePrice)) e.salePrice = "قیمت فروش باید عدد صحیح و نامنفی (تومان) باشد.";
  else if (isNonNegInt(d.listPrice) && sale > list)
    e.salePrice = "قیمت فروش نباید از قیمت فهرست بیشتر باشد.";

  if (d.displayOrder.trim() && !isNonNegInt(d.displayOrder))
    e.displayOrder = "ترتیب نمایش باید عدد صحیح و نامنفی باشد.";

  return e;
}

function hasErrors(e: PlanFieldErrors): boolean {
  return Object.keys(e).length > 0;
}

function splitTags(s: string): string[] {
  return s
    .split(/[،,]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Field-wise equality of two drafts — the "has anything changed?" test. */
function sameDraft(a: PlanDraft, b: PlanDraft): boolean {
  for (const key of Object.keys(a) as (keyof PlanDraft)[]) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/** Project a draft onto the public `Plan` shape for the live card preview. */
function draftToPreviewPlan(d: PlanDraft): Plan {
  const list = parseIntSafe(d.listPrice) || 0;
  const sale = parseIntSafe(d.salePrice) || 0;
  return {
    id: "preview",
    code: "preview",
    nameFa: d.nameFa.trim() || "نام پلن",
    descriptionFa: d.descriptionFa.trim(),
    shortDescriptionFa: d.shortDescriptionFa.trim() || undefined,
    durationDays: parseIntSafe(d.durationDays) || 0,
    listPrice: list,
    salePrice: sale,
    currency: "IRT",
    discountPercent: computeDiscountPercent(list, sale),
    features: d.featuresText
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean),
    dailyRequestLimit: parseIntSafe(d.dailyRequestLimit) || 0,
    totalTokenLimit: parseIntSafe(d.tokenLimit) || 0,
    usageLimits: [
      {
        featureKey: "AI_CHAT_MESSAGE",
        nameFa: "پیام هوش مصنوعی",
        period: "month",
        limit: parseIntSafe(d.aiMessageLimit) || 0,
      },
      {
        featureKey: "DOCUMENT_ANALYSIS",
        nameFa: "تحلیل سند",
        period: "month",
        limit: parseIntSafe(d.documentAnalysisLimit) || 0,
      },
      {
        featureKey: "CONTRACT_GENERATION",
        nameFa: "تولید قرارداد",
        period: "month",
        limit: parseIntSafe(d.contractCreationLimit) || 0,
      },
    ],
    tags: splitTags(d.tags),
  };
}

// ---------------------------------------------------------------------------
// Create / edit dialog
// ---------------------------------------------------------------------------

function PlanFormDialog({
  open,
  onClose,
  isCreate,
  code,
}: {
  open: boolean;
  onClose: () => void;
  isCreate: boolean;
  code?: string;
}) {
  const detail = useAdminPlan(isCreate ? null : (code ?? null));
  const create = useCreateAdminPlan();
  const update = useUpdateAdminPlan();

  const existing = detail.data?.plan;
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  /** Field-level validation messages (shown beside each input). */
  const [fieldErrors, setFieldErrors] = useState<PlanFieldErrors>({});
  /** Top-level error (server failure or a save that could not proceed). */
  const [error, setError] = useState<string | null>(null);
  const [confirmPrice, setConfirmPrice] = useState<AdminPlanUpdate | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Initialise the draft once the source is known (create → empty, edit → row).
  const base = useMemo<PlanDraft | null>(() => {
    if (isCreate) return emptyDraft();
    return existing ? draftFromPlan(existing) : null;
  }, [isCreate, existing]);

  const current = draft ?? base;
  // Apply a field edit. Once the form has been submitted (errors are on
  // screen) re-validate the whole draft on every edit, so a message clears the
  // moment the operator corrects it — including cross-field rules such as
  // "sale price must not exceed list price".
  const set = (patch: Partial<PlanDraft>) => {
    const next = { ...(current ?? emptyDraft()), ...patch };
    setDraft(next);
    if (hasErrors(fieldErrors)) setFieldErrors(validateDraftFields(next, isCreate));
  };

  const pending = create.isPending || update.isPending;

  // True once the operator has touched the form and the draft differs from the
  // record it was seeded from — the signal for the "unsaved changes" warning.
  const dirty = draft !== null && base !== null && !sameDraft(draft, base);

  function reset() {
    setDraft(null);
    setFieldErrors({});
    setError(null);
    setConfirmPrice(null);
    setConfirmDiscard(false);
  }

  function close() {
    reset();
    onClose();
  }

  /** Close, warning first when there is unsaved work (never lose an edit silently). */
  function requestClose() {
    if (pending) return; // a save is in flight — never abandon it mid-write
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    close();
  }

  function buildUpdate(d: PlanDraft): AdminPlanUpdate {
    return {
      nameFa: d.nameFa.trim(),
      shortDescriptionFa: d.shortDescriptionFa.trim() || undefined,
      descriptionFa: d.descriptionFa,
      status: d.status,
      displayOrder: d.displayOrder.trim() ? parseIntSafe(d.displayOrder) : undefined,
      tags: splitTags(d.tags),
      durationDays: parseIntSafe(d.durationDays),
      activityCostPoints: parseIntSafe(d.activityCostPoints),
      dailyRequestLimit: parseIntSafe(d.dailyRequestLimit),
      tokenLimit: parseIntSafe(d.tokenLimit),
      aiMessageLimit: parseIntSafe(d.aiMessageLimit),
      documentAnalysisLimit: parseIntSafe(d.documentAnalysisLimit),
      contractDraftLimit: parseIntSafe(d.contractDraftLimit),
      contractCreationLimit: parseIntSafe(d.contractCreationLimit),
      listPrice: parseIntSafe(d.listPrice),
      salePrice: parseIntSafe(d.salePrice),
      contractCreationUnlimited: d.contractCreationUnlimited,
      features: d.featuresText
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean),
    };
  }

  function buildCreate(d: PlanDraft): AdminPlanCreateInput {
    return {
      code: d.code.trim().toLowerCase(),
      nameFa: d.nameFa.trim(),
      shortDescriptionFa: d.shortDescriptionFa.trim() || undefined,
      descriptionFa: d.descriptionFa,
      status: d.status,
      displayOrder: d.displayOrder.trim() ? parseIntSafe(d.displayOrder) : undefined,
      tags: splitTags(d.tags),
      durationDays: parseIntSafe(d.durationDays),
      activityCostPoints: parseIntSafe(d.activityCostPoints),
      dailyRequestLimit: parseIntSafe(d.dailyRequestLimit),
      tokenLimit: parseIntSafe(d.tokenLimit),
      aiMessageLimit: parseIntSafe(d.aiMessageLimit),
      documentAnalysisLimit: parseIntSafe(d.documentAnalysisLimit),
      contractDraftLimit: parseIntSafe(d.contractDraftLimit),
      contractCreationLimit: parseIntSafe(d.contractCreationLimit),
      listPrice: parseIntSafe(d.listPrice),
      salePrice: parseIntSafe(d.salePrice),
      contractCreationUnlimited: d.contractCreationUnlimited,
      features: d.featuresText
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean),
    };
  }

  async function doSave() {
    const d = current ?? emptyDraft();
    const errs = validateDraftFields(d, isCreate);
    if (hasErrors(errs)) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setError(null);
    try {
      if (isCreate) {
        const created = await create.mutateAsync(buildCreate(d));
        snackbar.show({ message: `پلن «${created.nameFa}» ساخته شد.`, variant: "success" });
      } else if (code) {
        await update.mutateAsync({ code, input: buildUpdate(d) });
        snackbar.show({
          message: "پلن به‌روزرسانی شد. اشتراک‌های فعال قبلی دست‌نخورده می‌مانند.",
          variant: "success",
        });
      }
      close();
    } catch (err) {
      setError(errMessage(err, "ذخیرهٔ پلن ناموفق بود."));
    }
  }

  function onSaveClick() {
    const d = current ?? emptyDraft();
    const errs = validateDraftFields(d, isCreate);
    if (hasErrors(errs)) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    // Confirm a price change on an existing plan (it does not alter history).
    if (!isCreate && existing) {
      const next = buildUpdate(d);
      if (next.listPrice !== existing.listPrice || next.salePrice !== existing.salePrice) {
        setConfirmPrice(next);
        return;
      }
    }
    void doSave();
  }

  const preview = draftToPreviewPlan(current ?? emptyDraft());

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        title={isCreate ? "ایجاد پلن جدید" : `ویرایش پلن ${existing?.nameFa ?? ""}`}
        description={
          isCreate
            ? "پلن را بسازید. پس از ذخیرهٔ موفق، پلن در کاتالوگ ثبت می‌شود."
            : "ویرایش پلن اشتراک‌های فعال را تغییر نمی‌دهد؛ هر اشتراک اسنپ‌شات زمان خرید دارد."
        }
        maxWidth="7xl"
        actions={
          <>
            <Button variant="ghost" onClick={requestClose} disabled={pending}>
              انصراف
            </Button>
            <Button variant="primary" onClick={onSaveClick} disabled={pending}>
              {pending ? "در حال ذخیره…" : isCreate ? "ایجاد پلن" : "ذخیره تغییرات"}
            </Button>
          </>
        }
      >
        {!isCreate && detail.isLoading ? (
          <p className="p-4 text-body-2 text-muted">در حال بارگذاری…</p>
        ) : !isCreate && detail.isError ? (
          <p role="alert" className="p-4 text-body-2 text-error-600">خطا در دریافت پلن</p>
        ) : (
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 desktop:grid-cols-[minmax(0,1fr)_360px]">
            {/* ---------------- Left: the form ---------------- */}
            <div className="min-w-0">
              {error && <InlineNotice tone="error">{error}</InlineNotice>}

              <Section title="اطلاعات عمومی">
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 tablet:grid-cols-2">
                  {isCreate && (
                    <Field
                      label="شناسهٔ سیستمی (لاتین)"
                      required
                      hint="یکتا؛ با حرف کوچک شروع و فقط حروف کوچک، عدد، خط تیره یا زیرخط (۲ تا ۳۲ نویسه)."
                      error={fieldErrors.code}
                    >
                      <TextInput
                        dir="ltr"
                        value={current?.code ?? ""}
                        onChange={(e) => set({ code: e.target.value })}
                        placeholder="pro-annual"
                        aria-invalid={Boolean(fieldErrors.code)}
                      />
                    </Field>
                  )}
                  <Field label="نام نمایشی (فارسی)" required error={fieldErrors.nameFa}>
                    <TextInput
                      value={current?.nameFa ?? ""}
                      onChange={(e) => set({ nameFa: e.target.value })}
                      aria-invalid={Boolean(fieldErrors.nameFa)}
                    />
                  </Field>
                  <Field label="وضعیت" hint="وضعیت پلن در فهرست خرید.">
                    <Select
                      value={current?.status ?? "draft"}
                      onChange={(e) => set({ status: e.target.value as PlanStatus })}
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_META[s].labelFa}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="ترتیب نمایش"
                    hint="عدد کمتر، بالاتر نمایش داده می‌شود."
                    error={fieldErrors.displayOrder}
                  >
                    <TextInput
                      type="number"
                      value={current?.displayOrder ?? ""}
                      onChange={(e) => set({ displayOrder: e.target.value })}
                      aria-invalid={Boolean(fieldErrors.displayOrder)}
                    />
                  </Field>
                  <div className="tablet:col-span-2">
                    <Field label="توضیح کوتاه" hint="در کارت پلن، بالای توضیح کامل دیده می‌شود.">
                      <TextInput
                        value={current?.shortDescriptionFa ?? ""}
                        onChange={(e) => set({ shortDescriptionFa: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="tablet:col-span-2">
                    <Field label="برچسب‌ها" hint="با ویرگول جدا کنید؛ مثلاً پیشنهادی، محبوب">
                      <TextInput
                        value={current?.tags ?? ""}
                        onChange={(e) => set({ tags: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
                <div className="mt-4">
                  <Field label="توضیح کامل" hint="شرح کامل پلن که در صفحهٔ اشتراک نمایش داده می‌شود.">
                    <TextArea
                      rows={3}
                      value={current?.descriptionFa ?? ""}
                      onChange={(e) => set({ descriptionFa: e.target.value })}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="قیمت و تخفیف" subtitle="مبالغ به تومان است.">
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 tablet:grid-cols-2">
                  <Field label="قیمت فهرست (تومان)" required error={fieldErrors.listPrice}>
                    <TextInput
                      type="number"
                      value={current?.listPrice ?? ""}
                      onChange={(e) => set({ listPrice: e.target.value })}
                      aria-invalid={Boolean(fieldErrors.listPrice)}
                    />
                  </Field>
                  <Field label="قیمت فروش (تومان)" required error={fieldErrors.salePrice}>
                    <TextInput
                      type="number"
                      value={current?.salePrice ?? ""}
                      onChange={(e) => set({ salePrice: e.target.value })}
                      aria-invalid={Boolean(fieldErrors.salePrice)}
                    />
                  </Field>
                  <Field label="نوع تخفیف">
                    <Select
                      value={current?.discountKind ?? "percent"}
                      onChange={(e) => set({ discountKind: e.target.value as DiscountKind })}
                    >
                      <option value="percent">درصدی</option>
                      <option value="fixed">مبلغ ثابت</option>
                    </Select>
                  </Field>
                  <Field label="مقدار تخفیف" hint="با اعمال، «قیمت فروش» محاسبه و جایگزین می‌شود.">
                    <div className="flex gap-2">
                      <TextInput
                        type="number"
                        value={current?.discountValue ?? ""}
                        onChange={(e) => set({ discountValue: e.target.value })}
                      />
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const d = current ?? emptyDraft();
                          const list = parseIntSafe(d.listPrice);
                          const val = parseIntSafe(d.discountValue);
                          if (!Number.isFinite(list) || !Number.isFinite(val) || val <= 0) {
                            setError("برای اعمال تخفیف، قیمت فهرست و مقدار تخفیف را درست وارد کنید.");
                            return;
                          }
                          set({ salePrice: String(applyDiscount(list, d.discountKind, val)) });
                          setError(null);
                        }}
                      >
                        اعمال
                      </Button>
                    </div>
                  </Field>
                </div>
                {(() => {
                  const list = parseIntSafe(current?.listPrice ?? "") || 0;
                  const sale = parseIntSafe(current?.salePrice ?? "") || 0;
                  const pct = computeDiscountPercent(list, sale);
                  return (
                    <p className="mt-3 text-caption text-muted">
                      قیمت فهرست: {toPersianNumber(list)} — قیمت فروش: {toPersianNumber(sale)}
                      {pct > 0 && sale <= list ? ` — تخفیف: ٪${toPersianNumber(pct)}` : ""}
                    </p>
                  );
                })()}
              </Section>

              <Section title="اعتبار و سهمیه">
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 tablet:grid-cols-2">
                  <Field label="مدت اشتراک (روز)" required error={fieldErrors.durationDays}>
                    <TextInput
                      type="number"
                      value={current?.durationDays ?? ""}
                      onChange={(e) => set({ durationDays: e.target.value })}
                      aria-invalid={Boolean(fieldErrors.durationDays)}
                    />
                  </Field>
                  <Field
                    label="هزینهٔ هر فعالیت (امتیاز)"
                    required
                    error={fieldErrors.activityCostPoints}
                  >
                    <TextInput
                      type="number"
                      value={current?.activityCostPoints ?? ""}
                      onChange={(e) => set({ activityCostPoints: e.target.value })}
                      aria-invalid={Boolean(fieldErrors.activityCostPoints)}
                    />
                  </Field>
                  <Field label="سقف درخواست روزانه" error={fieldErrors.dailyRequestLimit}>
                    <TextInput
                      type="number"
                      value={current?.dailyRequestLimit ?? ""}
                      onChange={(e) => set({ dailyRequestLimit: e.target.value })}
                      aria-invalid={Boolean(fieldErrors.dailyRequestLimit)}
                    />
                  </Field>
                  <Field label="سقف توکن" error={fieldErrors.tokenLimit}>
                    <TextInput
                      type="number"
                      value={current?.tokenLimit ?? ""}
                      onChange={(e) => set({ tokenLimit: e.target.value })}
                      aria-invalid={Boolean(fieldErrors.tokenLimit)}
                    />
                  </Field>
                  <Field label="سقف پیام هوش مصنوعی" error={fieldErrors.aiMessageLimit}>
                    <TextInput
                      type="number"
                      value={current?.aiMessageLimit ?? ""}
                      onChange={(e) => set({ aiMessageLimit: e.target.value })}
                      aria-invalid={Boolean(fieldErrors.aiMessageLimit)}
                    />
                  </Field>
                  <Field label="سقف تحلیل سند" error={fieldErrors.documentAnalysisLimit}>
                    <TextInput
                      type="number"
                      value={current?.documentAnalysisLimit ?? ""}
                      onChange={(e) => set({ documentAnalysisLimit: e.target.value })}
                      aria-invalid={Boolean(fieldErrors.documentAnalysisLimit)}
                    />
                  </Field>
                  <Field label="سقف پیش‌نویس قرارداد" error={fieldErrors.contractDraftLimit}>
                    <TextInput
                      type="number"
                      value={current?.contractDraftLimit ?? ""}
                      onChange={(e) => set({ contractDraftLimit: e.target.value })}
                      aria-invalid={Boolean(fieldErrors.contractDraftLimit)}
                    />
                  </Field>
                  <Field label="سقف ایجاد قرارداد" error={fieldErrors.contractCreationLimit}>
                    <TextInput
                      type="number"
                      disabled={current?.contractCreationUnlimited}
                      value={current?.contractCreationLimit ?? ""}
                      onChange={(e) => set({ contractCreationLimit: e.target.value })}
                      aria-invalid={Boolean(fieldErrors.contractCreationLimit)}
                    />
                  </Field>
                </div>
                <div className="mt-4 rounded-medium border border-divider px-3 py-1.5">
                  <SwitchRow
                    label="ایجاد قرارداد نامحدود"
                    checked={current?.contractCreationUnlimited ?? false}
                    onChange={(e) =>
                      set({ contractCreationUnlimited: e.target.checked })
                    }
                  />
                </div>
              </Section>

              <Section title="ویژگی‌ها" subtitle="هر ویژگی در یک خط.">
                <Field label="فهرست ویژگی‌ها">
                  <TextArea
                    rows={5}
                    value={current?.featuresText ?? ""}
                    onChange={(e) => set({ featuresText: e.target.value })}
                    placeholder={"۵۰ درخواست روزانه\n۳٬۰۰۰٬۰۰۰ توکن"}
                  />
                </Field>
              </Section>
            </div>

            {/* Live preview — the exact card a user will see, in its own rail.
                Sticky within the dialog body's scroll port and self-scrolling
                when the card is taller than the viewport, so it never overlaps
                the form or its action buttons. Stacks below the form on mobile. */}
            <div className="min-w-0 desktop:sticky desktop:top-4 desktop:self-start desktop:max-h-[calc(85vh-9rem)] desktop:overflow-y-auto">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-caption font-medium text-on-surface-variant">
                  پیش‌نمایش زندهٔ کارت پلن
                </p>
                <Badge tone={STATUS_META[current?.status ?? "draft"].tone} dot>
                  {STATUS_META[current?.status ?? "draft"].labelFa}
                </Badge>
              </div>
              <PlanCard
                plan={preview}
                isCurrent={false}
                isRecommended={splitTags(current?.tags ?? "").some(
                  (t) => t.includes("پیشنهاد") || t.toLowerCase() === "popular"
                )}
                onSelect={() => undefined}
                isLoading={false}
                ctaLabel="انتخاب پلن"
                isUpgrade={false}
              />
            </div>
          </div>
        )}
      </Dialog>

      {/* Price-change confirmation (does not touch historical orders). */}
      <Dialog
        open={confirmPrice !== null}
        onClose={() => setConfirmPrice(null)}
        title="تأیید تغییر قیمت"
        description="تغییر قیمت فقط روی خریدهای جدید اثر دارد و سفارش‌های گذشته دست‌نخورده می‌مانند."
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmPrice(null)}>
              انصراف
            </Button>
            <Button
              variant="primary"
              disabled={pending}
              onClick={() => {
                setConfirmPrice(null);
                void doSave();
              }}
            >
              تأیید و ذخیره
            </Button>
          </>
        }
      >
        <p className="text-body-2 text-on-surface-variant">
          قیمت فروش از {toPersianNumber(existing?.salePrice ?? 0)} به{" "}
          {toPersianNumber(confirmPrice?.salePrice ?? 0)} تومان تغییر می‌کند.
        </p>
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
// Plan mix over time (قالب «پلن‌ها»: نمودار میله‌ای انباشته روی بازهٔ زمانی)
// ---------------------------------------------------------------------------
// Selling orders stacked by plan, one column per day. `planMix` is derived from
// the SAME real sales ledger the reports page reads — one source, one window —
// so a segment can never disagree with the by-plan table elsewhere. A plan with
// no sale on a day draws a zero-height segment, never a gap that would shift the
// stack; an empty window shows an explicit empty state, not a bare axis.
function PlanMixChart() {
  const reports = useAdminReports(30);
  const mix = reports.data?.planMix;

  const segments: StackSegment[] = (mix?.plans ?? []).map((p) => ({
    key: p.planCode,
    label: p.planNameFa,
  }));
  const rows: StackRow[] = (mix?.days ?? []).map((d) => ({
    label: toPersianDate(d.date, { month: "short", day: "numeric" }),
    values: d.values,
  }));
  const total = rows.reduce((s, r) => s + r.values.reduce((a, v) => a + v, 0), 0);

  return (
    <Section
      title="ترکیب پلن‌ها در بازه"
      subtitle="تعداد سفارش‌های فروش به تفکیک پلن در هر روز سی روز گذشته."
    >
      <ChartFrame
        title="سفارش‌ها به تفکیک پلن در طول زمان"
        subtitle="هر میله یک روز است؛ بخش‌های رنگی سهم هر پلن از سفارش‌های آن روز را نشان می‌دهند."
      >
        {reports.isLoading ? (
          <ChartSkeleton height={200} />
        ) : reports.isError || !mix ? (
          <ChartEmpty message="دادهٔ ترکیب پلن‌ها در دسترس نیست." />
        ) : total === 0 ? (
          <ChartEmpty message="در این بازه سفارشی ثبت نشده است." />
        ) : (
          <StackedBarChart
            rows={rows}
            segments={segments}
            ariaLabel="ترکیب پلن‌ها در طول زمان"
            formatTotal={(n) => `${toPersianNumber(n)} سفارش`}
          />
        )}
      </ChartFrame>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminPlansPage() {
  const { can } = useAdminMe();
  const canEdit = can("admin:system:manage");
  const plans = useAdminPlans();
  const setStatus = useSetAdminPlanStatus();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PlanStatus | "all">("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editCode, setEditCode] = useState<string | null>(null);
  // Every status change passes through one confirmation, not just archiving:
  // publishing or pausing a plan changes what the whole /subscription page
  // sells, so the operator states the intent before it lands.
  const [statusTarget, setStatusTarget] = useState<{ code: string; status: PlanStatus } | null>(
    null
  );

  const allRows = plans.data?.items ?? [];

  /**
   * The periods the catalogue actually sells, derived from real rows. Offering
   * a «ساله» tab with no annual plan would be a control that can only ever
   * return an empty page.
   */
  const periodOptions = useMemo(() => {
    const days = [...new Set(allRows.map((p) => p.durationDays))].sort((a, b) => a - b);
    return [{ value: "all", label: "همه دوره‌ها" }].concat(
      days.map((d) => ({ value: String(d), label: periodLabelFa(d) }))
    );
  }, [allRows]);

  // A filter that stopped existing (the last annual plan was archived) must
  // not silently hide every row.
  useEffect(() => {
    if (periodFilter !== "all" && !periodOptions.some((o) => o.value === periodFilter)) {
      setPeriodFilter("all");
    }
  }, [periodFilter, periodOptions]);

  const visible = useMemo(() => {
    return allRows
      .filter((p) => (statusFilter === "all" ? true : p.status === statusFilter))
      .filter((p) => (periodFilter === "all" ? true : String(p.durationDays) === periodFilter))
      .filter(
        (p) =>
          !search.trim() ||
          // Shared normalisation lane: Persian/Arabic digits and letter forms
          // in the query (and stored tags) fold before matching.
          matchesText(search, p.nameFa, p.code, ...(p.tags ?? []))
      )
      .sort((a, b) => {
        const ao = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
        const bo = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return a.createdAt.localeCompare(b.createdAt);
      });
  }, [allRows, search, statusFilter, periodFilter]);

  const pager = useClientPagination(visible);
  const { reset: resetPager } = pager;
  useEffect(() => {
    resetPager();
  }, [resetPager, search, statusFilter, periodFilter]);

  async function changeStatus(code: string, status: PlanStatus) {
    try {
      await setStatus.mutateAsync({ code, status });
      snackbar.show({
        message: `وضعیت پلن به «${STATUS_META[status].labelFa}» تغییر کرد.`,
        variant: "success",
      });
    } catch (err) {
      snackbar.show({ message: errMessage(err, "تغییر وضعیت ناموفق بود."), variant: "error" });
    }
  }

  function statusActionLabel(t: PlanStatus): string {
    return t === "active" ? "انتشار" : t === "inactive" ? "غیرفعال" : "بایگانی";
  }

  const statusTargetPlan = statusTarget
    ? allRows.find((p) => p.code === statusTarget.code)
    : undefined;

  return (
    <div>
      <PageHeader
        title="پلن‌ها، اشتراک و سهمیه"
        description="کاتالوگ پلن‌ها. ساخت و ویرایش پلن تاریخچه ثبت می‌کند و اشتراک‌های فعال را تغییر نمی‌دهد."
        actions={
          <div className="flex items-center gap-2">
            <ExportButton kind="plans" label="خروجی پلن‌ها" />
            {canEdit && (
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                ایجاد پلن
              </Button>
            )}
          </div>
        }
      />

      {!canEdit && (
        <InfoBanner tone="info">
          ساخت و ویرایش پلن نیازمند مجوز مدیریت سامانه است؛ در این نما فقط‌خواندنی می‌توانید اعداد و
          تاریخچه را ببینید.
        </InfoBanner>
      )}

      <PlanMixChart />

      <div className="mb-4 flex flex-col gap-3 tablet:flex-row tablet:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="جست‌وجوی نام، شناسه یا برچسب…"
          className="tablet:min-w-[240px] tablet:flex-1"
        />
        <div className="flex flex-wrap items-center gap-3">
          <FilterPills options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
          {periodOptions.length > 2 && (
            <Select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              aria-label="فیلتر دورهٔ پلن"
              className="w-auto min-w-[140px]"
            >
              {periodOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      <StateView
        query={plans}
        loadingRows={4}
        isEmpty={() => visible.length === 0}
        emptyMessage={
          search.trim() || statusFilter !== "all" || periodFilter !== "all"
            ? "پلنی با این فیلترها یافت نشد."
            : "هنوز پلنی ثبت نشده است."
        }
      >
        {() => (
          <>
          <DataTable
            minWidth={520}
            head={
              <tr>
                <Th>پلن</Th>
                <Th className="hidden tablet:table-cell">دوره</Th>
                <Th>وضعیت</Th>
                <Th>قیمت</Th>
                <Th className="hidden laptop:table-cell">سقف‌ها</Th>
                <Th className="hidden desktop:table-cell">آخرین به‌روزرسانی</Th>
                <Th>اقدام‌ها</Th>
              </tr>
            }
          >
            {pager.pageItems.map((p) => {
              const meta = STATUS_META[p.status];
              const transitions = ALLOWED_STATUS_TRANSITIONS[p.status];
              return (
                <tr key={p.code}>
                  <Td>
                    <div className="flex max-w-[240px] flex-col">
                      <span className="truncate font-medium text-on-surface" title={p.nameFa}>
                        {p.nameFa}
                      </span>
                      <span className="text-caption text-muted" dir="ltr" title={p.code}>
                        {p.code}
                      </span>
                      <span className="text-caption text-muted tablet:hidden">
                        {periodLabelFa(p.durationDays)}
                      </span>
                      {(p.tags ?? []).length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {(p.tags ?? []).map((t) => (
                            <Badge key={t} tone="brand">
                              {t}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td className="hidden whitespace-nowrap tablet:table-cell">
                    {periodLabelFa(p.durationDays)}
                    <span className="block text-caption text-muted tabular-nums">
                      {toPersianNumber(p.durationDays)} روز
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={meta.tone} dot title={meta.hint}>
                      {meta.labelFa}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className="tabular-nums">{toPersianNumber(p.salePrice)}</span>
                    <span className="text-caption text-muted"> تومان</span>
                    {p.discountPercent > 0 && p.salePrice < p.listPrice && (
                      <span className="block text-caption text-muted">
                        <span className="line-through">{toPersianNumber(p.listPrice)}</span>{" "}
                        <span className="text-success">٪{toPersianNumber(p.discountPercent)}</span>
                      </span>
                    )}
                  </Td>
                  <Td className="hidden laptop:table-cell">
                    <div className="flex flex-col text-caption text-muted">
                      <span className="tabular-nums">
                        {toPersianNumber(p.dailyRequestLimit)} درخواست/روز
                      </span>
                      <span className="tabular-nums">
                        {toPersianNumber(p.aiMessageLimit)} پیام هوش مصنوعی
                      </span>
                    </div>
                  </Td>
                  <Td className="hidden whitespace-nowrap tabular-nums desktop:table-cell">
                    {p.updatedAt ? toPersianDate(p.updatedAt) : "—"}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => setEditCode(p.code)}>
                        ویرایش
                      </Button>
                      {canEdit &&
                        transitions.map((t) => (
                          <Button
                            key={t}
                            size="sm"
                            variant={t === "active" ? "tonal" : "ghost"}
                            disabled={setStatus.isPending}
                            onClick={() => setStatusTarget({ code: p.code, status: t })}
                          >
                            {statusActionLabel(t)}
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
            itemLabel="پلن"
            onPageChange={pager.setPage}
            onPageSizeChange={pager.setPageSize}
          />
          </>
        )}
      </StateView>

      {canEdit && (
        <PlanFormDialog open={createOpen} onClose={() => setCreateOpen(false)} isCreate />
      )}
      {editCode && (
        <PlanFormDialog
          key={editCode}
          open
          onClose={() => setEditCode(null)}
          isCreate={false}
          code={editCode}
        />
      )}

      <Dialog
        open={statusTarget !== null}
        onClose={() => setStatusTarget(null)}
        title={
          statusTarget
            ? `${statusActionLabel(statusTarget.status)} پلن «${
                statusTargetPlan?.nameFa ?? statusTarget.code
              }»`
            : ""
        }
        description={statusTarget ? STATUS_IMPACT_FA[statusTarget.status] : undefined}
        actions={
          <>
            <Button variant="ghost" onClick={() => setStatusTarget(null)}>
              انصراف
            </Button>
            <Button
              variant={statusTarget?.status === "active" ? "primary" : "danger"}
              disabled={setStatus.isPending}
              onClick={() => {
                const target = statusTarget;
                setStatusTarget(null);
                if (target) void changeStatus(target.code, target.status);
              }}
            >
              {statusTarget ? `${statusActionLabel(statusTarget.status)} کن` : "تأیید"}
            </Button>
          </>
        }
      >
        {statusTargetPlan && (
          <div className="space-y-2 text-body-2 text-on-surface-variant">
            <p>
              وضعیت فعلی: <b>{STATUS_META[statusTargetPlan.status].labelFa}</b> — وضعیت جدید:{" "}
              <b>{statusTarget ? STATUS_META[statusTarget.status].labelFa : "—"}</b>
            </p>
            <p>
              دوره: {periodLabelFa(statusTargetPlan.durationDays)} · قیمت فروش:{" "}
              {toPersianNumber(statusTargetPlan.salePrice)} تومان
            </p>
            {statusTarget?.status === "archived" && (
              <p>بازگردانی از بایگانی با تغییر وضعیت به «فعال» ممکن است.</p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
