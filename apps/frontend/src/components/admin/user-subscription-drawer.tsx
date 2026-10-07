// ============================================================
// LEGALIR — Admin · User subscription & energy drawer
// ============================================================
// The billing dossier for one user: current plan, energy summary, subscription
// history, payments and the unified energy ledger — plus the audited actions an
// operator may take (activate / change plan / extend / deactivate, and energy
// grant / adjust). Nothing here is fabricated: every field comes from
// `GET /admin/users/:id/subscription`; every action posts to the audited,
// permission-gated admin endpoints.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { Drawer, snackbar } from "@legalir/ui";
import {
  useAdminUserSubscription,
  useAdminSubscriptionAction,
  useAdminEnergyAction,
  useAdminPlans,
} from "@/hooks/useAdmin";
import {
  Badge,
  Button,
  Field,
  InfoBanner,
  LoadingBlock,
  ErrorBlock,
  Select,
  TextInput,
  DataTable,
  Th,
  Td,
} from "@/components/admin/ui";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import type {
  AdminSubscriptionAction,
  EnergyTransactionType,
  PlanCode,
} from "@legalir/types";

// ---------------------------------------------------------------------------
// Presentation maps
// ---------------------------------------------------------------------------

const ENERGY_TYPE_FA: Record<EnergyTransactionType, string> = {
  SUBSCRIPTION_GRANT: "اعتبار اشتراک",
  DAILY_REWARD: "پاداش روزانه",
  REFERRAL_REWARD: "پاداش معرفی",
  CAMPAIGN_REWARD: "پاداش کمپین",
  ADMIN_GRANT: "اعطای مدیر",
  PURCHASE: "خرید",
  USAGE: "مصرف",
  REFUND: "بازگشت",
  EXPIRATION: "انقضا",
  ADJUSTMENT: "تعدیل",
};

const SUB_STATUS_FA: Record<string, string> = {
  active: "فعال",
  pending: "در انتظار پرداخت",
  expired: "منقضی شده",
  cancelled: "لغو شده",
  superseded: "جایگزین شده",
  free: "رایگان",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-large border border-divider bg-surface px-3 py-2">
      <div className="text-caption text-muted">{label}</div>
      <div className="text-body-1 font-semibold text-on-surface tabular-nums">{value}</div>
    </div>
  );
}

