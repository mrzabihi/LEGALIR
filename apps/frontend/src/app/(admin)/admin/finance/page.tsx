// ============================================================
// LEGALIR — Admin · Finance & Lawyer Settlement (مالی و تسویه وکلا)
// ============================================================
// Two owned concerns:
//   • Commission rules — versioned and append-only. Editing a rule APPENDS a
//     new version so any past settlement stays traceable to the rule that was
//     in force; history is never mutated.
//   • Lawyer settlements — the payout ledger. APPROVED requires a SECOND,
//     different approver (server-enforced). Payout destinations are stored
//     MASKED; the full IBAN/card is never sent to or shown by the panel.
//
// Honesty: a new settlement starts with ZERO lines. Lines are only added
// from a real, verified source — never fabricated to make a total look real.
// ============================================================

"use client";

import { useState } from "react";
import {
  useCommissionRules,
  useUpdateCommissionRule,
  useAdminSettlements,
  useAdminSettlement,
  useCreateAdminSettlement,
  useAddSettlementLine,
  useTransitionSettlement,
  useAdminMe,
} from "@/hooks/useAdmin";
import { toPersianNumber, toPersianDate, toPersianCurrency } from "@/lib/persian-utils";
import { SETTLEMENT_STATUS_FA, SETTLEMENT_TRANSITIONS } from "@legalir/types";
import type { SettlementStatus, CommissionRule, LawyerSettlement } from "@legalir/types";
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
  Select,
  Field,
  InfoBanner,
  FilterPills,
  IdChip,
  Section,
} from "@/components/admin/ui";

const STATUS_TONES: Record<
  SettlementStatus,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  OPEN: "neutral",
  INVOICED: "info",
  REQUESTED: "info",
  UNDER_REVIEW: "warning",
  APPROVED: "brand",
  PAID: "success",
  FAILED: "danger",
  NEEDS_REVIEW: "warning",
};

const DEDUCTION_FA: Record<string, string> = {
  gateway_fee: "کارمزد درگاه",
  refund: "بازگشت وجه",
  penalty: "جریمه",
};

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

function Feedback({ value }: { value: { tone: "error" | "success"; text: string } | null }) {
  if (!value) return null;
  return (
    <div
      className={`mb-4 rounded-large border p-3 text-body-2 ${
        value.tone === "error"
          ? "border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
      }`}
    >
      {value.text}
    </div>
  );
}

function CommissionRules({ canManage }: { canManage: boolean }) {
  const rules = useCommissionRules();
  const update = useUpdateCommissionRule();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ platformPercent: number; platformFixedToman: number }>({
    platformPercent: 0,
    platformFixedToman: 0,
  });
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(
    null
  );

  async function onSave(rule: CommissionRule) {
    setFeedback(null);
    try {
      await update.mutateAsync({
        serviceType: rule.serviceType,
        platformPercent: draft.platformPercent,
        platformFixedToman: draft.platformFixedToman,
        allowedDeductions: rule.allowedDeductions,
      });
      setEditing(null);
      setFeedback({
        tone: "success",
        text: "قاعده کمیسیون نسخه جدید ثبت کرد؛ تاریخچه دست‌نخورده است.",
      });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "به‌روزرسانی ناموفق بود") });
    }
  }

  return (
    <Section
      title="قواعد کمیسیون"
      subtitle="هر ویرایش یک نسخه جدید می‌سازد؛ نسخه‌های قبلی برای ردیابی باقی می‌مانند."
    >
      <Feedback value={feedback} />
      <StateView
        query={rules}
        loadingRows={2}
        isEmpty={(d) => d.rules.length === 0}
        emptyMessage="قاعده کمیسیونی ثبت نشده است."
      >
        {(data) => (
          <DataTable
            head={
              <tr>
                <Th>خدمت</Th>
                <Th>درصد پلتفرم</Th>
                <Th>کارمزد ثابت</Th>
                <Th>کسرهای مجاز</Th>
                <Th>نسخه</Th>
                {canManage && <Th>ویرایش</Th>}
              </tr>
            }
          >
            {data.rules.map((r) => (
              <tr key={r.id}>
                <Td dir="ltr">{r.serviceType}</Td>
                <Td>
                  {editing === r.id ? (
                    <TextInput
                      type="number"
                      value={draft.platformPercent}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, platformPercent: Number(e.target.value) }))
                      }
                      className="w-24"
                    />
                  ) : (
                    <span className="tabular-nums">{toPersianNumber(r.platformPercent)}٪</span>
                  )}
                </Td>
                <Td>
                  {editing === r.id ? (
                    <TextInput
                      type="number"
                      value={draft.platformFixedToman}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, platformFixedToman: Number(e.target.value) }))
                      }
                      className="w-32"
                    />
                  ) : (
                    <span className="tabular-nums">{toPersianCurrency(r.platformFixedToman)}</span>
                  )}
                </Td>
                <Td>
                  <span className="text-caption text-muted">
                    {r.allowedDeductions.map((d) => DEDUCTION_FA[d] ?? d).join("، ") || "—"}
                  </span>
                </Td>
                <Td className="tabular-nums">{toPersianNumber(r.version)}</Td>
                {canManage && (
                  <Td>
                    {editing === r.id ? (
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="primary" onClick={() => onSave(r)}>
                          ذخیره نسخه جدید
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          انصراف
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setDraft({
                            platformPercent: r.platformPercent,
                            platformFixedToman: r.platformFixedToman,
                          });
                          setEditing(r.id);
                        }}
                      >
                        ویرایش
                      </Button>
                    )}
                  </Td>
                )}
              </tr>
            ))}
          </DataTable>
        )}
      </StateView>
    </Section>
  );
}

