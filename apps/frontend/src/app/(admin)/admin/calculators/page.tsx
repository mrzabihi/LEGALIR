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

import { useMemo, useState } from "react";
import { Drawer, Switch, snackbar } from "@legalir/ui";
import { useCalculatorsInventory, useUpdateCalculatorSetting } from "@/hooks/useAdmin";
import { toPersianNumber } from "@/lib/persian-utils";
import { CALCULATOR_ACCESS_TIER_FA } from "@legalir/types";
import type { CalculatorAccessTier, CalculatorSetting } from "@legalir/types";
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
                </tr>
              ))}
            </DataTable>
          )}
        </StateView>
      </Section>

      <Card className="p-4 text-caption text-muted">
        یادآوری: نرخ‌های محاسبه از ماژول‌های نسخه‌دار کد می‌آیند و از این پنل ویرایش
        نمی‌شوند؛ برای به‌روزرسانی سالانه، مجموعه‌دادهٔ سال جدید را در کد اضافه و
        بازبینی کنید. اما سیاست عملیاتی هر ماشین‌حساب (فعال/غیرفعال، سطح دسترسی و
        هزینهٔ انرژی) از دکمهٔ «تنظیمات» مدیریت می‌شود و هنگام اجرا در سرور اعمال
        می‌گردد.
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
