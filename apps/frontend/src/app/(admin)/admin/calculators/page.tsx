// ============================================================
// LEGALIR — Admin · Calculators & Legal Data (ماشین‌حساب‌ها و داده‌های حقوقی)
// ============================================================
// Two layers live here:
//
//   1. the READ-ONLY inventory — every rate a calculator multiplies by lives
//      in a versioned code module, not a database row, so the annual update is
//      a reviewed code change with full provenance (never an ad-hoc edit);
//   2. the OPERATIONAL policy (§5) — enabled/disabled, access tier, and the
//      per-run energy cost. That policy IS database-backed (`calculator_settings`)
//      and is enforced server-side by the run endpoint, through a real ledger row.
//
// Honesty: "needs annual update" is DERIVED from the data (a dataset whose
// year trails the newest year on the platform), never asserted here.
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import { Drawer, Switch, snackbar } from "@legalir/ui";
import {
  useCalculatorsInventory,
  useUpdateCalculatorSetting,
  useCalculatorRules,
  useCalculatorRuleDetail,
  useSaveCalculatorRuleDraft,
  usePreviewCalculatorRuleDraft,
  usePublishCalculatorRule,
  useRollbackCalculatorRule,
  useDeleteCalculatorRuleDraft,
} from "@/hooks/useAdmin";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  CALCULATOR_ACCESS_TIER_FA,
  CALCULATOR_RULE_STATUS_FA,
} from "@legalir/types";
import type {
  CalculatorAccessTier,
  CalculatorSetting,
  CalculatorRuleSummary,
  CalculatorRuleDetail,
  CalculatorRuleVersion,
  RuleField,
  RulePublishPreview,
} from "@legalir/types";
import {
  PageHeader,
  StatCard,
  Card,
  DataTable,
  Th,
  Td,
  Badge,
  StateView,
  FilterPills,
  InfoBanner,
  Section,
  ExportButton,
  Button,
  Field,
  TextInput,
  TextArea,
  Select,
} from "@/components/admin/ui";
import { IconSettings } from "@/lib/icons";

const ACCESS_TIERS: CalculatorAccessTier[] = ["free", "subscription", "purchase", "restricted"];

const TIER_TONES: Record<CalculatorAccessTier, "neutral" | "success" | "info" | "warning"> = {
  free: "success",
  subscription: "info",
  purchase: "info",
  restricted: "warning",
};

const CONFIDENCE_FA: Record<string, string> = {
  high: "قطعیت بالا",
  medium: "قطعیت متوسط",
  low: "قطعیت پایین",
};

const CONFIDENCE_TONES: Record<
  string,
  "success" | "warning" | "danger" | "neutral"
> = {
  high: "success",
  medium: "warning",
  low: "danger",
};

const CATEGORY_FA: Record<string, string> = {
  civil: "مدنی",
  contracts: "قراردادها",
  employment: "کار و استخدام",
  family: "خانواده",
  injury: "صدمات بدنی",
  judicial: "قضایی",
  property: "اموال و املاک",
};

type Scope = "" | "available" | "unavailable";

