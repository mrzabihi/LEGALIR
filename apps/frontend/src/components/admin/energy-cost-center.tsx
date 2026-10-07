// ============================================================
// LEGALIR — Admin · Energy & Service Cost Center (مرکز انرژی و هزینهٔ خدمات)
// ============================================================
// §6 of the admin spec: the real Service‑Cost Management surface. It sits on
// top of the single Entitlement & Usage Engine — it never prices anything
// itself, it only reads and writes the admin‑configurable model that the
// engine consults through `lib/usage/energy.ts`.
//
// Three views, one page:
//   • خلاصه     — the derived usage ledger, aggregated (real numbers only)
//   • خدمات     — one pricing profile per billable activity + its rule chain
//   • دفتر مصرف — the queryable, filterable consumption ledger
//
// Every mutation flows through a server endpoint that re‑checks
// `admin:energy:manage` and appends to the audit log; the UI merely reflects
// that state. When no enabled profile exists the engine falls back to the
// registry's flat cost, so nothing here changes behaviour until an operator
// explicitly turns a service on.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Drawer,
  Switch,
  ConfirmDialog,
  snackbar,
} from "@legalir/ui";
import {
  SERVICE_COST_UNITS,
  SERVICE_COST_UNIT_FA,
  SERVICE_COST_RULE_CONDITION_FA,
  type ActivityType,
  type ServiceCostProfile,
  type ServiceCostRule,
  type ServiceCostRuleCondition,
  type ServiceCostUnit,
  type UsageLedgerEntry,
} from "@legalir/types";
import { ACTIVITY_REGISTRY } from "@/lib/usage/activities";
import {
  useCostProfiles,
  useCostProfile,
  useSaveCostProfile,
  useSaveCostRule,
  useDeleteCostRule,
  useUsageLedger,
  useUsageSummary,
} from "@/hooks/useAdmin";
import type { SaveCostProfileInput } from "@/lib/api/admin";
import { toPersianNumber, toPersianDate, toRelativeTime } from "@/lib/persian-utils";
import {
  PageHeader,
  StatCard,
  Badge,
  Button,
  DataTable,
  Th,
  Td,
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  StateView,
  TextInput,
  TextArea,
  Select,
  Field,
  SearchInput,
  Tabs,
  ExportButton,
  InfoBanner,
  type TabItem,
} from "@/components/admin/ui";
import { LineChart, BarChart, DonutChart, ChartFrame, ChartEmpty } from "@/components/admin/charts";
import {
  IconBolt,
  IconCoin,
  IconAdd,
  IconEdit,
  IconDelete,
  IconDatabase,
  IconRefresh,
} from "@/lib/icons";

// ---------------------------------------------------------------------------
// Constants derived from the single activity registry (never duplicated)
// ---------------------------------------------------------------------------

/** Persian label for every billable activity — sourced from the registry. */
const ACTIVITY_LABEL: Record<ActivityType, string> = Object.fromEntries(
  ACTIVITY_REGISTRY.map((a) => [a.code, a.displayNameFa])
) as Record<ActivityType, string>;

/** The billable activities, in registry order, for the pricing select. */
export const ACTIVITY_OPTIONS: { value: ActivityType; label: string }[] = ACTIVITY_REGISTRY.map(
  (a) => ({ value: a.code, label: a.displayNameFa })
);

/** The rule conditions, in the order an operator is most likely to reach for. */
const RULE_CONDITIONS: ServiceCostRuleCondition[] = [
  "MESSAGE_INDEX_RANGE",
  "INPUT_TOKENS_GT",
  "OUTPUT_TOKENS_GT",
  "CONTEXT_TOKENS_GT",
  "RAG_USED",
  "TOOL_USED",
  "LAWYER_REVIEW",
  "MODEL_IS",
];

