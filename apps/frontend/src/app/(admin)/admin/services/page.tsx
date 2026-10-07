// ============================================================
// LEGALIR — Admin · Services & Feature Flags (خدمات و پرچم‌های ویژگی)
// ============================================================
// The release-control surface. Each feature flag names a platform
// capability and its rollout state (on / off / experiment / limited). A
// "limited" flag also carries a rollout percentage and an allow-list of
// plans/orgs. Every change is permission-gated server-side and audited, and
// the mutation is optimistic so the toggle never lags behind the click.
//
// The plan catalog is shown below as a read-only reference so an operator
// can see what "allowedPlans" refer to without leaving the page.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { useAdminFlags, useUpdateAdminFlag, useAdminMe } from "@/hooks/useAdmin";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminPlans } from "@/lib/api/admin";
import { FEATURE_FLAG_STATUS_FA } from "@legalir/types";
import type { FeatureFlagStatus } from "@legalir/types";
import {
  PageHeader,
  Card,
  DataTable,
  Th,
  Td,
  Badge,
  StateView,
  Button,
  Select,
  TextInput,
  InfoBanner,
  Section,
  ExportButton,
} from "@/components/admin/ui";

const FLAG_STATUS_FA = FEATURE_FLAG_STATUS_FA;

const FLAG_STATUS_TONES: Record<
  FeatureFlagStatus,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  on: "success",
  off: "neutral",
  experiment: "info",
  limited: "warning",
};

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

export default function AdminServicesPage() {
  const { can } = useAdminMe();
  const canManage = can("admin:flags:manage");

  const flags = useAdminFlags();
  const updateFlag = useUpdateAdminFlag();
  const plans = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: fetchAdminPlans,
    staleTime: 5 * 60_000,
  });

  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(
    null
  );
  const [drafts, setDrafts] = useState<Record<string, number>>({});

  const planOptions = useMemo(() => {
    const items = (plans.data?.items ?? []) as { code: string; nameFa: string }[];
    return items.map((p) => ({ code: p.code, nameFa: p.nameFa }));
  }, [plans.data]);

  async function onStatus(key: string, status: FeatureFlagStatus) {
    setFeedback(null);
    try {
      await updateFlag.mutateAsync({ key, input: { status } });
      setFeedback({ tone: "success", text: "وضعیت پرچم ویژگی به‌روزرسانی شد." });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "به‌روزرسانی ناموفق بود") });
    }
  }

  async function onRollout(key: string) {
    const pct = drafts[key];
    if (pct === undefined) return;
    setFeedback(null);
    try {
      await updateFlag.mutateAsync({ key, input: { rolloutPercent: pct } });
      setFeedback({ tone: "success", text: "درصد انتشار به‌روزرسانی شد." });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "به‌روزرسانی ناموفق بود") });
    }
  }

  return (
    <div>
      <PageHeader
        title="خدمات و پرچم‌های ویژگی"
        description="کنترل انتشار قابلیت‌ها بر پایه پرچم ویژگی. تغییر وضعیت، درصد انتشار و فهرست مجاز به‌صورت سمت سرور مجوزسنجی و ثبت می‌شود."
        actions={<ExportButton kind="services" />}
      />

      {!canManage && (
        <InfoBanner tone="warning">
          شما مجوز مدیریت پرچم‌های ویژگی را ندارید؛ این فهرست فقط‌خواندنی است.
        </InfoBanner>
      )}

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

      <StateView
        query={flags}
        loadingRows={5}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="پرچم ویژگی‌ای ثبت نشده است."
      >
        {(data) => (
          <DataTable
            head={
              <tr>
                <Th>ویژگی</Th>
                <Th>وضعیت</Th>
                <Th>درصد انتشار</Th>
                <Th>محدوده</Th>
                {canManage && <Th>تغییر وضعیت</Th>}
              </tr>
            }
          >
            {data.items.map((f) => (
              <tr key={f.key}>
                <Td>
                  <div className="flex flex-col">
                    <span className="font-medium text-on-surface">{f.nameFa}</span>
                    <span className="text-caption text-muted" dir="ltr">
                      {f.key}
                    </span>
                    <span className="text-caption text-muted">{f.descriptionFa}</span>
                  </div>
                </Td>
                <Td>
                  <Badge tone={FLAG_STATUS_TONES[f.status]}>{FLAG_STATUS_FA[f.status]}</Badge>
                </Td>
                <Td>
                  {f.status === "limited" ? (
                    <div className="flex items-center gap-1.5">
                      <TextInput
                        type="number"
                        min={0}
                        max={100}
                        value={drafts[f.key] ?? f.rolloutPercent}
                        disabled={!canManage}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [f.key]: Number(e.target.value) }))
                        }
                        className="w-20"
                      />
                      <span className="text-caption text-muted">٪</span>
                      {canManage && (
                        <Button size="sm" variant="ghost" onClick={() => onRollout(f.key)}>
                          ذخیره
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>
                <Td>
                  <div className="flex flex-col gap-1">
                    <span className="text-caption text-muted">{f.environment}</span>
                    {f.allowedPlans.length > 0 && (
                      <span className="text-caption text-muted" dir="ltr">
                        {f.allowedPlans.join(", ")}
                      </span>
                    )}
                  </div>
                </Td>
                {canManage && (
                  <Td>
                    <Select
                      value={f.status}
                      onChange={(e) => onStatus(f.key, e.target.value as FeatureFlagStatus)}
                      className="min-w-[120px]"
                    >
                      {(["on", "off", "experiment", "limited"] as FeatureFlagStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {FLAG_STATUS_FA[s]}
                        </option>
                      ))}
                    </Select>
                  </Td>
                )}
              </tr>
            ))}
          </DataTable>
        )}
      </StateView>

      <Section
        title="کاتالوگ پلن‌ها (مرجع)"
        subtitle="پلن‌هایی که می‌توانند در فهرست مجاز پرچم محدود استفاده شوند."
      >
        {plans.isLoading ? (
          <div className="text-caption text-muted">در حال بارگذاری…</div>
        ) : planOptions.length === 0 ? (
          <Card className="p-4 text-body-2 text-muted">پلنی ثبت نشده است.</Card>
        ) : (
          <div className="flex flex-wrap gap-2">
            {planOptions.map((p) => (
              <Badge key={p.code} tone="brand">
                {p.nameFa} <span dir="ltr">({p.code})</span>
              </Badge>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
