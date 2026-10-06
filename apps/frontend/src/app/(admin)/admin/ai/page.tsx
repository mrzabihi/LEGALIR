// ============================================================
// LEGALIR — Admin · AI & Models (هوش مصنوعی و مدل‌ها)
// ============================================================
// Provider configuration, prompt versions and usage metrics.
//
// SECRETS: the API key is write-only. The server returns only `hasKey` and a
// masked hint ("••••abcd"); the full key is never displayed, echoed or put in
// a URL. If secret storage is not configured the panel says so rather than
// pretending a key was saved.
//
// HONESTY: "test connection" performs a REAL request and reports the actual
// outcome (ok / failure with a sanitized message). A provider that cannot be
// reached is never shown as "connected".
// ============================================================

"use client";

import { useState } from "react";
import {
  useAiProviders,
  useSaveAiProvider,
  useTestAiProvider,
  useAiPrompts,
  useCreateAiPrompt,
  useActivateAiPrompt,
  useAiMetrics,
  useAdminMe,
} from "@/hooks/useAdmin";
import { toPersianNumber, toPersianDate, toRelativeTime } from "@/lib/persian-utils";
import { AI_PROVIDER_KIND_FA, AI_PROVIDER_STATUS_FA } from "@legalir/types";
import type { AiProviderKind, AiProviderConfig, AiPromptVersion } from "@legalir/types";
import type { SaveAiProviderInput } from "@/lib/api/admin";
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
  Section,
  StatCard,
} from "@/components/admin/ui";

const KIND_OPTIONS: AiProviderKind[] = ["openai", "anthropic", "azure", "openrouter", "custom"];

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