const LEDGER_STATUS_FA: Record<
  UsageLedgerEntry["status"],
  { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" | "brand" }
> = {
  RESERVED: { label: "رزروشده", tone: "warning" },
  COMPLETED: { label: "تکمیل‌شده", tone: "success" },
  REVERSED: { label: "برگشتی", tone: "neutral" },
  FAILED: { label: "ناموفق", tone: "danger" },
};

const CREDIT_SOURCE_FA: Record<UsageLedgerEntry["creditSource"], string> = {
  SUBSCRIPTION: "اعتبار اشتراک",
  REWARD: "پاداش",
  NONE: "—",
};

const PAGE_SIZE = 20;

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

/** Conditions that take a numeric threshold (`min`). */
function conditionUsesThreshold(c: ServiceCostRuleCondition): boolean {
  return (
    c === "INPUT_TOKENS_GT" ||
    c === "OUTPUT_TOKENS_GT" ||
    c === "CONTEXT_TOKENS_GT" ||
    c === "MESSAGE_INDEX_RANGE"
  );
}

// ---------------------------------------------------------------------------
// Summary — the aggregated usage ledger (real numbers, never simulated)
// ---------------------------------------------------------------------------

function SummarySection() {
  const summary = useUsageSummary(30);

  return (
    <StateView query={summary} loadingRows={3}>
      {(s) => (
        <>
          <div className="mb-4 grid gap-4 mobile:grid-cols-2 tablet:grid-cols-4">
            <StatCard
              label="انرژی مصرف‌شده (۳۰ روز)"
              value={s.totalEnergy}
              unit="واحد"
              icon={<IconBolt size={18} />}
              accent
            />
            <StatCard label="تعداد تراکنش" value={s.totalEntries} icon={<IconDatabase size={18} />} />
            <StatCard
              label="انرژی رزروشده"
              value={s.reservedEnergy}
              unit="واحد"
              tone="warning"
              hint="در انتظار تکمیل یا برگشت"
            />
            <StatCard
              label="انرژی تکمیل‌شده"
              value={s.completedEnergy}
              unit="واحد"
              tone="success"
            />
          </div>

          <div className="grid gap-4 tablet:grid-cols-2">
            <ChartFrame title="روند روزانهٔ مصرف" subtitle="۳۰ روز گذشته">
              {s.daily.length > 0 ? (
                <LineChart
                  points={s.daily.map((d) => ({
                    label: toPersianDate(d.date, { month: "2-digit", day: "2-digit" }),
                    tooltipLabel: toPersianDate(d.date),
                    value: d.energy,
                  }))}
                  ariaLabel="روند روزانهٔ مصرف انرژی در سی روز گذشته"
                  seriesName="انرژی"
                  unit="واحد"
                />
              ) : (
                <ChartEmpty message="در این بازه مصرفی ثبت نشده است." />
              )}
            </ChartFrame>

            <ChartFrame title="مصرف به تفکیک سرویس" subtitle="بر پایهٔ انرژی">
              {s.byService.length > 0 ? (
                <BarChart
                  bars={s.byService.slice(0, 7).map((x) => ({
                    label: x.nameFa,
                    value: x.energy,
                    display: `${toPersianNumber(x.energy)} واحد`,
                  }))}
                  ariaLabel="انرژی مصرف‌شده به تفکیک سرویس"
                />
              ) : (
                <ChartEmpty message="مصرفی برای تفکیک وجود ندارد." />
              )}
            </ChartFrame>
          </div>

          {s.byModel.length > 0 && (
            <ChartFrame
              className="mt-4"
              title="سهم مدل‌ها در مصرف"
              subtitle="انرژی مصرف‌شده به تفکیک مدل هوش مصنوعی"
            >
              <DonutChart
                slices={s.byModel.slice(0, 6).map((m) => ({ label: m.model, value: m.energy }))}
                ariaLabel="سهم مدل‌ها در مصرف انرژی"
                centerLabel="انرژی"
              />
            </ChartFrame>
          )}
        </>
      )}
    </StateView>
  );
}

// ---------------------------------------------------------------------------
// Rule editor dialog
// ---------------------------------------------------------------------------

interface RuleDraft {
  id?: string;
  labelFa: string;
  enabled: boolean;
  priority: number;
  condition: ServiceCostRuleCondition;
  min: number | null;
  max: number | null;
  modelsText: string;
  addEnergy: number;
  multiplyText: string;
}

function emptyRuleDraft(priority: number): RuleDraft {
  return {
    labelFa: "",
    enabled: true,
    priority,
    condition: "MESSAGE_INDEX_RANGE",
    min: 1,
    max: null,
    modelsText: "",
    addEnergy: 0,
    multiplyText: "",
  };
}

function ruleToDraft(rule: ServiceCostRule): RuleDraft {
  return {
    id: rule.id,
    labelFa: rule.labelFa,
    enabled: rule.enabled,
    priority: rule.priority,
    condition: rule.condition,
    min: rule.min,
    max: rule.max,
    modelsText: rule.models.join(", "),
    addEnergy: rule.addEnergy,
    multiplyText: rule.multiply == null ? "" : String(rule.multiply),
  };
}

function RuleDialog({
  open,
  profile,
  rule,
  nextPriority,
  onClose,
}: {
  open: boolean;
  profile: ServiceCostProfile;
  rule: ServiceCostRule | null;
  nextPriority: number;
  onClose: () => void;
}) {
  const saveRule = useSaveCostRule();
  const [draft, setDraft] = useState<RuleDraft>(() => emptyRuleDraft(nextPriority));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDraft(rule ? ruleToDraft(rule) : emptyRuleDraft(nextPriority));
  }, [open, rule, nextPriority]);

  const models = draft.modelsText
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const multiply = draft.multiplyText.trim() === "" ? null : Number(draft.multiplyText);
  const usesThreshold = conditionUsesThreshold(draft.condition);
  const usesModels = draft.condition === "MODEL_IS";

  async function submit() {
    if (!draft.labelFa.trim()) {
      setError("برچسب قاعده الزامی است.");
      return;
    }
    if (usesModels && models.length === 0) {
      setError("برای شرط «مدل مورد استفاده» دست‌کم یک شناسهٔ مدل لازم است.");
      return;
    }
    if (multiply !== null && (!Number.isFinite(multiply) || multiply <= 0)) {
      setError("ضریب باید عددی بزرگ‌تر از صفر باشد.");
      return;
    }
    setError(null);
    try {
      await saveRule.mutateAsync({
        id: draft.id,
        profileId: profile.id,
        activity: profile.activity,
        labelFa: draft.labelFa.trim(),
        enabled: draft.enabled,
        priority: draft.priority,
        condition: draft.condition,
        min: usesThreshold ? draft.min : null,
        max: draft.condition === "MESSAGE_INDEX_RANGE" ? draft.max : null,
        models: usesModels ? models : [],
        addEnergy: draft.addEnergy,
        multiply,
      });
      snackbar.show({ message: "قاعدهٔ هزینه ذخیره شد.", variant: "success" });
      onClose();
    } catch (err) {
      setError(errMessage(err, "ذخیرهٔ قاعده ناموفق بود"));
    }
  }

  return (
    <Drawer open={open} onClose={onClose} width={460} title={rule ? "ویرایش قاعدهٔ هزینه" : "قاعدهٔ هزینهٔ جدید"}>
      <div className="space-y-4">
        <Field label="برچسب قاعده">
          <TextInput
            value={draft.labelFa}
            placeholder="مثال: پیام‌های نخست گفتگو"
            onChange={(e) => setDraft((d) => ({ ...d, labelFa: e.target.value }))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="شرط">
            <Select
              value={draft.condition}
              onChange={(e) =>
                setDraft((d) => ({ ...d, condition: e.target.value as ServiceCostRuleCondition }))
              }
            >
              {RULE_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {SERVICE_COST_RULE_CONDITION_FA[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="اولویت" hint="عدد کمتر، زودتر اجرا می‌شود.">
            <TextInput
              type="number"
              value={draft.priority}
              onChange={(e) => setDraft((d) => ({ ...d, priority: Number(e.target.value) }))}
            />
          </Field>
        </div>

        {usesThreshold && (
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={
                draft.condition === "MESSAGE_INDEX_RANGE" ? "از شمارهٔ پیام" : "آستانه (بیشتر از)"
              }
            >
              <TextInput
                type="number"
                value={draft.min ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    min: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </Field>
            {draft.condition === "MESSAGE_INDEX_RANGE" && (
              <Field label="تا شمارهٔ پیام" hint="خالی = بی‌نهایت">
                <TextInput
                  type="number"
                  value={draft.max ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      max: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                />
              </Field>
            )}
          </div>
        )}

        {usesModels && (
          <Field label="شناسه‌های مدل" hint="با کاما جدا کنید. مثال: gpt-4o, claude-sonnet-4-6">
            <TextInput
              dir="ltr"
              value={draft.modelsText}
              onChange={(e) => setDraft((d) => ({ ...d, modelsText: e.target.value }))}
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="انرژی افزوده" hint="در صورت تطابق، یک‌بار افزوده می‌شود.">
            <TextInput
              type="number"
              value={draft.addEnergy}
              onChange={(e) => setDraft((d) => ({ ...d, addEnergy: Number(e.target.value) }))}
            />
          </Field>
          <Field label="ضریب (اختیاری)" hint="خالی = بدون ضریب">
            <TextInput
              type="number"
              step="0.1"
              value={draft.multiplyText}
              onChange={(e) => setDraft((d) => ({ ...d, multiplyText: e.target.value }))}
            />
          </Field>
        </div>

        <label className="flex items-center justify-between rounded-medium border border-divider px-3 py-2">
          <span className="text-body-2 text-on-surface-variant">قاعده فعال باشد</span>
          <Switch
            checked={draft.enabled}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
          />
        </label>

        {error && <InfoBanner tone="warning">{error}</InfoBanner>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button variant="primary" loading={saveRule.isPending} onClick={submit}>
            ذخیره
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Profile editor drawer — prices, unit costs, model multipliers, rule chain
// ---------------------------------------------------------------------------

function ProfileDrawer({
  profileId,
  canManage,
  onClose,
}: {
  profileId: string | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const detail = useCostProfile(profileId);
  const saveProfile = useSaveCostProfile();
  const deleteRule = useDeleteCostRule();

  const [draft, setDraft] = useState<SaveCostProfileInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ServiceCostRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<ServiceCostRule | null>(null);

  const profile = detail.data?.profile;

  useEffect(() => {
    if (!profile) {
      setDraft(null);
      return;
    }
    setError(null);
    setDraft({
      id: profile.id,
      serviceKey: profile.serviceKey,
      nameFa: profile.nameFa,
      descriptionFa: profile.descriptionFa,
      activity: profile.activity,
      enabled: profile.enabled,
      baseRequestCost: profile.baseRequestCost,
      inputTokenPer1k: profile.inputTokenPer1k,
      outputTokenPer1k: profile.outputTokenPer1k,
      contextTokenPer1k: profile.contextTokenPer1k,
      unitCosts: { ...profile.unitCosts },
      modelMultipliers: { ...profile.modelMultipliers },
    });
  }, [profile]);

  const rules = detail.data?.rules ?? [];

  async function submit() {
    if (!draft) return;
    if (!draft.nameFa.trim()) {
      setError("نام سرویس الزامی است.");
      return;
    }
    setError(null);
    try {
      await saveProfile.mutateAsync(draft);
      snackbar.show({ message: "هزینهٔ سرویس ذخیره شد.", variant: "success" });
      onClose();
    } catch (err) {
      setError(errMessage(err, "ذخیرهٔ هزینهٔ سرویس ناموفق بود"));
    }
  }

  async function confirmDeleteRule() {
    if (!deletingRule) return;
    try {
      await deleteRule.mutateAsync({ id: deletingRule.id, profileId: deletingRule.profileId });
      snackbar.show({ message: "قاعده حذف شد.", variant: "success" });
      setDeletingRule(null);
    } catch (err) {
      snackbar.show({ message: errMessage(err, "حذف قاعده ناموفق بود"), variant: "error" });
    }
  }

  const modelEntries = Object.entries(draft?.modelMultipliers ?? {});

  return (
    <>
      <Drawer
        open={Boolean(profileId)}
        onClose={onClose}
        width={560}
        title={profile ? `هزینهٔ سرویس — ${profile.nameFa}` : "هزینهٔ سرویس"}
      >
        {detail.isLoading ? (
          <LoadingBlock rows={6} />
        ) : detail.isError || !draft || !profile ? (
          <ErrorBlock onRetry={() => detail.refetch()} />
        ) : (
          <div className="space-y-5">
            <InfoBanner tone="info">
              تا زمانی که این سرویس «فعال» نباشد، موتور مصرف همان هزینهٔ ثابت رجیستری را اعمال
              می‌کند و این مدل هیچ اثری ندارد.
            </InfoBanner>

            <div className="space-y-3">
              <Field label="نام سرویس (فارسی)">
                <TextInput
                  value={draft.nameFa}
                  disabled={!canManage}
                  onChange={(e) => setDraft((d) => (d ? { ...d, nameFa: e.target.value } : d))}
                />
              </Field>
              <Field label="توضیح">
                <TextArea
                  rows={2}
                  value={draft.descriptionFa ?? ""}
                  disabled={!canManage}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, descriptionFa: e.target.value } : d))
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="فعالیت موتور مصرف">
                  <Select
                    value={draft.activity}
                    disabled
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, activity: e.target.value as ActivityType } : d))
                    }
                  >
                    <option value={draft.activity}>{ACTIVITY_LABEL[draft.activity]}</option>
                  </Select>
                </Field>
                <Field label="کلید سرویس" hint="شناسهٔ پایدار، تغییرناپذیر">
                  <TextInput dir="ltr" value={draft.serviceKey} disabled />
                </Field>
              </div>
              <label className="flex items-center justify-between rounded-medium border border-divider px-3 py-2">
                <span className="text-body-2 text-on-surface-variant">
                  اعمال این مدل هزینه (فعال)
                </span>
                <Switch
                  checked={draft.enabled}
                  disabled={!canManage}
                  onChange={(e) => setDraft((d) => (d ? { ...d, enabled: e.target.checked } : d))}
                />
              </label>
            </div>

            <SectionRow title="هزینهٔ پایه و توکن‌ها">
              <div className="grid gap-3 tablet:grid-cols-2">
                <Field label="هزینهٔ پایهٔ هر درخواست (واحد انرژی)">
                  <TextInput
                    type="number"
                    value={draft.baseRequestCost}
                    disabled={!canManage}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, baseRequestCost: Number(e.target.value) } : d))
                    }
                  />
                </Field>
                <div className="hidden tablet:block" />
                <Field label="هر ۱۰۰۰ توکن ورودی">
                  <TextInput
                    type="number"
                    value={draft.inputTokenPer1k}
                    disabled={!canManage}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, inputTokenPer1k: Number(e.target.value) } : d))
                    }
                  />
                </Field>
                <Field label="هر ۱۰۰۰ توکن خروجی">
                  <TextInput
                    type="number"
                    value={draft.outputTokenPer1k}
                    disabled={!canManage}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, outputTokenPer1k: Number(e.target.value) } : d))
                    }
                  />
                </Field>
                <Field label="هر ۱۰۰۰ توکن زمینه (Context)">
                  <TextInput
                    type="number"
                    value={draft.contextTokenPer1k}
                    disabled={!canManage}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, contextTokenPer1k: Number(e.target.value) } : d))
                    }
                  />
                </Field>
              </div>
            </SectionRow>

            <SectionRow title="هزینهٔ واحدهای جانبی">
              <div className="grid gap-3 tablet:grid-cols-2">
                {SERVICE_COST_UNITS.map((unit: ServiceCostUnit) => (
                  <Field key={unit} label={SERVICE_COST_UNIT_FA[unit]}>
                    <TextInput
                      type="number"
                      value={draft.unitCosts[unit] ?? 0}
                      disabled={!canManage}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setDraft((d) => {
                          if (!d) return d;
                          const unitCosts = { ...d.unitCosts };
                          if (v > 0) unitCosts[unit] = v;
                          else Reflect.deleteProperty(unitCosts, unit);
                          return { ...d, unitCosts };
                        });
                      }}
                    />
                  </Field>
                ))}
              </div>
            </SectionRow>

            <SectionRow title="ضرایب مدل">
              {modelEntries.length === 0 ? (
                <p className="text-caption text-muted">
                  ضریبی ثبت نشده است؛ همهٔ مدل‌ها با ضریب ۱ محاسبه می‌شوند.
                </p>
              ) : (
                <ul className="space-y-2">
                  {modelEntries.map(([model, factor]) => (
                    <li key={model} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-mono text-caption" dir="ltr">
                        {model}
                      </span>
                      <TextInput
                        type="number"
                        step="0.1"
                        value={factor}
                        disabled={!canManage}
                        className="w-24"
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setDraft((d) => {
                            if (!d) return d;
                            const modelMultipliers = { ...d.modelMultipliers, [model]: v };
                            return { ...d, modelMultipliers };
                          });
                        }}
                      />
                      {canManage && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="حذف ضریب"
                          onClick={() =>
                            setDraft((d) => {
                              if (!d) return d;
                              const modelMultipliers = { ...d.modelMultipliers };
                              Reflect.deleteProperty(modelMultipliers, model);
                              return { ...d, modelMultipliers };
                            })
                          }
                        >
                          <IconDelete size={15} />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canManage && <AddModelRow onAdd={(model, factor) =>
                setDraft((d) =>
                  d ? { ...d, modelMultipliers: { ...d.modelMultipliers, [model]: factor } } : d
                )
              } />}
            </SectionRow>

            <SectionRow
              title="قواعد هزینه"
              action={
                canManage && (
                  <Button
                    size="sm"
                    variant="tonal"
                    startIcon={<IconAdd size={15} />}
                    onClick={() => {
                      setEditingRule(null);
                      setRuleOpen(true);
                    }}
                  >
                    قاعدهٔ جدید
                  </Button>
                )
              }
            >
              {rules.length === 0 ? (
                <p className="text-caption text-muted">قاعده‌ای ثبت نشده است.</p>
              ) : (
                <ul className="space-y-2">
                  {rules.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start gap-3 rounded-medium border border-divider px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-body-2 font-medium text-on-surface">
                            {r.labelFa}
                          </span>
                          <Badge tone={r.enabled ? "success" : "neutral"} dot>
                            {r.enabled ? "فعال" : "غیرفعال"}
                          </Badge>
                          <span className="text-caption text-muted" dir="ltr">
                            #{toPersianNumber(r.priority)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-caption text-muted">
                          {SERVICE_COST_RULE_CONDITION_FA[r.condition]}
                          {r.min != null && ` · ${toPersianNumber(r.min)}`}
                          {r.max != null && ` → ${toPersianNumber(r.max)}`}
                          {r.models.length > 0 && ` · ${r.models.join(", ")}`}
                          {` · +${toPersianNumber(r.addEnergy)}`}
                          {r.multiply != null && ` · ×${toPersianNumber(r.multiply)}`}
                        </p>
                      </div>
                      {canManage && (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            title="ویرایش قاعده"
                            onClick={() => {
                              setEditingRule(r);
                              setRuleOpen(true);
                            }}
                          >
                            <IconEdit size={15} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="حذف قاعده"
                            onClick={() => setDeletingRule(r)}
                          >
                            <IconDelete size={15} />
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SectionRow>

            {error && <InfoBanner tone="warning">{error}</InfoBanner>}

            {canManage && (
              <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-divider bg-surface px-4 py-3">
                <Button variant="ghost" onClick={onClose}>
                  بستن
                </Button>
                <Button variant="primary" loading={saveProfile.isPending} onClick={submit}>
                  ذخیرهٔ هزینهٔ سرویس
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {profile && (
        <RuleDialog
          open={ruleOpen}
          profile={profile}
          rule={editingRule}
          nextPriority={(rules[rules.length - 1]?.priority ?? 0) + 10}
          onClose={() => setRuleOpen(false)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deletingRule)}
        onClose={() => setDeletingRule(null)}
        onConfirm={confirmDeleteRule}
        title="حذف قاعدهٔ هزینه"
        description={
          deletingRule
            ? `قاعدهٔ «${deletingRule.labelFa}» حذف شود؟ این عمل بازگشت‌پذیر نیست.`
            : undefined
        }
        confirmLabel="حذف"
        destructive
        loading={deleteRule.isPending}
      />
    </>
  );
}

/** A tiny titled sub-block inside the profile drawer. */
function SectionRow({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-large border border-divider p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-body-2 font-bold text-on-surface">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

/** The add-a-model-multiplier inline row. */
function AddModelRow({ onAdd }: { onAdd: (model: string, factor: number) => void }) {
  const [model, setModel] = useState("");
  const [factor, setFactor] = useState("1.5");

  function commit() {
    const id = model.trim();
    if (!id) return;
    const f = Number(factor);
    onAdd(id, Number.isFinite(f) && f > 0 ? f : 1);
    setModel("");
    setFactor("1.5");
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <TextInput
        dir="ltr"
        value={model}
        placeholder="model-id"
        aria-label="شناسهٔ مدل"
        onChange={(e) => setModel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
      />
      <TextInput
        type="number"
        step="0.1"
        value={factor}
        className="w-24"
        aria-label="ضریب مدل"
        onChange={(e) => setFactor(e.target.value)}
      />
      <Button size="sm" variant="secondary" onClick={commit} disabled={!model.trim()}>
        افزودن
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profiles table
// ---------------------------------------------------------------------------

function ProfilesSection({ canManage }: { canManage: boolean }) {
  const profiles = useCostProfiles();
  const saveProfile = useSaveCostProfile();
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const items = profiles.data?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        p.nameFa.toLowerCase().includes(q) ||
        p.serviceKey.toLowerCase().includes(q) ||
        ACTIVITY_LABEL[p.activity].toLowerCase().includes(q)
    );
  }, [items, search]);

  async function toggleEnabled(p: ServiceCostProfile, enabled: boolean) {
    try {
      await saveProfile.mutateAsync({
        id: p.id,
        serviceKey: p.serviceKey,
        nameFa: p.nameFa,
        descriptionFa: p.descriptionFa,
        activity: p.activity,
        enabled,
        baseRequestCost: p.baseRequestCost,
        inputTokenPer1k: p.inputTokenPer1k,
        outputTokenPer1k: p.outputTokenPer1k,
        contextTokenPer1k: p.contextTokenPer1k,
        unitCosts: p.unitCosts,
        modelMultipliers: p.modelMultipliers,
      });
      snackbar.show({
        message: enabled ? "مدل هزینهٔ سرویس فعال شد." : "مدل هزینهٔ سرویس غیرفعال شد.",
        variant: "success",
      });
    } catch (err) {
      snackbar.show({ message: errMessage(err, "به‌روزرسانی ناموفق بود"), variant: "error" });
    }
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="w-full mobile:w-72">
          <SearchInput value={search} onChange={setSearch} placeholder="جست‌وجوی سرویس…" />
        </div>
        <ExportButton kind="services" label="خروجی مدل هزینه" />
      </div>

      <StateView query={profiles} loadingRows={6}>
        {() =>
          filtered.length === 0 ? (
            <EmptyBlock message="سرویسی مطابق جست‌وجو یافت نشد." />
          ) : (
            <DataTable
              minWidth={820}
              head={
                <tr>
                  <Th>سرویس</Th>
                  <Th>فعال</Th>
                  <Th>هزینهٔ پایه</Th>
                  <Th>توکن (ورودی/خروجی/زمینه)</Th>
                  <Th>واحدهای جانبی</Th>
                  <Th>ضرایب مدل</Th>
                  <Th>تنظیمات</Th>
                </tr>
              }
            >
              {filtered.map((p) => {
                const units = Object.entries(p.unitCosts);
                const models = Object.keys(p.modelMultipliers);
                return (
                  <tr key={p.id}>
                    <Td>
                      <div className="flex flex-col">
                        <span className="font-medium text-on-surface">{p.nameFa}</span>
                        <span className="text-caption text-muted" dir="ltr">
                          {p.serviceKey}
                        </span>
                        <span className="text-caption text-muted">{ACTIVITY_LABEL[p.activity]}</span>
                      </div>
                    </Td>
                    <Td>
                      <Switch
                        checked={p.enabled}
                        disabled={!canManage}
                        onChange={(e) => toggleEnabled(p, e.target.checked)}
                      />
                    </Td>
                    <Td>
                      <span className="tabular-nums">{toPersianNumber(p.baseRequestCost)}</span>
                    </Td>
                    <Td>
                      <span className="text-caption tabular-nums" dir="ltr">
                        {toPersianNumber(p.inputTokenPer1k)} / {toPersianNumber(p.outputTokenPer1k)} /
                        {" "}
                        {toPersianNumber(p.contextTokenPer1k)}
                      </span>
                    </Td>
                    <Td>
                      {units.length === 0 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className="text-caption text-muted">
                          {toPersianNumber(units.length)} واحد
                        </span>
                      )}
                    </Td>
                    <Td>
                      {models.length === 0 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className="text-caption text-muted" dir="ltr" title={models.join(", ")}>
                          {models.length}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Button
                        size="sm"
                        variant="secondary"
                        startIcon={<IconEdit size={15} />}
                        onClick={() => setOpenId(p.id)}
                      >
                        مدیریت
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </DataTable>
          )
        }
      </StateView>

      <ProfileDrawer profileId={openId} canManage={canManage} onClose={() => setOpenId(null)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Ledger table
// ---------------------------------------------------------------------------

function LedgerSection() {
  const profiles = useCostProfiles();
  const [userId, setUserId] = useState("");
  const [serviceKey, setServiceKey] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  const query = useMemo(
    () => ({
      userId: userId.trim() || undefined,
      serviceKey: serviceKey || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [userId, serviceKey, from, to]
  );

  const ledger = useUsageLedger(query);
  const items = ledger.data?.items ?? [];

  // Reset to the first page whenever the filter set changes.
  useEffect(() => {
    setPage(0);
  }, [query]);

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const serviceOptions = profiles.data?.items ?? [];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full mobile:w-64">
            <Field label="شناسهٔ کاربر">
              <TextInput
                dir="ltr"
                value={userId}
                placeholder="usr-…"
                onChange={(e) => setUserId(e.target.value)}
              />
            </Field>
          </div>
          <div className="w-full mobile:w-56">
            <Field label="سرویس">
              <Select value={serviceKey} onChange={(e) => setServiceKey(e.target.value)}>
                <option value="">همهٔ سرویس‌ها</option>
                {serviceOptions.map((s) => (
                  <option key={s.id} value={s.serviceKey}>
                    {s.nameFa}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div>
            <Field label="از تاریخ">
              <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
          </div>
          <div>
            <Field label="تا تاریخ">
              <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          {(userId || serviceKey || from || to) && (
            <Button
              variant="ghost"
              startIcon={<IconRefresh size={15} />}
              onClick={() => {
                setUserId("");
                setServiceKey("");
                setFrom("");
                setTo("");
              }}
            >
              پاک کردن
            </Button>
          )}
        </div>
        <ExportButton kind="energy-usage" label="خروجی دفتر مصرف" />
      </div>

      <StateView
        query={ledger}
        loadingRows={8}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="تراکنش مصرفی مطابق فیلتر یافت نشد."
        emptyHint="با تغییر بازه یا سرویس دوباره تلاش کنید."
      >
        {() => (
          <>
            <DataTable
              minWidth={900}
              head={
                <tr>
                  <Th>زمان</Th>
                  <Th>کاربر</Th>
                  <Th>سرویس</Th>
                  <Th>مدل</Th>
                  <Th>توکن (ورودی/خروجی)</Th>
                  <Th>RAG</Th>
                  <Th>انرژی</Th>
                  <Th>منبع</Th>
                  <Th>وضعیت</Th>
                </tr>
              }
            >
              {pageItems.map((row) => (
                <tr key={row.id}>
                  <Td title={new Date(row.createdAt).toLocaleString("fa-IR")}>
                      {toRelativeTime(row.createdAt)}
                    </Td>
                    <Td>
                      <span className="font-mono text-caption text-muted" dir="ltr" title={row.userId}>
                        {row.userId.length > 14 ? `${row.userId.slice(0, 14)}…` : row.userId}
                      </span>
                    </Td>
                    <Td>{ACTIVITY_LABEL[row.activityType] ?? row.serviceKey}</Td>
                    <Td>
                      {row.model ? (
                        <span className="font-mono text-caption" dir="ltr">
                          {row.model}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      <span className="tabular-nums text-caption" dir="ltr">
                        {toPersianNumber(row.inputTokens)} / {toPersianNumber(row.outputTokens)}
                      </span>
                    </Td>
                    <Td>
                      {row.ragCalls > 0 ? (
                        <Badge tone="brand">{toPersianNumber(row.ragCalls)}</Badge>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      <span className="font-medium tabular-nums text-on-surface">
                        {toPersianNumber(row.totalEnergy)}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-caption text-muted">{CREDIT_SOURCE_FA[row.creditSource]}</span>
                    </Td>
                    <Td>
                      <Badge tone={LEDGER_STATUS_FA[row.status].tone}>
                        {LEDGER_STATUS_FA[row.status].label}
                      </Badge>
                    </Td>
                  </tr>
              ))}
            </DataTable>

            {pageCount > 1 && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-caption text-muted">
                  {toPersianNumber(items.length)} تراکنش · صفحهٔ {toPersianNumber(page + 1)} از{" "}
                  {toPersianNumber(pageCount)}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    قبلی
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={page >= pageCount - 1}
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  >
                    بعدی
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </StateView>
    </>
  );
}

// ---------------------------------------------------------------------------
// The page-level center
// ---------------------------------------------------------------------------

type EnergyTab = "summary" | "services" | "ledger";

/**
 * The complete §6 surface. `canManage` is derived once at the page from the
 * caller's own permission set; it only hides controls — the server re-checks
 * `admin:energy:manage` on every mutation regardless.
 */
export function EnergyCostCenter({ canManage }: { canManage: boolean }) {
  const [tab, setTab] = useState<EnergyTab>("summary");

  const tabs: TabItem<EnergyTab>[] = [
    { value: "summary", label: "خلاصه و شاخص‌ها", icon: <IconBolt size={16} /> },
    { value: "services", label: "هزینهٔ خدمات", icon: <IconCoin size={16} /> },
    { value: "ledger", label: "دفتر مصرف", icon: <IconDatabase size={16} /> },
  ];

  return (
    <div>
      <PageHeader
        title="انرژی و هزینهٔ خدمات"
        description="مدیریت مدل هزینهٔ مبتنی بر مصرف (Usage‑Billing): هزینهٔ پایه، هزینهٔ توکن، واحدهای جانبی، ضرایب مدل و زنجیرهٔ قواعد. تمام مصرف‌ها از یک موتور و یک دفتر واحد عبور می‌کنند."
        icon={<IconBolt size={22} />}
        actions={<ExportButton kind="energy-usage" label="خروجی انرژی" size="md" />}
      />

      {!canManage && (
        <InfoBanner tone="warning">
          شما مجوز «مدیریت انرژی» را ندارید؛ این صفحه فقط‌خواندنی است. هر تغییر سمت سرور نیز
          مجوزسنجی و ثبت می‌شود.
        </InfoBanner>
      )}

      <Tabs items={tabs} value={tab} onChange={setTab} ariaLabel="بخش‌های انرژی و هزینه" />

      {tab === "summary" && <SummarySection />}
      {tab === "services" && <ProfilesSection canManage={canManage} />}
      {tab === "ledger" && <LedgerSection />}
    </div>
  );
}
