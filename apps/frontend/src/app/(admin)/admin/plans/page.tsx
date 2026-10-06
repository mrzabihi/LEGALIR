// ============================================================
// LEGALIR — Admin · Plans, Subscription & Quota (پلن‌ها، اشتراک و سهمیه)
// ============================================================
// The plan catalog plus a per-plan editor. Editing a plan writes a
// field-level audit entry in the same pass and NEVER retroactively changes
// live subscriptions — each subscription carries a frozen `planSnapshot`
// taken at purchase time. Editing requires `admin:system:manage` (a
// super-admin capability); everyone with `admin:plans:read` sees the
// catalog read-only.
// ============================================================

"use client";

import { useState } from "react";
import { useAdminPlans, useAdminPlan, useUpdateAdminPlan, useAdminMe } from "@/hooks/useAdmin";
import { toPersianNumber, toPersianDate, toPersianCurrency } from "@/lib/persian-utils";
import type { SubscriptionPlan } from "@legalir/types";
import type { AdminPlanUpdate } from "@/lib/api/admin";
import {
  PageHeader,
  Card,
  DataTable,
  Th,
  Td,
  Badge,
  StateView,
  Button,
  TextInput,
  Field,
  InfoBanner,
  Section,
} from "@/components/admin/ui";

type NumericField =
  | "durationDays"
  | "dailyRequestLimit"
  | "tokenLimit"
  | "aiMessageLimit"
  | "documentAnalysisLimit"
  | "contractDraftLimit"
  | "contractCreationLimit"
  | "listPrice"
  | "salePrice"
  | "activityCostPoints";

const NUMERIC_FIELDS: { key: NumericField; labelFa: string; money?: boolean }[] = [
  { key: "durationDays", labelFa: "مدت (روز)" },
  { key: "dailyRequestLimit", labelFa: "سقف درخواست روزانه" },
  { key: "tokenLimit", labelFa: "سقف توکن" },
  { key: "aiMessageLimit", labelFa: "سقف پیام هوش مصنوعی" },
  { key: "documentAnalysisLimit", labelFa: "سقف تحلیل سند" },
  { key: "contractDraftLimit", labelFa: "سقف پیش‌نویس قرارداد" },
  { key: "contractCreationLimit", labelFa: "سقف ایجاد قرارداد" },
  { key: "listPrice", labelFa: "قیمت فهرست", money: true },
  { key: "salePrice", labelFa: "قیمت فروش", money: true },
  { key: "activityCostPoints", labelFa: "هزینه هر فعالیت (امتیاز)" },
];

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