export function UserSubscriptionDrawer({
  userId,
  open,
  onClose,
}: {
  userId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const query = useAdminUserSubscription(open ? userId : null);
  const plans = useAdminPlans();
  const subAction = useAdminSubscriptionAction(userId ?? "");
  const energyAction = useAdminEnergyAction(userId ?? "");

  const [action, setAction] = useState<AdminSubscriptionAction>("activate");
  const [planCode, setPlanCode] = useState<PlanCode>("gold");
  const [days, setDays] = useState("31");
  const [subReason, setSubReason] = useState("");

  const [energyAmount, setEnergyAmount] = useState("1000");
  const [energyReason, setEnergyReason] = useState("");

  // Reset the transient form state whenever a new user is opened.
  useEffect(() => {
    setAction("activate");
    setPlanCode("gold");
    setDays("31");
    setSubReason("");
    setEnergyAmount("1000");
    setEnergyReason("");
  }, [userId, open]);

  async function runSubAction() {
    try {
      await subAction.mutateAsync({
        action,
        planCode: action === "activate" || action === "change_plan" ? planCode : undefined,
        days: action === "extend" ? Number(days) : undefined,
        reason: subReason,
      });
      snackbar.show({ message: "عملیات اشتراک با موفقیت ثبت شد.", variant: "success" });
      setSubReason("");
    } catch (err) {
      snackbar.show({ message: "ثبت عملیات اشتراک ناموفق بود.", variant: "error" });
      void err;
    }
  }

  async function runEnergyAction(kind: "grant" | "adjust") {
    const n = Number(energyAmount);
    if (!Number.isFinite(n) || n === 0) {
      snackbar.show({ message: "مبلغ انرژی نامعتبر است.", variant: "warning" });
      return;
    }
    try {
      await energyAction.mutateAsync({
        action: kind,
        amount: kind === "adjust" ? -Math.abs(n) : Math.abs(n),
        reason: energyReason,
      });
      snackbar.show({ message: "انرژی با موفقیت به‌روزرسانی شد.", variant: "success" });
      setEnergyReason("");
    } catch (err) {
      snackbar.show({ message: "به‌روزرسانی انرژی ناموفق بود.", variant: "error" });
      void err;
    }
  }

  const data = query.data;

  return (
    <Drawer open={open} onClose={onClose} width={560} title="اشتراک و انرژی کاربر">
      {query.isLoading && <LoadingBlock rows={6} />}
      {query.isError && <ErrorBlock onRetry={() => query.refetch()} />}
      {data && (
        <div className="flex flex-col gap-4">
          {/* Identity + current plan */}
          <div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-on-surface">{data.displayName ?? "بدون نام"}</span>
              <span className="text-caption text-muted tabular-nums">{data.mobileMasked}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge tone={data.current.isFree ? "neutral" : "brand"}>
                {data.current.planNameFa ?? "بدون اشتراک"}
              </Badge>
              <Badge tone={data.current.status === "active" ? "success" : "neutral"}>
                {SUB_STATUS_FA[data.current.status] ?? data.current.status}
              </Badge>
              {data.current.daysRemaining !== null && !data.current.isFree && (
                <span className="text-caption text-muted">
                  {toPersianNumber(data.current.daysRemaining)} روز باقی‌مانده
                </span>
              )}
            </div>
            {data.current.endAt && (
              <div className="mt-1 text-caption text-muted">
                پایان: {toPersianDate(data.current.endAt)}
              </div>
            )}
          </div>

          {/* Energy summary */}
          <div className="grid grid-cols-2 gap-2">
            <Stat label="امتیاز پاداش (ماندگار)" value={toPersianNumber(data.energy.rewardBalance)} />
            <Stat label="اعتبار اشتراک امروز" value={toPersianNumber(data.energy.subscriptionRemaining)} />
            <Stat label="مجموع کسب‌شده" value={toPersianNumber(data.energy.lifetimeEarned)} />
            <Stat label="مجموع مصرف‌شده" value={toPersianNumber(data.energy.lifetimeSpent)} />
          </div>

          {/* Subscription actions */}
          <div className="rounded-large border border-divider p-3">
            <div className="mb-2 font-medium text-on-surface">عملیات اشتراک</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="عملیات">
                <Select value={action} onChange={(e) => setAction(e.target.value as AdminSubscriptionAction)}>
                  <option value="activate">فعال‌سازی پلن</option>
                  <option value="change_plan">تغییر پلن</option>
                  <option value="extend">تمدید</option>
                  <option value="deactivate">لغو اشتراک</option>
                </Select>
              </Field>
              {(action === "activate" || action === "change_plan") && (
                <Field label="پلن">
                  <Select value={planCode} onChange={(e) => setPlanCode(e.target.value as PlanCode)}>
                    {(plans.data?.items ?? []).map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.nameFa}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {action === "extend" && (
                <Field label="تعداد روز">
                  <TextInput
                    type="number"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    min={1}
                  />
                </Field>
              )}
            </div>
            <Field label="دلیل (الزامی)">
              <TextInput value={subReason} onChange={(e) => setSubReason(e.target.value)} placeholder="دلیل این عملیات" />
            </Field>
            <div className="mt-2">
              <Button
                variant="primary"
                size="sm"
                loading={subAction.isPending}
                disabled={!subReason.trim()}
                onClick={runSubAction}
              >
                اجرا
              </Button>
            </div>
          </div>

          {/* Energy actions */}
          <div className="rounded-large border border-divider p-3">
            <div className="mb-2 font-medium text-on-surface">انرژی (امتیاز پاداش)</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="مقدار">
                <TextInput
                  type="number"
                  value={energyAmount}
                  onChange={(e) => setEnergyAmount(e.target.value)}
                />
              </Field>
              <Field label="دلیل (الزامی)">
                <TextInput value={energyReason} onChange={(e) => setEnergyReason(e.target.value)} placeholder="دلیل اعطا/تعدیل" />
              </Field>
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={energyAction.isPending}
                disabled={!energyReason.trim()}
                onClick={() => runEnergyAction("grant")}
              >
                اعطا
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={energyAction.isPending}
                disabled={!energyReason.trim()}
                onClick={() => runEnergyAction("adjust")}
              >
                کاهش
              </Button>
            </div>
            <InfoBanner tone="info">
              انرژی اعطاشده به امتیاز پاداش (ماندگار) افزوده می‌شود و در دفتر کل ثبت و حسابرسی می‌گردد.
            </InfoBanner>
          </div>

          {/* History */}
          <div>
            <div className="mb-2 font-medium text-on-surface">تاریخچهٔ اشتراک</div>
            {data.history.length === 0 ? (
              <div className="text-caption text-muted">تاریخچه‌ای ثبت نشده است.</div>
            ) : (
              <DataTable
                head={
                  <tr>
                    <Th>پلن</Th>
                    <Th>وضعیت</Th>
                    <Th>شروع</Th>
                    <Th>پایان</Th>
                  </tr>
                }
              >
                {data.history.map((h) => (
                  <tr key={h.id}>
                    <Td>{h.planNameFa}</Td>
                    <Td>{h.statusFa || SUB_STATUS_FA[h.status] || h.status}</Td>
                    <Td className="whitespace-nowrap">{toPersianDate(h.startAt)}</Td>
                    <Td className="whitespace-nowrap">{toPersianDate(h.endAt)}</Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>

          {/* Ledger */}
          <div>
            <div className="mb-2 font-medium text-on-surface">دفتر کل انرژی</div>
            {data.ledger.length === 0 ? (
              <div className="text-caption text-muted">تراکنش انرژی‌ای ثبت نشده است.</div>
            ) : (
              <DataTable
                head={
                  <tr>
                    <Th>نوع</Th>
                    <Th>منبع</Th>
                    <Th>مقدار</Th>
                    <Th>مانده</Th>
                    <Th>تاریخ</Th>
                  </tr>
                }
              >
                {data.ledger.map((e) => (
                  <tr key={e.id}>
                    <Td>{ENERGY_TYPE_FA[e.type] ?? e.type}</Td>
                    <Td>
                      <Badge tone={e.source === "REWARD" ? "brand" : "info"}>
                        {e.source === "REWARD" ? "پاداش" : "اشتراک"}
                      </Badge>
                    </Td>
                    <Td className={`tabular-nums ${e.amount < 0 ? "text-error" : "text-success"}`}>
                      {e.amount > 0 ? "+" : ""}
                      {toPersianNumber(e.amount)}
                    </Td>
                    <Td className="tabular-nums">{toPersianNumber(e.balanceAfter)}</Td>
                    <Td className="whitespace-nowrap">{toPersianDate(e.createdAt)}</Td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