function ProviderForm({ canManage, secretReady }: { canManage: boolean; secretReady: boolean }) {
  const save = useSaveAiProvider();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SaveAiProviderInput>({
    nameFa: "",
    kind: "custom",
    baseUrl: "",
    model: "",
    embeddingModel: "",
    timeoutMs: 30000,
    maxOutputTokens: 2048,
    isDefault: false,
    apiKey: "",
  });
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function onSave() {
    setFeedback(null);
    if (!form.nameFa.trim()) {
      setFeedback({ tone: "error", text: "نام فارسی ارائه‌دهنده الزامی است." });
      return;
    }
    try {
      await save.mutateAsync({ ...form, apiKey: form.apiKey || undefined });
      setForm((f) => ({ ...f, apiKey: "" }));
      setFeedback({
        tone: "success",
        text: "ارائه‌دهنده ذخیره شد. کلید فقط ذخیره می‌شود و هرگز بازنمایش داده نمی‌شود.",
      });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "ذخیره ناموفق بود") });
    }
  }

  if (!canManage) return null;

  return (
    <div className="mb-4">
      <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
        {open ? "بستن فرم" : "افزودن / ویرایش ارائه‌دهنده"}
      </Button>
      {open && (
        <Card className="mt-3 p-4">
          <Feedback value={feedback} />
          {!secretReady && (
            <InfoBanner tone="warning">
              ذخیره‌سازی امن کلید پیکربندی نشده است؛ تا زمان پیکربندی، کلید API ذخیره نخواهد شد.
            </InfoBanner>
          )}
          <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3">
            <Field label="نام (فارسی)">
              <TextInput
                value={form.nameFa}
                onChange={(e) => setForm((f) => ({ ...f, nameFa: e.target.value }))}
              />
            </Field>
            <Field label="نوع">
              <Select
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as AiProviderKind }))}
              >
                {KIND_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {AI_PROVIDER_KIND_FA[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="آدرس پایه" hint="برای ارائه‌دهنده سازگار با OpenAI">
              <TextInput
                dir="ltr"
                value={form.baseUrl ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              />
            </Field>
            <Field label="مدل">
              <TextInput
                dir="ltr"
                value={form.model ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              />
            </Field>
            <Field label="مدل جاسازی (Embedding)">
              <TextInput
                dir="ltr"
                value={form.embeddingModel ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, embeddingModel: e.target.value }))}
              />
            </Field>
            <Field label="مهلت (میلی‌ثانیه)">
              <TextInput
                type="number"
                value={form.timeoutMs}
                onChange={(e) => setForm((f) => ({ ...f, timeoutMs: Number(e.target.value) }))}
              />
            </Field>
            <Field label="حداکثر توکن خروجی">
              <TextInput
                type="number"
                value={form.maxOutputTokens}
                onChange={(e) => setForm((f) => ({ ...f, maxOutputTokens: Number(e.target.value) }))}
              />
            </Field>
            <Field label="کلید API (فقط نوشتن)" hint="کلید ذخیره می‌شود و بازنمایش نمی‌شود.">
              <TextInput
                type="password"
                dir="ltr"
                autoComplete="off"
                value={form.apiKey ?? ""}
                disabled={!secretReady}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              />
            </Field>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-body-2 text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={Boolean(form.isDefault)}
                  onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                />
                ارائه‌دهنده پیش‌فرض
              </label>
            </div>
          </div>
          <div className="mt-3">
            <Button variant="primary" onClick={onSave} disabled={save.isPending || !secretReady}>
              ذخیره
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function ProvidersTable({ canManage }: { canManage: boolean }) {
  const providers = useAiProviders();
  const test = useTestAiProvider();
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  async function onTest(id: string) {
    setFeedback(null);
    setTestingId(id);
    try {
      const res = await test.mutateAsync(id);
      setFeedback({
        tone: res.ok ? "success" : "error",
        text: res.ok
          ? `اتصال برقرار شد${res.latencyMs !== null ? ` (${toPersianNumber(res.latencyMs)}ms)` : ""}.`
          : `اتصال ناموفق: ${res.messageFa}`,
      });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "آزمون اتصال ناموفق بود") });
    } finally {
      setTestingId(null);
    }
  }

  return (
    <>
      <Feedback value={feedback} />
      <StateView
        query={providers}
        loadingRows={3}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="ارائه‌دهنده‌ای پیکربندی نشده است."
        emptyHint="یکی از ارائه‌دهنده‌های سازگار (OpenAI/Anthropic/…) را اضافه کنید."
      >
        {(data) => (
          <>
            {!data.secretStorageConfigured && (
              <InfoBanner tone="warning">
                ذخیره‌سازی امن کلید پیکربندی نشده است؛ ارائه‌دهنده‌ها بدون کلید ذخیره می‌شوند و
                اتصال برقرار نمی‌شود. این وضعیت به‌صورت واقعی گزارش می‌شود.
              </InfoBanner>
            )}
            <DataTable
              head={
                <tr>
                  <Th>ارائه‌دهنده</Th>
                  <Th>نوع</Th>
                  <Th>مدل</Th>
                  <Th>وضعیت</Th>
                  <Th>کلید</Th>
                  <Th>آخرین آزمون</Th>
                  {canManage && <Th>اتصال</Th>}
                </tr>
              }
            >
              {data.items.map((p: AiProviderConfig) => (
                <tr key={p.id}>
                  <Td>
                    <div className="flex flex-col">
                      <span className="flex items-center gap-2 font-medium text-on-surface">
                        {p.nameFa}
                        {p.isDefault && <Badge tone="brand">پیش‌فرض</Badge>}
                      </span>
                      {p.baseUrl && (
                        <span className="text-caption text-muted" dir="ltr">
                          {p.baseUrl}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>{AI_PROVIDER_KIND_FA[p.kind]}</Td>
                  <Td dir="ltr" className="text-caption">
                    {p.model ?? "—"}
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        p.status === "configured"
                          ? "success"
                          : p.status === "disabled"
                            ? "neutral"
                            : "warning"
                      }
                    >
                      {AI_PROVIDER_STATUS_FA[p.status]}
                    </Badge>
                  </Td>
                  <Td>
                    {p.hasKey ? (
                      <span className="font-mono text-caption" dir="ltr">
                        {p.keyHint ?? "••••"}
                      </span>
                    ) : (
                      <Badge tone="warning">ثبت نشده</Badge>
                    )}
                  </Td>
                  <Td className="text-caption text-muted">
                    {p.lastTestAt ? (
                      <span>
                        {toRelativeTime(p.lastTestAt)}
                        {p.lastTestOk === false && " · ناموفق"}
                        {p.lastTestOk === true && " · موفق"}
                      </span>
                    ) : (
                      "آزمایش نشده"
                    )}
                  </Td>
                  {canManage && (
                    <Td>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!p.hasKey || testingId === p.id}
                        onClick={() => onTest(p.id)}
                        title={!p.hasKey ? "ابتدا کلید را ثبت کنید" : undefined}
                      >
                        {testingId === p.id ? "در حال آزمون…" : "آزمون اتصال"}
                      </Button>
                    </Td>
                  )}
                </tr>
              ))}
            </DataTable>
          </>
        )}
      </StateView>
    </>
  );
}