function PlanEditor({ code, canEdit }: { code: string; canEdit: boolean }) {
  const detail = useAdminPlan(code);
  const update = useUpdateAdminPlan();
  const [draft, setDraft] = useState<Record<string, number | boolean | string>>({});
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  if (detail.isLoading)
    return <Card className="p-4 text-body-2 text-muted">در حال بارگذاری…</Card>;
  if (detail.isError || !detail.data)
    return <Card className="p-4 text-body-2 text-red-600">خطا در دریافت پلن</Card>;

  const plan = detail.data.plan;

  const valueOf = (f: NumericField): number =>
    typeof draft[f] === "number" ? (draft[f] as number) : (plan[f] as number);

  async function onSave() {
    setFeedback(null);
    const input: AdminPlanUpdate = {};
    if (typeof draft["nameFa"] === "string" && draft["nameFa"] !== plan.nameFa) {
      input.nameFa = draft["nameFa"] as string;
    }
    for (const f of NUMERIC_FIELDS) {
      if (typeof draft[f.key] === "number" && draft[f.key] !== plan[f.key]) {
        (input as Record<string, unknown>)[f.key] = draft[f.key];
      }
    }
    if (typeof draft["isActive"] === "boolean" && draft["isActive"] !== plan.isActive) {
      input.isActive = draft["isActive"] as boolean;
    }
    if (Object.keys(input).length === 0) {
      setFeedback({ tone: "error", text: "هیچ تغییری ثبت نشده است." });
      return;
    }
    try {
      await update.mutateAsync({ code, input });
      setDraft({});
      setFeedback({
        tone: "success",
        text: "پلن به‌روزرسانی شد. اشتراک‌های فعال قبلی دست‌نخورده می‌مانند (اسنپ‌شات زمان خرید).",
      });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "به‌روزرسانی ناموفق بود") });
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-h3 font-bold text-onSurface">{plan.nameFa}</h3>
          <p className="text-caption text-muted" dir="ltr">
            {plan.code} · {plan.currency}
          </p>
        </div>
        <Badge tone={plan.isActive ? "success" : "neutral"}>
          {plan.isActive ? "فعال" : "غیرفعال"}
        </Badge>
      </div>

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

      <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4">
        <Field label="نام (فارسی)">
          <TextInput
            value={typeof draft["nameFa"] === "string" ? (draft["nameFa"] as string) : plan.nameFa}
            disabled={!canEdit}
            onChange={(e) => setDraft((d) => ({ ...d, nameFa: e.target.value }))}
          />
        </Field>
        {NUMERIC_FIELDS.map((f) => (
          <Field key={f.key} label={f.labelFa}>
            <TextInput
              type="number"
              value={valueOf(f.key)}
              disabled={!canEdit}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: Number(e.target.value) }))}
            />
          </Field>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-body-2 text-on-surface-variant">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={
              typeof draft["isActive"] === "boolean" ? (draft["isActive"] as boolean) : plan.isActive
            }
            onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
          />
          پلن فعال
        </label>
        {canEdit && (
          <Button variant="primary" onClick={onSave} disabled={update.isPending}>
            ذخیره تغییرات
          </Button>
        )}
      </div>

      <Section title="تاریخچه تغییرات" subtitle="هر تغییر فیلد با مقدار قبلی و جدید ثبت می‌شود.">
        {detail.data.audit.length === 0 ? (
          <p className="text-body-2 text-muted">تغییری ثبت نشده است.</p>
        ) : (
          <DataTable
            head={
              <tr>
                <Th>فیلد</Th>
                <Th>قبل</Th>
                <Th>بعد</Th>
                <Th>تاریخ</Th>
              </tr>
            }
          >
            {detail.data.audit
              .slice()
              .reverse()
              .slice(0, 20)
              .map((a) => (
                <tr key={a.id}>
                  <Td dir="ltr">{a.field}</Td>
                  <Td dir="ltr" className="text-muted">
                    {a.oldValue ?? "—"}
                  </Td>
                  <Td dir="ltr">{a.newValue ?? "—"}</Td>
                  <Td className="whitespace-nowrap">{toPersianDate(a.createdAt)}</Td>
                </tr>
              ))}
          </DataTable>
        )}
      </Section>
    </Card>
  );
}

export default function AdminPlansPage() {
  const { can } = useAdminMe();
  const canEdit = can("admin:system:manage");
  const [selected, setSelected] = useState<string | null>(null);
  const plans = useAdminPlans();

  return (
    <div>
      <PageHeader
        title="پلن‌ها، اشتراک و سهمیه"
        description="کاتالوگ پلن‌ها و سهمیه‌ها. ویرایش پلن تاریخچه ثبت می‌کند و اشتراک‌های فعال را تغییر نمی‌دهد."
      />

      {!canEdit && (
        <InfoBanner tone="info">
          ویرایش پلن نیازمند مجوز مدیریت سامانه است؛ در این نمای فقط‌خواندنی می‌توانید اعداد و
          تاریخچه را ببینید.
        </InfoBanner>
      )}

      <StateView
        query={plans}
        loadingRows={4}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="پلنی ثبت نشده است."
      >
        {(data) => (
          <DataTable
            head={
              <tr>
                <Th>پلن</Th>
                <Th>سقف درخواست روزانه</Th>
                <Th>سقف توکن</Th>
                <Th>قیمت فروش</Th>
                <Th>وضعیت</Th>
                <Th>جزئیات</Th>
              </tr>
            }
          >
            {data.items.map((p) => (
              <tr key={p.code}>
                <Td>
                  <span className="font-medium text-on-surface">{p.nameFa}</span>
                  <span className="block text-caption text-muted" dir="ltr">
                    {p.code}
                  </span>
                </Td>
                <Td className="tabular-nums">{toPersianNumber(p.dailyRequestLimit)}</Td>
                <Td className="tabular-nums">{toPersianNumber(p.tokenLimit)}</Td>
                <Td className="whitespace-nowrap">{toPersianCurrency(p.salePrice)}</Td>
                <Td>
                  <Badge tone={p.isActive ? "success" : "neutral"}>
                    {p.isActive ? "فعال" : "غیرفعال"}
                  </Badge>
                </Td>
                <Td>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSelected(selected === p.code ? null : p.code)}
                  >
                    {selected === p.code ? "بستن" : "مشاهده"}
                  </Button>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </StateView>

      {selected && (
        <div className="mt-5">
          <PlanEditor code={selected} canEdit={canEdit} />
        </div>
      )}
    </div>
  );
}