function SettlementDetail({ id, canManage }: { id: string; canManage: boolean }) {
  const detail = useAdminSettlement(id);
  const addLine = useAddSettlementLine();
  const transition = useTransitionSettlement();
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const [line, setLine] = useState({ sourceType: "consultation", sourceId: "", grossAmount: "" });
  const [toStatus, setToStatus] = useState<SettlementStatus>("UNDER_REVIEW");
  const [reason, setReason] = useState("");
  const [payoutDest, setPayoutDest] = useState("");
  const [payoutRef, setPayoutRef] = useState("");

  if (detail.isLoading)
    return <Card className="p-4 text-body-2 text-muted">در حال بارگذاری…</Card>;
  if (detail.isError || !detail.data)
    return <Card className="p-4 text-body-2 text-red-600">خطا در دریافت تسویه</Card>;

  const s = detail.data;
  const reachable = SETTLEMENT_TRANSITIONS[s.status];

  async function onAddLine() {
    setFeedback(null);
    const gross = Number(line.grossAmount);
    if (!line.sourceId.trim() || !Number.isFinite(gross) || gross <= 0) {
      setFeedback({ tone: "error", text: "شناسه منبع و مبلغ ناخالص معتبر لازم است." });
      return;
    }
    try {
      await addLine.mutateAsync({
        id,
        input: {
          sourceType: line.sourceType,
          sourceId: line.sourceId,
          grossAmount: gross,
          serviceType: line.sourceType,
        },
      });
      setLine({ sourceType: "consultation", sourceId: "", grossAmount: "" });
      setFeedback({ tone: "success", text: "ردیف تسویه افزوده شد." });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "افزودن ردیف ناموفق بود") });
    }
  }

  async function onTransition() {
    setFeedback(null);
    try {
      await transition.mutateAsync({
        id,
        input: {
          to: toStatus,
          reason: reason || undefined,
          payoutDestination: payoutDest || undefined,
          payoutReference: payoutRef || undefined,
        },
      });
      setPayoutDest("");
      setPayoutRef("");
      setReason("");
      setFeedback({ tone: "success", text: "وضعیت تسویه به‌روزرسانی شد." });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "تغییر وضعیت ناموفق بود") });
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-h3 font-bold text-onSurface">
            {s.lawyerName}
            <Badge tone={STATUS_TONES[s.status]}>{SETTLEMENT_STATUS_FA[s.status]}</Badge>
          </h3>
          <p className="mt-1 text-caption text-muted">
            بازه: {toPersianDate(s.periodStart)} تا {toPersianDate(s.periodEnd)}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 tablet:grid-cols-4">
        <div className="rounded-medium border border-divider p-3">
          <p className="text-caption text-muted">مبلغ ناخالص</p>
          <p className="tabular-nums">{toPersianCurrency(s.grossAmount)}</p>
        </div>
        <div className="rounded-medium border border-divider p-3">
          <p className="text-caption text-muted">کارمزد پلتفرم</p>
          <p className="tabular-nums">{toPersianCurrency(s.platformFee)}</p>
        </div>
        <div className="rounded-medium border border-divider p-3">
          <p className="text-caption text-muted">کسرها</p>
          <p className="tabular-nums">{toPersianCurrency(s.deductions)}</p>
        </div>
        <div className="rounded-medium border border-divider p-3">
          <p className="text-caption text-muted">خالص قابل پرداخت</p>
          <p className="tabular-nums font-semibold">{toPersianCurrency(s.netAmount)}</p>
        </div>
      </div>

      <p className="mb-4 text-caption text-muted">
        مقصد پرداخت (پوشیده): {s.payoutDestinationMasked ?? "ثبت نشده"} · مرجع:{" "}
        {s.payoutReference ?? "—"}
        {s.paidAt ? ` · پرداخت: ${toPersianDate(s.paidAt)}` : ""}
      </p>

      <Feedback value={feedback} />

      <Section title="ردیف‌های تسویه" subtitle="هر ردیف از یک منبع واقعی و تأییدشده می‌آید.">
        {s.lines.length === 0 ? (
          <p className="text-body-2 text-muted">
            ردیفی ثبت نشده است. تسویه‌های جدید بدون ردیف ساخته می‌شوند تا مبلغ ساختگی ایجاد نشود.
          </p>
        ) : (
          <DataTable
            head={
              <tr>
                <Th>منبع</Th>
                <Th>شناسه</Th>
                <Th>ناخالص</Th>
                <Th>کارمزد</Th>
                <Th>خالص</Th>
              </tr>
            }
          >
            {s.lines.map((l) => (
              <tr key={l.id}>
                <Td dir="ltr">{l.sourceType}</Td>
                <Td>
                  <IdChip id={l.sourceId} />
                </Td>
                <Td className="tabular-nums">{toPersianCurrency(l.grossAmount)}</Td>
                <Td className="tabular-nums">{toPersianCurrency(l.platformFee)}</Td>
                <Td className="tabular-nums">{toPersianCurrency(l.netAmount)}</Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Section>

      {canManage && (
        <div className="mt-4 grid grid-cols-1 gap-4 tablet:grid-cols-2">
          <div className="rounded-medium border border-divider p-3">
            <h4 className="mb-2 text-body-2 font-semibold text-onSurface">افزودن ردیف</h4>
            <div className="grid grid-cols-2 gap-2">
              <Field label="نوع منبع">
                <Select
                  value={line.sourceType}
                  onChange={(e) => setLine((l) => ({ ...l, sourceType: e.target.value }))}
                >
                  <option value="consultation">مشاوره</option>
                  <option value="service">خدمت</option>
                </Select>
              </Field>
              <Field label="شناسه منبع">
                <TextInput
                  value={line.sourceId}
                  onChange={(e) => setLine((l) => ({ ...l, sourceId: e.target.value }))}
                />
              </Field>
              <Field label="مبلغ ناخالص (تومان)">
                <TextInput
                  type="number"
                  value={line.grossAmount}
                  onChange={(e) => setLine((l) => ({ ...l, grossAmount: e.target.value }))}
                />
              </Field>
              <div className="flex items-end">
                <Button variant="secondary" onClick={onAddLine} disabled={addLine.isPending}>
                  افزودن ردیف
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-medium border border-divider p-3">
            <h4 className="mb-2 text-body-2 font-semibold text-onSurface">تغییر وضعیت</h4>
            {reachable.length === 0 ? (
              <p className="text-body-2 text-muted">این تسویه در وضعیت نهایی است.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Field label="وضعیت هدف">
                  <Select
                    value={toStatus}
                    onChange={(e) => setToStatus(e.target.value as SettlementStatus)}
                  >
                    {reachable.map((st) => (
                      <option key={st} value={st}>
                        {SETTLEMENT_STATUS_FA[st]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="دلیل (اختیاری)">
                  <TextInput value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
                {toStatus === "PAID" && (
                  <>
                    <Field label="مقصد پرداخت (پوشیده می‌شود)">
                      <TextInput
                        value={payoutDest}
                        onChange={(e) => setPayoutDest(e.target.value)}
                        placeholder="شماره شبا/کارت"
                      />
                    </Field>
                    <Field label="مرجع پرداخت">
                      <TextInput value={payoutRef} onChange={(e) => setPayoutRef(e.target.value)} />
                    </Field>
                  </>
                )}
                <div className="col-span-2 flex items-end">
                  <Button variant="primary" onClick={onTransition} disabled={transition.isPending}>
                    اعمال تغییر وضعیت
                  </Button>
                </div>
              </div>
            )}
            <p className="mt-2 text-caption text-muted">
              مرحله «تأیید شده» نیازمند تأییدکننده دوم متفاوت است؛ سرور تأیید خودکار توسط همان کاربر
              را رد می‌کند.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

function SettlementCreator({ onCreated }: { onCreated: (id: string) => void }) {
  const create = useCreateAdminSettlement();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    lawyerId: "",
    lawyerName: "",
    periodStart: "",
    periodEnd: "",
  });
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function onCreate() {
    setFeedback(null);
    try {
      const created = (await create.mutateAsync(form)) as LawyerSettlement;
      setFeedback({ tone: "success", text: "تسویه جدید ایجاد شد (بدون ردیف)." });
      setForm({ lawyerId: "", lawyerName: "", periodStart: "", periodEnd: "" });
      onCreated(created.id);
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "ایجاد تسویه ناموفق بود") });
    }
  }

  return (
    <div className="mb-4">
      <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
        {open ? "بستن فرم" : "ایجاد تسویه جدید"}
      </Button>
      {open && (
        <Card className="mt-3 p-4">
          <Feedback value={feedback} />
          <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
            <Field label="شناسه وکیل">
              <TextInput
                value={form.lawyerId}
                onChange={(e) => setForm((f) => ({ ...f, lawyerId: e.target.value }))}
              />
            </Field>
            <Field label="نام وکیل">
              <TextInput
                value={form.lawyerName}
                onChange={(e) => setForm((f) => ({ ...f, lawyerName: e.target.value }))}
              />
            </Field>
            <Field label="شروع دوره">
              <TextInput
                type="date"
                value={form.periodStart}
                onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
              />
            </Field>
            <Field label="پایان دوره">
              <TextInput
                type="date"
                value={form.periodEnd}
                onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Button variant="primary" onClick={onCreate} disabled={create.isPending}>
              ایجاد
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function AdminFinancePage() {
  const { can } = useAdminMe();
  const canManage = can("admin:settlement:manage");
  const [status, setStatus] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);

  const settlements = useAdminSettlements(status ? { status: status as SettlementStatus } : {});

  const filters = [
    { value: "", label: "همه" },
    ...Object.entries(SETTLEMENT_STATUS_FA).map(([value, label]) => ({ value, label })),
  ];

  return (
    <div>
      <PageHeader
        title="مالی و تسویه وکلا"
        description="قواعد کمیسیون و دفتر تسویه‌حساب وکلای پلتفرم. تأیید نهایی تسویه نیازمند تأییدکننده دوم است."
      />

      <InfoBanner tone="info">
        پرداخت به وکلا در این محیط واقعی نیست؛ مبالغ فقط از منابع تأییدشده مشتق می‌شوند و هیچ مبلغ
        ساختگی ساخته نمی‌شود.
      </InfoBanner>

      <CommissionRules canManage={can("admin:finance:manage")} />

      <Section title="تسویه‌حساب وکلا" subtitle="دفتر پرداخت با گردش وضعیت کنترل‌شده.">
        {canManage && <SettlementCreator onCreated={setSelected} />}

        <div className="mb-3">
          <FilterPills options={filters} value={status} onChange={setStatus} />
        </div>

        <StateView
          query={settlements}
          loadingRows={4}
          isEmpty={(d) => d.items.length === 0}
          emptyMessage="تسویه‌ای با این فیلتر یافت نشد."
          emptyHint="برای شروع، یک تسویه جدید برای وکیل و دوره مشخص ایجاد کنید."
        >
          {(data) => (
            <DataTable
              head={
                <tr>
                  <Th>وکیل</Th>
                  <Th>بازه</Th>
                  <Th>ناخالص</Th>
                  <Th>خالص</Th>
                  <Th>وضعیت</Th>
                  <Th>جزئیات</Th>
                </tr>
              }
            >
              {data.items.map((s) => (
                <tr key={s.id}>
                  <Td>{s.lawyerName}</Td>
                  <Td className="whitespace-nowrap text-caption text-muted">
                    {toPersianDate(s.periodStart)} — {toPersianDate(s.periodEnd)}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {toPersianCurrency(s.grossAmount)}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums font-medium">
                    {toPersianCurrency(s.netAmount)}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONES[s.status]}>{SETTLEMENT_STATUS_FA[s.status]}</Badge>
                  </Td>
                  <Td>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelected(selected === s.id ? null : s.id)}
                    >
                      {selected === s.id ? "بستن" : "مشاهده"}
                    </Button>
                  </Td>
                </tr>
              ))}
            </DataTable>
          )}
        </StateView>
      </Section>

      {selected && (
        <div className="mt-2">
          <SettlementDetail id={selected} canManage={canManage} />
        </div>
      )}
    </div>
  );
}