function Prompts() {
  const { can } = useAdminMe();
  const canManage = can("admin:ai:manage");
  const [key, setKey] = useState("");
  const prompts = useAiPrompts(key || undefined);
  const create = useCreateAiPrompt();
  const activate = useActivateAiPrompt();
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [form, setForm] = useState({ key: "", labelFa: "", content: "", changelog: "" });

  async function onCreate() {
    setFeedback(null);
    if (!form.key.trim() || !form.content.trim()) {
      setFeedback({ tone: "error", text: "کلید و متن پرامپت الزامی است." });
      return;
    }
    try {
      await create.mutateAsync({ ...form, changelog: form.changelog || null });
      setForm({ key: "", labelFa: "", content: "", changelog: "" });
      setFeedback({ tone: "success", text: "نسخه جدید پرامپت ثبت شد." });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "ثبت نسخه ناموفق بود") });
    }
  }

  async function onActivate(id: string) {
    setFeedback(null);
    try {
      await activate.mutateAsync(id);
      setFeedback({ tone: "success", text: "نسخه فعال شد." });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "فعال‌سازی ناموفق بود") });
    }
  }

  return (
    <Section
      title="پرامپت‌ها و نسخه‌ها"
      subtitle="هر تغییر یک نسخه جدید می‌سازد؛ نسخه فعال جابه‌جا می‌شود."
    >
      <Feedback value={feedback} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TextInput
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="فیلتر بر اساس کلید (مثلاً system.consult)"
          dir="ltr"
          className="min-w-[240px]"
        />
      </div>

      <StateView
        query={prompts}
        loadingRows={3}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="پرامپتی ثبت نشده است."
      >
        {(data) => (
          <DataTable
            head={
              <tr>
                <Th>کلید</Th>
                <Th>برچسب</Th>
                <Th>نسخه</Th>
                <Th>وضعیت</Th>
                <Th>تاریخ</Th>
                {canManage && <Th>فعال‌سازی</Th>}
              </tr>
            }
          >
            {data.items.map((p: AiPromptVersion) => (
              <tr key={p.id}>
                <Td dir="ltr" className="font-mono text-caption">
                  {p.key}
                </Td>
                <Td>{p.labelFa}</Td>
                <Td className="tabular-nums">{toPersianNumber(p.version)}</Td>
                <Td>
                  {p.isActive ? (
                    <Badge tone="success">فعال</Badge>
                  ) : (
                    <Badge tone="neutral">غیرفعال</Badge>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-caption text-muted">
                  {toPersianDate(p.createdAt)}
                </Td>
                {canManage && (
                  <Td>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={p.isActive || activate.isPending}
                      onClick={() => onActivate(p.id)}
                    >
                      فعال‌سازی
                    </Button>
                  </Td>
                )}
              </tr>
            ))}
          </DataTable>
        )}
      </StateView>

      {canManage && (
        <Card className="mt-4 p-4">
          <h4 className="mb-2 text-body-2 font-semibold text-onSurface">نسخه جدید</h4>
          <div className="grid grid-cols-1 gap-3 tablet:grid-cols-3">
            <Field label="کلید">
              <TextInput
                dir="ltr"
                value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              />
            </Field>
            <Field label="برچسب">
              <TextInput
                value={form.labelFa}
                onChange={(e) => setForm((f) => ({ ...f, labelFa: e.target.value }))}
              />
            </Field>
            <Field label="تغییرات (Changelog)">
              <TextInput
                value={form.changelog}
                onChange={(e) => setForm((f) => ({ ...f, changelog: e.target.value }))}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="متن پرامپت">
              <textarea
                dir="ltr"
                rows={6}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                className="w-full rounded-medium border border-divider bg-surface px-3 py-2 font-mono text-caption text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </Field>
          </div>
          <div className="mt-3">
            <Button variant="primary" onClick={onCreate} disabled={create.isPending}>
              ثبت نسخه
            </Button>
          </div>
        </Card>
      )}
    </Section>
  );
}

function Metrics() {
  const [range, setRange] = useState("30");
  const metrics = useAiMetrics(Number(range));
  const ranges = [
    { value: "7", label: "۷ روز" },
    { value: "30", label: "۳۰ روز" },
    { value: "90", label: "۹۰ روز" },
  ];

  return (
    <Section
      title="مصرف و کیفیت"
      subtitle="شاخص‌های مصرف بر پایه گزارش ارائه‌دهنده؛ مقادیر ناموجود صراحتاً ذکر می‌شوند."
      actions={<FilterPills options={ranges} value={range} onChange={setRange} />}
    >
      <StateView query={metrics} loadingRows={2}>
        {(m) => {
          const errRate =
            m.totalRequests > 0 ? Math.round((m.errorCount / m.totalRequests) * 100) : null;
          return (
            <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4">
              <StatCard label="کل درخواست‌ها" value={m.totalRequests} />
              <StatCard label="موفق" value={m.successCount} tone="success" />
              <StatCard
                label="ناموفق"
                value={m.errorCount}
                tone={m.errorCount > 0 ? "danger" : "default"}
              />
              <StatCard label="Fallback" value={m.fallbackCount} tone="warning" />
              <StatCard label="مجموع توکن" value={m.totalTokens} />
              {m.estimatedCostToman === null ? (
                <Card className="p-4">
                  <p className="text-caption text-muted">هزینه تخمینی</p>
                  <p className="mt-1 text-h3 font-bold text-amber-600 dark:text-amber-400">
                    ناموجود
                  </p>
                  <p className="mt-1 text-caption text-muted">ارائه‌دهنده هزینه گزارش نمی‌کند.</p>
                </Card>
              ) : (
                <StatCard label="هزینه تخمینی (تومان)" value={m.estimatedCostToman} />
              )}
              <StatCard
                label="میانه تأخیر"
                value={m.latencyP50Ms === null ? "—" : `${toPersianNumber(m.latencyP50Ms)}ms`}
              />
              <StatCard
                label="صدک ۹۵ تأخیر"
                value={m.latencyP95Ms === null ? "—" : `${toPersianNumber(m.latencyP95Ms)}ms`}
              />
              <StatCard label="نیازمند بازبینی انسانی" value={m.needsReviewCount} tone="warning" />
              {errRate !== null && (
                <StatCard label="نرخ خطا" value={`${toPersianNumber(errRate)}٪`} />
              )}
            </div>
          );
        }}
      </StateView>
    </Section>
  );
}

export default function AdminAiPage() {
  const { can } = useAdminMe();
  const canManage = can("admin:ai:manage");
  const providers = useAiProviders();

  return (
    <div>
      <PageHeader
        title="هوش مصنوعی و مدل‌ها"
        description="پیکربندی ارائه‌دهنده‌ها، نسخه‌های پرامپت و شاخص‌های مصرف. کلیدها فقط ذخیره می‌شوند و هرگز بازنمایش داده نمی‌شوند."
      />

      {!canManage && (
        <InfoBanner tone="warning">
          شما مجوز مدیریت هوش مصنوعی را ندارید؛ این نما فقط‌خواندنی است.
        </InfoBanner>
      )}

      <Section title="ارائه‌دهنده‌ها" subtitle="پیکربندی اتصال و آزمون واقعی اتصال.">
        <ProviderForm
          canManage={canManage}
          secretReady={providers.data?.secretStorageConfigured ?? false}
        />
        <ProvidersTable canManage={canManage} />
      </Section>

      <Prompts />
      <Metrics />
    </div>
  );
}
