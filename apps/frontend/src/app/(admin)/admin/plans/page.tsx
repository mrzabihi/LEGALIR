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

import { useMemo, useState } from "react";
import {
  useAdminPlans,
  useAdminPlan,
  useUpdateAdminPlan,
  useCreateAdminPlan,
  useSetAdminPlanStatus,
  useAdminMe,
} from "@/hooks/useAdmin";
import { toPersianNumber } from "@/lib/persian-utils";
import { computeDiscountPercent, applyDiscount, type DiscountKind } from "@/lib/usage/plan-pricing";
import type { AdminPlanUpdate, AdminPlanCreateInput } from "@/lib/api/admin";
import type { Plan, PlanStatus, SubscriptionPlan } from "@legalir/types";
import { Dialog, snackbar } from "@legalir/ui";
import { PlanCard } from "@/components/subscription/plan-card";
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
  Section,
  SearchInput,
  FilterPills,
  ExportButton,
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
    status: "draft",
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

/** Client-side validation mirroring the server rules; returns the first error. */
function validateDraft(d: PlanDraft, isCreate: boolean): string | null {
  if (isCreate && !d.code.trim()) return "شناسهٔ سیستمی پلن الزامی است.";
  if (isCreate && !CODE_RE.test(d.code.trim().toLowerCase())) {
    return "شناسهٔ سیستمی فقط با حروف کوچک لاتین/عدد/خط تیره و با حرف شروع شود.";
  }
  if (!d.nameFa.trim()) return "نام نمایشی فارسی الزامی است.";
  if (!(parseIntSafe(d.durationDays) > 0)) return "مدت اشتراک باید عددی مثبت باشد.";
  if (!(parseIntSafe(d.activityCostPoints) > 0)) return "هزینهٔ هر فعالیت باید عددی مثبت باشد.";
  const limits = [
    d.dailyRequestLimit,
    d.tokenLimit,
    d.aiMessageLimit,
    d.documentAnalysisLimit,
    d.contractDraftLimit,
    d.contractCreationLimit,
  ];
  for (const l of limits) {
    const n = parseIntSafe(l);
    if (!Number.isInteger(n) || n < 0) return "سقف‌ها باید عدد صحیح و نامنفی باشند.";
  }
  const list = parseIntSafe(d.listPrice);
  const sale = parseIntSafe(d.salePrice);
  if (!Number.isInteger(list) || list < 0) return "قیمت فهرست باید عدد صحیح و نامنفی (تومان) باشد.";
  if (!Number.isInteger(sale) || sale < 0) return "قیمت فروش باید عدد صحیح و نامنفی (تومان) باشد.";
  if (sale > list) return "قیمت فروش نمی‌تواند از قیمت فهرست بیشتر باشد.";
  if (
    d.displayOrder.trim() &&
    !(Number.isInteger(parseIntSafe(d.displayOrder)) && parseIntSafe(d.displayOrder) >= 0)
  ) {
    return "ترتیب نمایش باید عدد صحیح و نامنفی باشد.";
  }
  return null;
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
  const [error, setError] = useState<string | null>(null);
  const [confirmPrice, setConfirmPrice] = useState<AdminPlanUpdate | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Initialise the draft once the source is known (create → empty, edit → row).
  const base = useMemo<PlanDraft | null>(() => {
    if (isCreate) return emptyDraft();
    return existing ? draftFromPlan(existing) : null;
  }, [isCreate, existing]);

  const current = draft ?? base;
  const set = (patch: Partial<PlanDraft>) => setDraft({ ...(current ?? emptyDraft()), ...patch });

  const pending = create.isPending || update.isPending;

  // True once the operator has touched the form and the draft differs from the
  // record it was seeded from — the signal for the "unsaved changes" warning.
  const dirty = draft !== null && base !== null && !sameDraft(draft, base);

  function reset() {
    setDraft(null);
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
    const invalid = validateDraft(d, isCreate);
    if (invalid) {
      setError(invalid);
      return;
    }
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
    const invalid = validateDraft(d, isCreate);
    if (invalid) {
      setError(invalid);
      return;
    }
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
        maxWidth="lg"
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
          <p className="p-4 text-body-2 text-red-600">خطا در دریافت پلن</p>
        ) : (
          <div className="grid gap-5 desktop:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              {error && (
                <div className="mb-4 rounded-large border border-red-200 bg-red-50 p-3 text-body-2 text-red-700 dark:bg-red-900/20 dark:text-red-300">
                  {error}
                </div>
              )}

              <Section title="اطلاعات عمومی">
                <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
                  {isCreate && (
                    <Field label="شناسهٔ سیستمی (لاتین)" hint="یکتا؛ فقط حروف کوچک، عدد، خط تیره">
                      <TextInput
                        dir="ltr"
                        value={current?.code ?? ""}
                        onChange={(e) => set({ code: e.target.value })}
                        placeholder="pro-annual"
                      />
                    </Field>
                  )}
                  <Field label="نام نمایشی (فارسی)">
                    <TextInput
                      value={current?.nameFa ?? ""}
                      onChange={(e) => set({ nameFa: e.target.value })}
                    />
                  </Field>
                  <Field label="توضیح کوتاه" hint="در کارت پلن بالای توضیح کامل دیده می‌شود.">
                    <TextInput
                      value={current?.shortDescriptionFa ?? ""}
                      onChange={(e) => set({ shortDescriptionFa: e.target.value })}
                    />
                  </Field>
                  <Field label="وضعیت">
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
                  <Field label="ترتیب نمایش" hint="عدد کمتر، بالاتر نمایش داده می‌شود.">
                    <TextInput
                      type="number"
                      value={current?.displayOrder ?? ""}
                      onChange={(e) => set({ displayOrder: e.target.value })}
                    />
                  </Field>
                  <Field label="برچسب‌ها" hint="با ویرگول جدا کنید؛ مثلاً پیشنهادی، محبوب">
                    <TextInput
                      value={current?.tags ?? ""}
                      onChange={(e) => set({ tags: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="mt-3">
                  <Field label="توضیح کامل">
                    <TextArea
                      rows={2}
                      value={current?.descriptionFa ?? ""}
                      onChange={(e) => set({ descriptionFa: e.target.value })}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="قیمت و تخفیف" subtitle="مبالغ به تومان است.">
                <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
                  <Field label="قیمت فهرست (تومان)">
                    <TextInput
                      type="number"
                      value={current?.listPrice ?? ""}
                      onChange={(e) => set({ listPrice: e.target.value })}
                    />
                  </Field>
                  <Field label="قیمت فروش (تومان)">
                    <TextInput
                      type="number"
                      value={current?.salePrice ?? ""}
                      onChange={(e) => set({ salePrice: e.target.value })}
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
                <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
                  <Field label="مدت اشتراک (روز)">
                    <TextInput
                      type="number"
                      value={current?.durationDays ?? ""}
                      onChange={(e) => set({ durationDays: e.target.value })}
                    />
                  </Field>
                  <Field label="هزینهٔ هر فعالیت (امتیاز)">
                    <TextInput
                      type="number"
                      value={current?.activityCostPoints ?? ""}
                      onChange={(e) => set({ activityCostPoints: e.target.value })}
                    />
                  </Field>
                  <Field label="سقف درخواست روزانه">
                    <TextInput
                      type="number"
                      value={current?.dailyRequestLimit ?? ""}
                      onChange={(e) => set({ dailyRequestLimit: e.target.value })}
                    />
                  </Field>
                  <Field label="سقف توکن">
                    <TextInput
                      type="number"
                      value={current?.tokenLimit ?? ""}
                      onChange={(e) => set({ tokenLimit: e.target.value })}
                    />
                  </Field>
                  <Field label="سقف پیام هوش مصنوعی">
                    <TextInput
                      type="number"
                      value={current?.aiMessageLimit ?? ""}
                      onChange={(e) => set({ aiMessageLimit: e.target.value })}
                    />
                  </Field>
                  <Field label="سقف تحلیل سند">
                    <TextInput
                      type="number"
                      value={current?.documentAnalysisLimit ?? ""}
                      onChange={(e) => set({ documentAnalysisLimit: e.target.value })}
                    />
                  </Field>
                  <Field label="سقف پیش‌نویس قرارداد">
                    <TextInput
                      type="number"
                      value={current?.contractDraftLimit ?? ""}
                      onChange={(e) => set({ contractDraftLimit: e.target.value })}
                    />
                  </Field>
                  <Field label="سقف ایجاد قرارداد">
                    <TextInput
                      type="number"
                      disabled={current?.contractCreationUnlimited}
                      value={current?.contractCreationLimit ?? ""}
                      onChange={(e) => set({ contractCreationLimit: e.target.value })}
                    />
                  </Field>
                </div>
                <label className="mt-3 flex items-center gap-2 text-body-2 text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={current?.contractCreationUnlimited ?? false}
                    onChange={(e) => set({ contractCreationUnlimited: e.target.checked })}
                  />
                  ایجاد قرارداد نامحدود
                </label>
              </Section>

              <Section title="ویژگی‌ها" subtitle="هر ویژگی در یک خط.">
                <TextArea
                  rows={5}
                  value={current?.featuresText ?? ""}
                  onChange={(e) => set({ featuresText: e.target.value })}
                  placeholder={"۵۰ درخواست روزانه\n۳٬۰۰۰٬۰۰۰ توکن"}
                />
              </Section>
            </div>

            {/* Live preview — the exact card a user will see. */}
            <div className="desktop:sticky desktop:top-4 desktop:self-start">
              <p className="mb-2 text-caption font-medium text-on-surface-variant">
                پیش‌نمایش کارت پلن
              </p>
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
// Page
// ---------------------------------------------------------------------------

export default function AdminPlansPage() {
  const { can } = useAdminMe();
  const canEdit = can("admin:system:manage");
  const plans = useAdminPlans();
  const setStatus = useSetAdminPlanStatus();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PlanStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editCode, setEditCode] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = plans.data?.items ?? [];
    return rows
      .filter((p) => (statusFilter === "all" ? true : p.status === statusFilter))
      .filter(
        (p) =>
          !q ||
          p.nameFa.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const ao = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
        const bo = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return a.createdAt.localeCompare(b.createdAt);
      });
  }, [plans.data, search, statusFilter]);

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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="جست‌وجوی نام، شناسه یا برچسب…" />
        <FilterPills options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
      </div>

      <StateView
        query={plans}
        loadingRows={4}
        isEmpty={() => visible.length === 0}
        emptyMessage="پلنی با این فیلتر یافت نشد."
      >
        {() => (
          <DataTable
            head={
              <tr>
                <Th>پلن</Th>
                <Th>وضعیت</Th>
                <Th>قیمت</Th>
                <Th>سقف درخواست روزانه</Th>
                <Th>ترتیب</Th>
                <Th>اقدام‌ها</Th>
              </tr>
            }
          >
            {visible.map((p) => {
              const meta = STATUS_META[p.status];
              const transitions = ALLOWED_STATUS_TRANSITIONS[p.status];
              return (
                <tr key={p.code}>
                  <Td>
                    <span className="font-medium text-on-surface">{p.nameFa}</span>
                    <span className="block text-caption text-muted" dir="ltr">
                      {p.code}
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
                  <Td className="tabular-nums">{toPersianNumber(p.dailyRequestLimit)}</Td>
                  <Td className="tabular-nums">
                    {p.displayOrder === undefined ? "—" : toPersianNumber(p.displayOrder)}
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
                            onClick={() => {
                              if (t === "archived") setArchiveTarget(p.code);
                              else void changeStatus(p.code, t);
                            }}
                          >
                            {t === "active" ? "انتشار" : t === "inactive" ? "غیرفعال" : "بایگانی"}
                          </Button>
                        ))}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </DataTable>
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
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        title="بایگانی پلن"
        description="پلن بایگانی‌شده دیگر قابل خرید نیست؛ اشتراک‌های فعال و تاریخچهٔ سفارش‌ها حفظ می‌شوند."
        actions={
          <>
            <Button variant="ghost" onClick={() => setArchiveTarget(null)}>
              انصراف
            </Button>
            <Button
              variant="danger"
              disabled={setStatus.isPending}
              onClick={() => {
                const c = archiveTarget;
                setArchiveTarget(null);
                if (c) void changeStatus(c, "archived");
              }}
            >
              بایگانی کن
            </Button>
          </>
        }
      >
        <p className="text-body-2 text-on-surface-variant">
          آیا از بایگانی این پلن مطمئن هستید؟ امکان بازگردانی با تغییر وضعیت به «فعال» وجود دارد.
        </p>
      </Dialog>
    </div>
  );
}