export default function AdminCalculatorsPage() {
  const query = useCalculatorsInventory();
  const [scope, setScope] = useState<Scope>("");
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editingRulesId, setEditingRulesId] = useState<string | null>(null);

  const filters = useMemo(
    () => [
      { value: "" as Scope, label: "همه" },
      { value: "available" as Scope, label: "فعال" },
      { value: "unavailable" as Scope, label: "نیازمند تکمیل" },
    ],
    []
  );

  const needing = query.data
    ? query.data.totalCalculators - query.data.availableCalculators
    : 0;

  const settingsBySlug = useMemo(() => {
    const map = new Map<string, CalculatorSetting>();
    for (const s of query.data?.settings ?? []) map.set(s.slug, s);
    return map;
  }, [query.data]);

  const rulesQuery = useCalculatorRules();
  const ruleByDataset = useMemo(() => {
    const map = new Map<string, CalculatorRuleSummary>();
    for (const r of rulesQuery.data?.items ?? []) map.set(r.datasetId, r);
    return map;
  }, [rulesQuery.data]);

  return (
    <div>
      <PageHeader
        title="ماشین‌حساب‌ها و داده‌های حقوقی"
        description="سیاههٔ ماشین‌حساب‌های حقوقی و مجموعه‌داده‌های نرخ. نرخ‌ها از ماژول‌های نسخه‌دار کد می‌آیند و از طریق بازبینی کد به‌روزرسانی می‌شوند؛ اما سیاست عملیاتی هر ماشین‌حساب (فعال/غیرفعال، سطح دسترسی و هزینهٔ انرژی) از همین‌جا مدیریت و در سرور اعمال می‌شود."
        actions={<ExportButton kind="calculators" />}
      />

      {query.data && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-6">
            <StatCard label="کل ماشین‌حساب‌ها" value={query.data.totalCalculators} />
            <StatCard
              label="پیاده‌سازی‌شده"
              value={query.data.availableCalculators}
              tone="success"
            />
            <StatCard
              label="نیازمند تکمیل"
              value={needing}
              tone={needing > 0 ? "warning" : "default"}
            />
            <StatCard
              label="غیرفعال"
              value={query.data.disabledCalculators}
              tone={query.data.disabledCalculators > 0 ? "warning" : "default"}
              hint="توسط مدیر خاموش شده‌اند"
            />
            <StatCard
              label="هزینهٔ انرژی‌دار"
              value={query.data.chargedCalculators}
              hint="هر اجرا انرژی مصرف می‌کند"
            />
            <StatCard
              label="سال جاری محاسبه"
              value={query.data.currentYear}
              hint="جدیدترین سال موجود در مجموعه‌داده‌ها"
            />
          </div>

          {query.data.staleDatasets.length > 0 && (
            <InfoBanner tone="warning">
              {toPersianNumber(query.data.staleDatasets.length)} مجموعه‌داده سال
              عقب‌تر از سال جاری است و نیازمند به‌روزرسانی سالانه است. فهرست در
              جدول پایین با برچسب «نیاز به به‌روزرسانی» مشخص شده است.
            </InfoBanner>
          )}
        </>
      )}

      <Section title="ماشین‌حساب‌ها" subtitle="وضعیت پیاده‌سازی و کیفیت دادهٔ هر ماشین‌حساب.">
        <div className="mb-3">
          <FilterPills options={filters} value={scope} onChange={setScope} />
        </div>

        <StateView
          query={query}
          loadingRows={8}
          isEmpty={(d) => d.calculators.length === 0}
          emptyMessage="ماشین‌حسابی ثبت نشده است."
        >
          {(data) => {
            const rows = data.calculators.filter((c) =>
              scope === "" ? true : scope === "available" ? c.available : !c.available
            );
            return (
              <DataTable
                head={
                  <tr>
                    <Th>عنوان</Th>
                    <Th>دسته</Th>
                    <Th>قطعیت</Th>
                    <Th>وضعیت</Th>
                    <Th>سطح دسترسی</Th>
                    <Th>انرژی</Th>
                    <Th className="text-end">عملیات</Th>
                  </tr>
                }
              >
                {rows.map((c) => (
                  <tr key={c.id} className={c.enabled ? "" : "opacity-60"}>
                    <Td className="max-w-[260px]">
                      <span
                        className="block truncate font-medium text-on-surface"
                        title={c.titleFa}
                      >
                        {c.titleFa}
                      </span>
                      <span className="text-caption text-muted" dir="ltr">
                        {c.slug}
                      </span>
                      {c.warningsFa.length > 0 && (
                        <span
                          className="mt-0.5 block truncate text-caption text-amber-700 dark:text-amber-300"
                          title={c.warningsFa.join(" • ")}
                        >
                          {c.warningsFa[0]}
                        </span>
                      )}
                    </Td>
                    <Td className="text-caption text-muted">
                      {CATEGORY_FA[c.category] ?? c.category}
                    </Td>
                    <Td>
                      <Badge tone={CONFIDENCE_TONES[c.confidence] ?? "neutral"}>
                        {CONFIDENCE_FA[c.confidence] ?? c.confidence}
                      </Badge>
                    </Td>
                    <Td>
                      {!c.enabled ? (
                        <Badge tone="neutral" dot>
                          غیرفعال
                        </Badge>
                      ) : c.available ? (
                        <Badge tone="success" dot>
                          فعال
                        </Badge>
                      ) : (
                        <Badge tone="warning">تکمیل‌نشده</Badge>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={TIER_TONES[c.accessTier]}>
                        {CALCULATOR_ACCESS_TIER_FA[c.accessTier]}
                      </Badge>
                    </Td>
                    <Td className="tabular-nums text-caption">
                      {c.energyCost > 0 ? (
                        <span className="text-on-surface">
                          {toPersianNumber(c.energyCost)}
                        </span>
                      ) : (
                        <span className="text-muted">رایگان</span>
                      )}
                    </Td>
                    <Td className="text-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        startIcon={<IconSettings size={15} />}
                        onClick={() => setEditingSlug(c.slug)}
                      >
                        تنظیمات
                      </Button>
                    </Td>
                  </tr>
                ))}
              </DataTable>
            );
          }}
        </StateView>
      </Section>

      <Section
        title="مجموعه‌داده‌های نرخ"
        subtitle="نسخه، مرجع و بازهٔ اعتبار هر مجموعه‌داده به همراه وضعیت به‌روزرسانی سالانه."
      >
        <StateView
          query={query}
          loadingRows={6}
          isEmpty={(d) => d.datasets.length === 0}
          emptyMessage="مجموعه‌داده‌ای ثبت نشده است."
        >
          {(data) => (
            <DataTable
              head={
                <tr>
                  <Th>عنوان</Th>
                  <Th>سال</Th>
                  <Th>نسخه</Th>
                  <Th>مرجع</Th>
                  <Th>اعتبار</Th>
                  <Th>بازبینی</Th>
                  <Th>وضعیت سالانه</Th>
                  <Th className="text-end">قواعد</Th>
                </tr>
              }
            >
              {data.datasets.map((d) => (
                <tr key={d.id}>
                  <Td className="max-w-[240px]">
                    <span
                      className="block truncate font-medium text-on-surface"
                      title={d.titleFa}
                    >
                      {d.titleFa}
                    </span>
                    {d.notes && (
                      <span className="text-caption text-muted">{d.notes}</span>
                    )}
                  </Td>
                  <Td className="tabular-nums">{toPersianNumber(d.calculationYear)}</Td>
                  <Td dir="ltr" className="text-caption text-muted">
                    {d.version}
                  </Td>
                  <Td className="max-w-[240px]">
                    <span
                      className="block truncate text-caption text-muted"
                      title={`${d.sourceAuthority} — ${d.sourceTitle}`}
                    >
                      {d.sourceAuthority}
                    </span>
                  </Td>
                  <Td className="text-caption text-muted" dir="ltr">
                    {d.effectiveFrom}
                    {d.effectiveTo ? ` → ${d.effectiveTo}` : " → کنون"}
                  </Td>
                  <Td className="text-caption text-muted" dir="ltr">
                    {d.verifiedAt}
                  </Td>
                  <Td>
                    {d.isCurrentYear ? (
                      <Badge tone="success">به‌روز</Badge>
                    ) : d.needsAnnualUpdate ? (
                      <Badge tone="warning">نیاز به به‌روزرسانی</Badge>
                    ) : (
                      <Badge tone="neutral">—</Badge>
                    )}
                  </Td>
                  <Td className="text-end">
                    <div className="flex items-center justify-end gap-2">
                      {ruleByDataset.get(d.id)?.active && <Badge tone="info">بازنویسی فعال</Badge>}
                      {ruleByDataset.get(d.id)?.draft && <Badge tone="warning">پیش‌نویس</Badge>}
                      <Button
                        variant="ghost"
                        size="sm"
                        startIcon={<IconSettings size={15} />}
                        onClick={() => setEditingRulesId(d.id)}
                      >
                        قواعد
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </DataTable>
          )}
        </StateView>
      </Section>

      <Card className="p-4 text-caption text-muted">
        یادآوری: نرخ‌های محاسبه از ماژول‌های نسخه‌دار کد می‌آیند و پایهٔ تأییدشدهٔ هر
        مجموعه‌داده‌اند. از دکمهٔ «قواعد» می‌توان یک <b>نسخهٔ بازنویسی</b> روی یک
        مجموعه‌داده ساخت: ابتدا به‌صورت <b>پیش‌نویس</b> ذخیره، با ورودی نمونه
        اعتبارسنجی و آزمون می‌شود و پس از تأیید <b>منتشر</b> می‌گردد؛ پیش‌نویس تا
        پیش از انتشار بر نتیجهٔ کاربران اثری ندارد و تاریخچهٔ نسخه‌ها حفظ می‌شود.
        همچنین سیاست عملیاتی هر ماشین‌حساب (فعال/غیرفعال، سطح دسترسی و هزینهٔ انرژی)
        از دکمهٔ «تنظیمات» مدیریت و هنگام اجرا در سرور اعمال می‌گردد.
      </Card>

      <Drawer
        open={editingSlug !== null}
        onClose={() => setEditingSlug(null)}
        width={520}
        title="تنظیمات عملیاتی ماشین‌حساب"
      >
        {editingSlug && (
          <CalculatorSettingEditor
            slug={editingSlug}
            setting={settingsBySlug.get(editingSlug)}
            titleFa={
              query.data?.calculators.find((c) => c.slug === editingSlug)?.titleFa ?? editingSlug
            }
            onClose={() => setEditingSlug(null)}
          />
        )}
      </Drawer>

      <Drawer
        open={editingRulesId !== null}
        onClose={() => setEditingRulesId(null)}
        width={720}
        title="قواعد محاسبه — نسخه‌دار"
      >
        {editingRulesId && (
          <CalculatorRuleEditor
            datasetId={editingRulesId}
            onClose={() => setEditingRulesId(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

// ---------------------------------------------------------------------------
// Per-calculator operational settings (§5)
// ---------------------------------------------------------------------------
// A Drawer form that edits the DB-backed policy for ONE calculator: enabled,
// access tier, per-run energy cost, and the allow-lists used when the tier is
// "restricted". The same policy is what the run endpoint enforces.

function CalculatorSettingEditor({
  slug,
  setting,
  titleFa,
  onClose,
}: {
  slug: string;
  setting: CalculatorSetting | undefined;
  titleFa: string;
  onClose: () => void;
}) {
  const save = useUpdateCalculatorSetting();
  const [enabled, setEnabled] = useState(setting?.enabled ?? true);
  const [accessTier, setAccessTier] = useState<CalculatorAccessTier>(
    setting?.accessTier ?? "free"
  );
  const [energyCost, setEnergyCost] = useState(String(setting?.energyCost ?? 0));
  const [allowedPlans, setAllowedPlans] = useState((setting?.allowedPlans ?? []).join(", "));
  const [allowedUserIds, setAllowedUserIds] = useState(
    (setting?.allowedUserIds ?? []).join(", ")
  );

  const costNumber = Number(energyCost);
  const costError =
    energyCost.trim() === "" || !Number.isFinite(costNumber) || costNumber < 0
      ? "هزینهٔ انرژی باید عددی نامنفی باشد."
      : undefined;

  async function submit() {
    if (costError) return;
    try {
      await save.mutateAsync({
        slug,
        input: {
          enabled,
          accessTier,
          energyCost: Math.round(costNumber),
          allowedPlans: allowedPlans
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          allowedUserIds: allowedUserIds
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });
      snackbar.show({ message: "تنظیمات ماشین‌حساب ذخیره شد.", variant: "success" });
      onClose();
    } catch (err) {
      snackbar.show({ message: errMessage(err, "ذخیرهٔ تنظیمات ناموفق بود"), variant: "error" });
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-large border border-divider bg-surface-container p-3">
        <p className="font-medium text-on-surface">{titleFa}</p>
        <p className="mt-0.5 text-caption text-muted" dir="ltr">
          {slug}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-large border border-divider p-3">
        <div>
          <p className="font-medium text-on-surface">فعال بودن</p>
          <p className="mt-0.5 text-caption text-muted">
            با خاموش‌کردن، اجرای این ماشین‌حساب برای همهٔ کاربران در سرور مسدود می‌شود.
          </p>
        </div>
        <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} label="فعال" />
      </div>

      <Field label="سطح دسترسی">
        <Select
          value={accessTier}
          onChange={(e) => setAccessTier(e.target.value as CalculatorAccessTier)}
        >
          {ACCESS_TIERS.map((t) => (
            <option key={t} value={t}>
              {CALCULATOR_ACCESS_TIER_FA[t]}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="هزینهٔ انرژی هر اجرا (امتیاز)"
        hint="۰ = رایگان. این مبلغ هنگام اجرای واقعی در سرور از اعتبار کاربر کسر می‌شود."
        error={costError}
      >
        <TextInput
          type="number"
          min={0}
          inputMode="numeric"
          dir="ltr"
          value={energyCost}
          onChange={(e) => setEnergyCost(e.target.value)}
        />
      </Field>

      {accessTier === "restricted" && (
        <>
          <Field
            label="پلن‌های مجاز"
            hint="کد پلن‌ها را با کاما جدا کنید (مثلاً gold, diamond)."
          >
            <TextInput
              dir="ltr"
              value={allowedPlans}
              onChange={(e) => setAllowedPlans(e.target.value)}
              placeholder="gold, diamond"
            />
          </Field>
          <Field
            label="شناسهٔ کاربران مجاز"
            hint="شناسهٔ کاربران را با کاما جدا کنید."
          >
            <TextInput
              dir="ltr"
              value={allowedUserIds}
              onChange={(e) => setAllowedUserIds(e.target.value)}
              placeholder="user-id-1, user-id-2"
            />
          </Field>
        </>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>
          انصراف
        </Button>
        <Button onClick={submit} loading={save.isPending} disabled={Boolean(costError)}>
          ذخیره
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-dataset rule versions (§5-rules)
// ---------------------------------------------------------------------------
// A Drawer that renders a dataset's structure-aware rate schema and lets an
// admin edit it as a DRAFT. Nothing here changes user results: a draft is
// validated + tested with sample inputs, then published (or discarded). Only a
// published version, whose effective date has arrived, is applied in the
// backend. The editor renders ONLY the shapes the schema allows — no raw JSON,
// no executable expressions.

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** The sparse patch: only top-level rate keys that differ from the baseline. */
function sparsePatch(
  baseline: Record<string, unknown>,
  values: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (JSON.stringify(v) !== JSON.stringify(baseline[k])) out[k] = v;
  }
  return out;
}

const VERIF_FA: Record<"verified" | "pending", string> = {
  verified: "تأییدشده",
  pending: "نیازمند بازبینی",
};

function CalculatorRuleEditor({
  datasetId,
  onClose,
}: {
  datasetId: string;
  onClose: () => void;
}) {
  const detailQuery = useCalculatorRuleDetail(datasetId);
  const save = useSaveCalculatorRuleDraft();
  const preview = usePreviewCalculatorRuleDraft();
  const publish = usePublishCalculatorRule();
  const rollback = useRollbackCalculatorRule();
  const discard = useDeleteCalculatorRuleDraft();

  const detail: CalculatorRuleDetail | undefined = detailQuery.data;

  const [values, setValues] = useState<Record<string, unknown> | null>(null);
  const [note, setNote] = useState("");
  const [from, setFrom] = useState(todayStr());
  const [verif, setVerif] = useState<"verified" | "pending">("pending");
  const [previewResult, setPreviewResult] = useState<RulePublishPreview | null>(null);

  // Seed the editor once the dataset's view arrives: the figures in force now,
  // with the open draft (if any) layered on top. Keyed per dataset by the parent.
  useEffect(() => {
    if (!detail || values !== null) return;
    const draft = detail.drafts[0] ?? null;
    setValues(clone({ ...detail.effective.rates, ...(draft?.rates ?? {}) }));
    setNote(draft?.changeNoteFa ?? "");
    setFrom(draft?.effectiveFrom ?? todayStr());
    setVerif(draft?.verificationStatus ?? detail.effective.source.verificationStatus ?? "pending");
  }, [detail, values]);

  if (detailQuery.isLoading || !detail || values === null) {
    return <StateView query={detailQuery}>{() => null}</StateView>;
  }

  const patch = sparsePatch(detail.effective.rates, values);
  const changedKeys = Object.keys(patch);
  const openDraft: CalculatorRuleVersion | null = detail.drafts[0] ?? null;
  const history = detail.history;

  const onFieldChange = (key: string, next: unknown) =>
    setValues((prev) => ({ ...(prev ?? {}), [key]: next }));

  async function saveDraft(): Promise<void> {
    try {
      await save.mutateAsync({
        datasetId,
        input: { rates: patch, changeNoteFa: note, effectiveFrom: from, verificationStatus: verif },
      });
      snackbar.show({ message: "پیش‌نویس ذخیره شد.", variant: "success" });
    } catch (err) {
      snackbar.show({ message: errMessage(err, "ذخیرهٔ پیش‌نویس ناموفق بود"), variant: "error" });
    }
  }

  async function runPreview(): Promise<void> {
    try {
      const res = await preview.mutateAsync({ datasetId, rates: patch });
      setPreviewResult(res);
    } catch (err) {
      snackbar.show({ message: errMessage(err, "آزمون پیش‌نمایش ناموفق بود"), variant: "error" });
    }
  }

  async function doPublish(): Promise<void> {
    if (!openDraft) {
      snackbar.show({ message: "ابتدا پیش‌نویس را ذخیره کنید.", variant: "warning" });
      return;
    }
    if (!note.trim()) {
      snackbar.show({ message: "برای انتشار، توضیح تغییر لازم است.", variant: "warning" });
      return;
    }
    try {
      await publish.mutateAsync({ datasetId, versionId: openDraft.id });
      snackbar.show({ message: "نسخه منتشر شد و از این پس در سرور اعمال می‌شود.", variant: "success" });
      setPreviewResult(null);
    } catch (err) {
      snackbar.show({ message: errMessage(err, "انتشار ناموفق بود"), variant: "error" });
    }
  }

  async function doDiscard(): Promise<void> {
    if (!openDraft) return;
    try {
      await discard.mutateAsync({ datasetId, versionId: openDraft.id });
      snackbar.show({ message: "پیش‌نویس لغو شد.", variant: "success" });
      onClose();
    } catch (err) {
      snackbar.show({ message: errMessage(err, "لغو پیش‌نویس ناموفق بود"), variant: "error" });
    }
  }

  async function doRollback(versionId: string): Promise<void> {
    try {
      await rollback.mutateAsync({ datasetId, versionId });
      snackbar.show({ message: "پیش‌نویس بازگردانی ساخته شد.", variant: "success" });
    } catch (err) {
      snackbar.show({ message: errMessage(err, "بازگردانی ناموفق بود"), variant: "error" });
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-large border border-divider bg-surface-container p-3">
        <p className="font-medium text-on-surface">{detail.titleFa}</p>
        <p className="mt-0.5 text-caption text-muted" dir="ltr">
          {detail.datasetId} · {detail.effective.version}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {detail.effective.fromRule ? (
            <Badge tone="info">نسخهٔ پایگاه‌داده فعال است</Badge>
          ) : (
            <Badge tone="neutral">نسخهٔ کد پایه در جریان است</Badge>
          )}
          <Badge tone={detail.effective.source.verificationStatus === "pending" ? "warning" : "success"}>
            {VERIF_FA[detail.effective.source.verificationStatus ?? "verified"]}
          </Badge>
          {openDraft && <Badge tone="warning">پیش‌نویس باز</Badge>}
          {changedKeys.length > 0 && (
            <Badge tone="info">{toPersianNumber(changedKeys.length)} تغییر ویرایش‌نشده</Badge>
          )}
        </div>
      </div>

      <div className="rounded-large border border-divider p-3 text-caption text-muted">
        <p className="text-on-surface-variant">
          مرجع: {detail.effective.source.sourceAuthority} — {detail.effective.source.sourceTitle}
        </p>
        <p className="mt-1" dir="ltr">
          {detail.effective.source.effectiveFrom}
          {detail.effective.source.effectiveTo ? ` → ${detail.effective.source.effectiveTo}` : " → کنون"}
          {detail.effective.source.sourceUrl ? ` · ${detail.effective.source.sourceUrl}` : ""}
        </p>
        <p className="mt-1">
          استفاده‌شونده در: {detail.usedBy.map((u) => u.titleFa).join("، ") || "—"}
        </p>
      </div>

      <div className="space-y-3">
        {detail.schema.map((field) => (
          <RuleFieldEditor
            key={field.key}
            field={field}
            value={values[field.key]}
            onChange={(next) => onFieldChange(field.key, next)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
        <Field label="تاریخ اعمال (میلادی)" hint="نسخه از این تاریخ به بعد اعمال می‌شود.">
          <TextInput dir="ltr" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="YYYY-MM-DD" />
        </Field>
        <Field label="وضعیت بازبینی منبع">
          <Select value={verif} onChange={(e) => setVerif(e.target.value as "verified" | "pending")}>
            <option value="verified">تأییدشده</option>
            <option value="pending">نیازمند بازبینی</option>
          </Select>
        </Field>
      </div>

      <Field
        label="توضیح تغییر و مبنای حقوقی"
        required
        hint="برای انتشار الزامی است؛ در تاریخچه و سیاههٔ حسابرسی ثبت می‌شود."
      >
        <TextArea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="مثلاً: به‌روزرسانی تعرفهٔ ۱۴۰۵ طبق ابلاغیهٔ …"
        />
      </Field>

      <div className="flex flex-wrap justify-end gap-2">
        {openDraft && (
          <Button variant="ghost" onClick={doDiscard} loading={discard.isPending}>
            لغو پیش‌نویس
          </Button>
        )}
        <Button variant="tonal" onClick={runPreview} loading={preview.isPending}>
          آزمون با ورودی نمونه
        </Button>
        <Button variant="secondary" onClick={saveDraft} loading={save.isPending}>
          ذخیرهٔ پیش‌نویس
        </Button>
        <Button onClick={doPublish} loading={publish.isPending} disabled={!openDraft || !note.trim()}>
          انتشار
        </Button>
      </div>

      {previewResult && <RulePreviewPanel preview={previewResult} />}

      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-caption font-medium text-on-surface-variant">تاریخچهٔ نسخه‌ها</p>
          <div className="overflow-hidden rounded-large border border-divider">
            <DataTable
              head={
                <tr>
                  <Th>نسخه</Th>
                  <Th>وضعیت</Th>
                  <Th>اعمال از</Th>
                  <Th>توضیح</Th>
                  <Th className="text-end">عملیات</Th>
                </tr>
              }
            >
              {history.map((v) => (
                <tr key={v.id}>
                  <Td dir="ltr" className="text-caption">{v.version}</Td>
                  <Td>
                    <Badge tone={v.status === "published" ? "success" : "neutral"}>
                      {CALCULATOR_RULE_STATUS_FA[v.status]}
                    </Badge>
                  </Td>
                  <Td dir="ltr" className="text-caption text-muted">{v.effectiveFrom}</Td>
                  <Td className="max-w-[220px]">
                    <span className="block truncate text-caption text-muted" title={v.changeNoteFa}>
                      {v.changeNoteFa || "—"}
                    </span>
                  </Td>
                  <Td className="text-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => doRollback(v.id)}
                      loading={rollback.isPending}
                    >
                      بازگردانی
                    </Button>
                  </Td>
                </tr>
              ))}
            </DataTable>
          </div>
        </div>
      )}
    </div>
  );
}

function RulePreviewPanel({ preview }: { preview: RulePublishPreview }) {
  const errors = preview.validation.issues.filter((i) => i.severity === "error");
  const warnings = preview.validation.issues.filter((i) => i.severity === "warning");
  return (
    <div className="space-y-3 rounded-large border border-divider p-3">
      <div className="flex items-center gap-2">
        <p className="text-caption font-medium text-on-surface-variant">نتیجهٔ اعتبارسنجی و آزمون</p>
        {preview.validation.ok ? (
          <Badge tone="success">معتبر</Badge>
        ) : (
          <Badge tone="danger">نامعتبر</Badge>
        )}
        <Badge tone={preview.changedCount > 0 ? "warning" : "neutral"}>
          {toPersianNumber(preview.changedCount)} نتیجهٔ تغییر‌یافته
        </Badge>
      </div>

      {preview.validation.issues.length > 0 && (
        <ul className="space-y-1 text-caption">
          {[...errors, ...warnings].map((issue, i) => (
            <li
              key={i}
              className={issue.severity === "error" ? "text-error-600 dark:text-error-400" : "text-amber-700 dark:text-amber-300"}
            >
              <span dir="ltr">{issue.fieldPath || "—"}</span>: {issue.messageFa}
            </li>
          ))}
        </ul>
      )}

      {preview.samples.length > 0 && (
        <div className="overflow-hidden rounded-medium border border-divider">
          <DataTable
            head={
              <tr>
                <Th>ماشین‌حساب</Th>
                <Th>قبل</Th>
                <Th>بعد</Th>
                <Th>تغییر</Th>
              </tr>
            }
          >
            {preview.samples.map((s) => (
              <tr key={s.slug}>
                <Td className="max-w-[180px]">
                  <span className="block truncate" title={s.titleFa}>{s.titleFa}</span>
                </Td>
                <Td className="text-caption text-muted">{s.beforeHeadlineFa}</Td>
                <Td className="text-caption">{s.errorFa ? `خطا: ${s.errorFa}` : s.afterHeadlineFa}</Td>
                <Td>
                  {s.changed ? <Badge tone="warning">تغییر</Badge> : <Badge tone="neutral">بدون تغییر</Badge>}
                </Td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </div>
  );
}

// ---- Structural field renderers (one per RuleFieldKind) --------------------

function RuleFieldEditor({
  field,
  value,
  onChange,
}: {
  field: RuleField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  switch (field.kind) {
    case "number":
      return (
        <Field label={field.labelFa} hint={`کلید: ${field.key}`}>
          <TextInput
            type="number"
            dir="ltr"
            min={field.min}
            max={field.max}
            value={typeof value === "number" ? String(value) : ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange(Number.isFinite(n) ? n : 0);
            }}
          />
        </Field>
      );
    case "boolean":
      return (
        <div className="flex items-center justify-between gap-4 rounded-large border border-divider p-3">
          <div>
            <p className="font-medium text-on-surface">{field.labelFa}</p>
            <p className="mt-0.5 text-caption text-muted" dir="ltr">{field.key}</p>
          </div>
          <Switch checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} label={field.labelFa} />
        </div>
      );
    case "string":
      return (
        <Field label={field.labelFa} hint={`کلید: ${field.key}`}>
          <TextInput dir="ltr" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
    case "map":
      return <MapFieldEditor field={field} value={value} onChange={onChange} />;
    case "group":
      return <GroupFieldEditor field={field} value={value} onChange={onChange} />;
    case "brackets":
      return <BracketFieldEditor field={field} value={value} onChange={onChange} />;
    case "list":
      return <ListFieldEditor field={field} value={value} onChange={onChange} />;
    default:
      return null;
  }
}

function MapFieldEditor({
  field,
  value,
  onChange,
}: {
  field: RuleField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const record = (value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {}) as Record<string, unknown>;
  const valueKind = field.valueField?.kind ?? "number";
  return (
    <div className="rounded-large border border-divider p-3">
      <p className="mb-2 text-caption font-medium text-on-surface-variant">
        {field.labelFa} <span className="text-muted" dir="ltr">({field.key})</span>
      </p>
      <div className="grid grid-cols-1 gap-2 tablet:grid-cols-2">
        {Object.entries(record).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-32 shrink-0 truncate text-caption text-muted" dir="ltr" title={k}>
              {k}
            </span>
            {valueKind === "boolean" ? (
              <Switch checked={Boolean(v)} onChange={(e) => onChange({ ...record, [k]: e.target.checked })} label={k} />
            ) : (
              <TextInput
                dir="ltr"
                type={valueKind === "number" ? "number" : "text"}
                value={typeof v === "number" || typeof v === "string" ? String(v) : ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  onChange({ ...record, [k]: valueKind === "number" ? (Number.isFinite(Number(raw)) ? Number(raw) : 0) : raw });
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupFieldEditor({
  field,
  value,
  onChange,
}: {
  field: RuleField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const obj = (value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {}) as Record<string, unknown>;
  return (
    <div className="space-y-3 rounded-large border border-divider p-3">
      <p className="text-caption font-medium text-on-surface-variant">
        {field.labelFa} <span className="text-muted" dir="ltr">({field.key})</span>
      </p>
      {(field.children ?? []).map((child) => (
        <RuleFieldEditor
          key={child.key}
          field={child}
          value={obj[child.key]}
          onChange={(next) => onChange({ ...obj, [child.key]: next })}
        />
      ))}
    </div>
  );
}

function BracketFieldEditor({
  field,
  value,
  onChange,
}: {
  field: RuleField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const setRow = (i: number, patch: Record<string, unknown>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => onChange([...rows, { upToRial: null, rate: 0 }]);
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="rounded-large border border-divider p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-caption font-medium text-on-surface-variant">
          {field.labelFa} <span className="text-muted" dir="ltr">({field.key})</span>
        </p>
        <Button variant="ghost" size="sm" onClick={addRow}>
          افزودن پله
        </Button>
      </div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-end gap-2">
            <Field label="سقف (ریال)" hint="خالی = سقف باز">
              <TextInput
                dir="ltr"
                inputMode="numeric"
                value={row["upToRial"] === null || row["upToRial"] === undefined ? "" : String(row["upToRial"])}
                placeholder="باز (null)"
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  setRow(i, { upToRial: raw === "" ? null : Number.isFinite(Number(raw)) ? Number(raw) : 0 });
                }}
              />
            </Field>
            <Field label="نرخ">
              <TextInput
                dir="ltr"
                type="number"
                step="0.0001"
                min={0}
                max={1}
                value={typeof row["rate"] === "number" ? String(row["rate"]) : ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setRow(i, { rate: Number.isFinite(n) ? n : 0 });
                }}
              />
            </Field>
            <Button variant="ghost" size="sm" onClick={() => removeRow(i)} aria-label="حذف پله">
              حذف
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListFieldEditor({
  field,
  value,
  onChange,
}: {
  field: RuleField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const itemFields = field.itemFields ?? [];
  const setRowField = (i: number, key: string, next: unknown) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: next } : r)));

  return (
    <div className="space-y-3 rounded-large border border-divider p-3">
      <p className="text-caption font-medium text-on-surface-variant">
        {field.labelFa} <span className="text-muted" dir="ltr">({field.key})</span> — {toPersianNumber(rows.length)} عضو
      </p>
      {rows.map((row, i) => (
        <div key={i} className="space-y-2 rounded-medium border border-divider p-2">
          <p className="text-caption text-muted">عضو {toPersianNumber(i + 1)}</p>
          {itemFields.map((item) => (
            <RuleFieldEditor
              key={item.key}
              field={item}
              value={row[item.key]}
              onChange={(next) => setRowField(i, item.key, next)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
