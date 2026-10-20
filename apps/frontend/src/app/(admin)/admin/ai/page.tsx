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

import { Fragment, useEffect, useState } from "react";
import {
  useAiProviders,
  useSaveAiProvider,
  useTestAiProvider,
  useSetAiProviderEnabled,
  useAiBindings,
  useSaveAiBinding,
  useClearAiBinding,
  useAiBindingImpact,
  useAiUsageBreakdown,
  useRagSources,
  useAiPrompts,
  useCreateAiPrompt,
  useActivateAiPrompt,
  useAiMetrics,
  useAdminMe,
  useChatToolSettings,
  useUpdateChatToolSetting,
} from "@/hooks/useAdmin";
import { toPersianNumber, toPersianDate, toRelativeTime } from "@/lib/persian-utils";
import { AI_PROVIDER_KIND_FA, AI_PROVIDER_STATUS_FA } from "@legalir/types";
import type {
  AiProviderKind,
  AiProviderConfig,
  AiPromptVersion,
  ChatToolAdminView,
  AiServiceBinding,
} from "@legalir/types";
import { SERVICE_CONTEXTS } from "@/lib/ai/service-context";
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
  TextArea,
  Select,
  Field,
  InfoBanner,
  InlineNotice,
  FilterPills,
  Section,
  StatCard,
  ExportButton,
  Pagination,
} from "@/components/admin/ui";
import { Switch } from "@legalir/ui";
import { useClientPagination } from "@/hooks/useClientPagination";

const KIND_OPTIONS: AiProviderKind[] = ["openai", "anthropic", "azure", "openrouter", "custom"];

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

function Feedback({ value }: { value: { tone: "error" | "success"; text: string } | null }) {
  if (!value) return null;
  return <InlineNotice tone={value.tone}>{value.text}</InlineNotice>;
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
    enabled: true,
    availableModels: [],
    defaultModel: null,
  });
  // The catalogue is edited as free text; it is split on commas/newlines so an
  // operator can paste a provider's documented model list verbatim.
  const [modelsText, setModelsText] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function onSave() {
    setFeedback(null);
    if (!form.nameFa.trim()) {
      setFeedback({ tone: "error", text: "نام فارسی ارائه‌دهنده الزامی است." });
      return;
    }
    try {
      const availableModels = Array.from(
        new Set(
          modelsText
            .split(/[,\n]/)
            .map((m) => m.trim())
            .filter(Boolean)
        )
      );
      await save.mutateAsync({
        ...form,
        apiKey: form.apiKey || undefined,
        defaultModel: form.defaultModel?.trim() || form.model?.trim() || null,
        availableModels,
      });
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
            <Field
              label="مدل پیش‌فرض"
              hint="اگر خالی بماند، همان «مدل» بالا استفاده می‌شود."
            >
              <TextInput
                dir="ltr"
                value={form.defaultModel ?? ""}
                placeholder={form.model ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, defaultModel: e.target.value || null }))
                }
              />
            </Field>
            <Field
              label="فهرست مدل‌های مجاز"
              hint="با ویرگول یا خط جدید جدا کنید. اتصال هر قابلیت فقط از این فهرست قابل انتخاب است."
            >
              <TextArea
                dir="ltr"
                rows={2}
                value={modelsText}
                placeholder="gpt-4o, gpt-4o-mini"
                onChange={(e) => setModelsText(e.target.value)}
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
            <div className="flex flex-col gap-2 rounded-medium border border-divider px-3 py-1.5">
              <Switch
                checked={Boolean(form.isDefault)}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                label="ارائه‌دهنده پیش‌فرض"
                tone="selection"
              />
              <Switch
                checked={form.enabled !== false}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                label="فعال (در مسیریابی شرکت کند)"
                tone="selection"
              />
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
  const setEnabled = useSetAiProviderEnabled();
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const providerRows = providers.data?.items ?? [];
  const providersPager = useClientPagination(providerRows);

  async function onToggleEnabled(p: AiProviderConfig, enabled: boolean) {
    setFeedback(null);
    try {
      await setEnabled.mutateAsync({ id: p.id, enabled });
      setFeedback({
        tone: "success",
        text: enabled
          ? `ارائه‌دهندهٔ «${p.nameFa}» فعال شد و از درخواست بعدی در مسیریابی شرکت می‌کند.`
          : `ارائه‌دهندهٔ «${p.nameFa}» غیرفعال شد؛ درخواست‌های وابسته به آن به پیش‌فرض یا جایگزین می‌روند.`,
      });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "تغییر وضعیت ناموفق بود") });
    }
  }

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
                  <Th>مدل‌ها</Th>
                  <Th>وضعیت</Th>
                  <Th>کلید</Th>
                  <Th>آخرین آزمون</Th>
                  {canManage && <Th>فعال</Th>}
                  {canManage && <Th>اتصال</Th>}
                </tr>
              }
            >
              {providersPager.pageItems.map((p: AiProviderConfig) => (
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
                    {/* The catalogue is what a binding may pick from; when the
                        operator declared none the single in-use model stands
                        for it, so the cell is never a misleading empty list. */}
                    {(p.availableModels?.length ?? 0) === 0 ? (
                      (p.model ?? "—")
                    ) : (
                      <div className="flex flex-col">
                        <span>{p.defaultModel ?? p.model ?? "—"}</span>
                        <span className="text-[11px] text-muted">
                          {toPersianNumber(p.availableModels!.length)} مدل در فهرست
                        </span>
                      </div>
                    )}
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
                      <Switch
                        checked={p.enabled !== false}
                        disabled={setEnabled.isPending}
                        onChange={(e) => void onToggleEnabled(p, e.target.checked)}
                        aria-label={`ارائه‌دهنده ${p.nameFa}`}
                        label={p.enabled !== false ? "فعال" : "غیرفعال"}
                        tone="selection"
                      />
                    </Td>
                  )}
                  {canManage && (
                    <Td>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!p.hasKey || testingId === p.id || p.enabled === false}
                        onClick={() => onTest(p.id)}
                        title={
                          !p.hasKey
                            ? "ابتدا کلید را ثبت کنید"
                            : p.enabled === false
                              ? "ارائه‌دهنده غیرفعال است"
                              : undefined
                        }
                      >
                        {testingId === p.id ? "در حال آزمون…" : "آزمون اتصال"}
                      </Button>
                    </Td>
                  )}
                </tr>
              ))}
            </DataTable>

            <Pagination
              page={providersPager.page}
              pageSize={providersPager.pageSize}
              total={providersPager.total}
              totalPages={providersPager.totalPages}
              itemLabel="ارائه‌دهنده"
              onPageChange={providersPager.setPage}
              onPageSizeChange={providersPager.setPageSize}
            />
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
  const promptRows = prompts.data?.items ?? [];
  const promptsPager = useClientPagination(promptRows);
  const { reset: resetPromptsPage } = promptsPager;
  useEffect(() => {
    resetPromptsPage();
  }, [resetPromptsPage, key]);
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
        {() => (
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
            {promptsPager.pageItems.map((p: AiPromptVersion) => (
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

      <Pagination
        page={promptsPager.page}
        pageSize={promptsPager.pageSize}
        total={promptsPager.total}
        totalPages={promptsPager.totalPages}
        itemLabel="نسخه"
        onPageChange={promptsPager.setPage}
        onPageSizeChange={promptsPager.setPageSize}
      />

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
              {/* The provider can genuinely omit cost. The card keeps the KPI
                  shell — label → value → explanation — and the value slot says
                  «ناموجود» instead of a ۰ that would read as a real measurement.
                  The label text is identical to the available variant. */}
              <StatCard
                label={m.estimatedCostToman === null ? "هزینه تخمینی" : "هزینه تخمینی (تومان)"}
                value={m.estimatedCostToman ?? 0}
                unavailable={m.estimatedCostToman === null}
                unavailableLabel="ناموجود"
                hint={m.estimatedCostToman === null ? "ارائه‌دهنده هزینه گزارش نمی‌کند." : undefined}
              />
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

// ---------------------------------------------------------------------------
// Contextual chat tools
// ---------------------------------------------------------------------------
// Two layers, kept visibly separate so the panel can never imply that a
// toggle creates a capability:
//   • «فعال» is the admin's decision and is editable here;
//   • «در دسترس» is the server's capability verdict (does a real source
//     exist?) and is read-only. Enabling a tool whose source is missing
//     changes nothing for the user — the capability check still refuses it.

function ChatTools() {
  const { can } = useAdminMe();
  const canManage = can("admin:ai:manage");
  const toolsQuery = useChatToolSettings();
  const update = useUpdateChatToolSetting();

  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    labelFa: string;
    descriptionFa: string;
    effectNoteFa: string;
    order: number;
    allowedServiceTypes: string[];
  } | null>(null);

  const serviceOptions = Object.values(SERVICE_CONTEXTS);

  async function apply(toolId: string, input: Parameters<typeof update.mutateAsync>[0]["input"]) {
    setFeedback(null);
    try {
      await update.mutateAsync({ toolId, input });
      setFeedback({ tone: "success", text: "تنظیمات ابزار ذخیره و ثبت شد." });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "ذخیره تنظیمات ناموفق بود") });
    }
  }

  function startEdit(tool: ChatToolAdminView) {
    setEditingId(tool.toolId);
    setDraft({
      labelFa: tool.labelFa,
      descriptionFa: tool.descriptionFa,
      effectNoteFa: tool.effectNoteFa,
      order: tool.order,
      allowedServiceTypes: tool.allowedServiceTypes,
    });
  }

  return (
    <Section
      title="ابزارهای زمینه‌ای چت"
      subtitle="فعال/غیرفعال بودن، سرویس‌های مجاز و متن نمایشی هر ابزار. «در دسترس» را سرور تعیین می‌کند و با این تنظیمات تغییر نمی‌کند."
    >
      <Feedback value={feedback} />
      {!canManage && (
        <InfoBanner tone="warning">
          شما مجوز مدیریت هوش مصنوعی را ندارید؛ این بخش فقط‌خواندنی است.
        </InfoBanner>
      )}

      <StateView query={toolsQuery} loadingRows={3}>
        {(data) => (
          <DataTable
            head={
              <tr>
                <Th>ابزار</Th>
                <Th>فعال</Th>
                <Th>در دسترس</Th>
                <Th>سرویس‌های مجاز</Th>
                <Th>ترتیب</Th>
                <Th>آخرین تغییر</Th>
                {canManage && <Th>ویرایش</Th>}
              </tr>
            }
          >
            {data.items.map((tool) => (
              <Fragment key={tool.toolId}>
                <tr>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-medium text-onSurface">{tool.labelFa}</span>
                      <span className="text-caption text-muted" dir="ltr">
                        {tool.toolId}
                      </span>
                      <span className="text-caption text-muted">{tool.effectNoteFa}</span>
                    </div>
                  </Td>
                  <Td>
                    <Switch
                      checked={tool.enabled}
                      disabled={!canManage}
                      onChange={(e) => void apply(tool.toolId, { enabled: e.target.checked })}
                      // The visible label is only the state («فعال»), which is
                      // identical on every row — name the switch after its tool
                      // so a screen reader (and a test) can tell them apart.
                      aria-label={`ابزار ${tool.labelFa}`}
                      label={tool.enabled ? "فعال" : "غیرفعال"}
                      tone="selection"
                    />
                  </Td>
                  <Td>
                    {tool.available ? (
                      <Badge tone="success">در دسترس</Badge>
                    ) : (
                      <div className="flex max-w-[240px] flex-col gap-1">
                        <Badge tone="neutral">در دسترس نیست</Badge>
                        {tool.unavailableReasonFa && (
                          <span className="text-caption leading-relaxed text-muted">
                            {tool.unavailableReasonFa}
                          </span>
                        )}
                      </div>
                    )}
                  </Td>
                  <Td className="text-caption text-muted">
                    {tool.allowedServiceTypes.length === 0
                      ? "همه سرویس‌ها"
                      : tool.allowedServiceTypes
                          .map((s) => SERVICE_CONTEXTS[s as keyof typeof SERVICE_CONTEXTS]?.label ?? s)
                          .join("، ")}
                  </Td>
                  <Td className="tabular-nums">{toPersianNumber(tool.order)}</Td>
                  <Td className="whitespace-nowrap text-caption text-muted">
                    {tool.updatedBy ? (
                      <span>
                        {toRelativeTime(tool.updatedAt)}
                        <span className="block text-[11px]">{tool.updatedBy}</span>
                      </span>
                    ) : (
                      "پیش‌فرض"
                    )}
                  </Td>
                  {canManage && (
                    <Td>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => startEdit(tool)}
                        disabled={editingId === tool.toolId}
                      >
                        ویرایش متن
                      </Button>
                    </Td>
                  )}
                </tr>
                {canManage && editingId === tool.toolId && draft && (
                  <tr>
                    <td colSpan={7} className="px-4 pb-4 pt-0">
                      <Card className="p-4">
                        <div className="grid grid-cols-1 gap-3 tablet:grid-cols-3">
                          <Field label="برچسب نمایشی">
                            <TextInput
                              value={draft.labelFa}
                              onChange={(e) => setDraft((d) => (d ? { ...d, labelFa: e.target.value } : d))}
                            />
                          </Field>
                          <Field label="ترتیب">
                            <TextInput
                              type="number"
                              value={draft.order}
                              onChange={(e) =>
                                setDraft((d) => (d ? { ...d, order: Number(e.target.value) } : d))
                              }
                            />
                          </Field>
                          <Field label="توضیح کوتاه (اثر انتخاب)">
                            <TextInput
                              value={draft.effectNoteFa}
                              onChange={(e) =>
                                setDraft((d) => (d ? { ...d, effectNoteFa: e.target.value } : d))
                              }
                            />
                          </Field>
                        </div>
                        <div className="mt-3">
                          <Field label="توضیح کامل (پاپ‌اور)">
                            <TextInput
                              value={draft.descriptionFa}
                              onChange={(e) =>
                                setDraft((d) => (d ? { ...d, descriptionFa: e.target.value } : d))
                              }
                            />
                          </Field>
                        </div>
                        <fieldset className="mt-3">
                          <legend className="mb-1 text-caption text-muted">
                            سرویس‌های مجاز — بدون انتخاب یعنی همه سرویس‌ها
                          </legend>
                          <div className="flex flex-wrap gap-2">
                            {serviceOptions.map((svc) => {
                              const checked = draft.allowedServiceTypes.includes(svc.serviceType);
                              return (
                                <label
                                  key={svc.serviceType}
                                  className="flex min-h-9 items-center gap-2 rounded-full border border-divider px-3 text-caption"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) =>
                                      setDraft((d) => {
                                        if (!d) return d;
                                        const next = e.target.checked
                                          ? [...d.allowedServiceTypes, svc.serviceType]
                                          : d.allowedServiceTypes.filter((s) => s !== svc.serviceType);
                                        return { ...d, allowedServiceTypes: next };
                                      })
                                    }
                                  />
                                  {svc.label}
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={update.isPending}
                            onClick={() =>
                              void apply(tool.toolId, {
                                labelFa: draft.labelFa,
                                descriptionFa: draft.descriptionFa,
                                effectNoteFa: draft.effectNoteFa,
                                order: draft.order,
                                allowedServiceTypes: draft.allowedServiceTypes,
                              }).then(() => setEditingId(null))
                            }
                          >
                            ذخیره
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditingId(null)}
                            disabled={update.isPending}
                          >
                            انصراف
                          </Button>
                        </div>
                      </Card>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </DataTable>
        )}
      </StateView>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Per-capability model bindings
// ---------------------------------------------------------------------------
// A capability with NO row follows the default provider. That is stated on
// every row («ارث‌بری از پیش‌فرض») so the panel never implies a binding that
// does not exist. The impact preview is fetched BEFORE saving, from real runs.

function BindingEditor({
  serviceType,
  providers,
  current,
}: {
  serviceType: string;
  providers: { id: string; nameFa: string; enabled: boolean; hasKey: boolean; defaultModel: string | null; availableModels: string[] }[];
  current: AiServiceBinding;
}) {
  const save = useSaveAiBinding();
  const clear = useClearAiBinding();
  const [providerId, setProviderId] = useState<string>(current.providerId ?? "");
  const [model, setModel] = useState<string>(current.model ?? "");
  const [fallbackProviderId, setFallbackProviderId] = useState<string>(
    current.fallbackProviderId ?? ""
  );
  const [temperature, setTemperature] = useState<string>(
    current.temperature === null ? "" : String(current.temperature)
  );
  const [maxOutputTokens, setMaxOutputTokens] = useState<string>(
    current.maxOutputTokens === null ? "" : String(current.maxOutputTokens)
  );
  const [timeoutMs, setTimeoutMs] = useState<string>(
    current.timeoutMs === null ? "" : String(current.timeoutMs)
  );
  const [status, setStatus] = useState<"active" | "inactive">(current.status);
  // Knowledge scope has THREE states, and they are not interchangeable:
  // inherit every published source (null), answer without retrieval ([]),
  // or name the only sources this capability may cite.
  const [scopeMode, setScopeMode] = useState<"all" | "none" | "selected">(
    current.knowledgeSourceIds === null
      ? "all"
      : current.knowledgeSourceIds.length === 0
        ? "none"
        : "selected"
  );
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(
    current.knowledgeSourceIds ?? []
  );
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(
    null
  );

  const rag = useRagSources();
  const ragSources = rag.data?.items ?? [];
  const chosen = providers.find((p) => p.id === providerId) ?? null;
  const impact = useAiBindingImpact({
    serviceType,
    providerId: providerId || null,
    model: model || null,
    status,
  });

  async function onSave() {
    setFeedback(null);
    try {
      const res = await save.mutateAsync({
        serviceType,
        input: {
          providerId: providerId || null,
          model: model || null,
          fallbackProviderId: fallbackProviderId || null,
          temperature: temperature === "" ? null : Number(temperature),
          maxOutputTokens: maxOutputTokens === "" ? null : Number(maxOutputTokens),
          timeoutMs: timeoutMs === "" ? null : Number(timeoutMs),
          knowledgeSourceIds:
            scopeMode === "all" ? null : scopeMode === "none" ? [] : selectedSourceIds,
          status,
        },
      });
      setFeedback({
        tone: "success",
        text: `اتصال ذخیره شد. ${toPersianNumber(res.impact.requests)} درخواست در ۳۰ روز گذشته از این قابلیت اجرا شده است.`,
      });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "ذخیره اتصال ناموفق بود") });
    }
  }

  async function onClear() {
    setFeedback(null);
    try {
      await clear.mutateAsync(serviceType);
      setProviderId("");
      setModel("");
      setFallbackProviderId("");
      setFeedback({
        tone: "success",
        text: "اتصال اختصاصی حذف شد؛ این قابلیت به ارائه‌دهندهٔ پیش‌فرض بازگشت.",
      });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "حذف اتصال ناموفق بود") });
    }
  }

  return (
    <Card className="mt-2 p-4">
      <Feedback value={feedback} />
      <div className="grid grid-cols-1 gap-3 tablet:grid-cols-3">
        <Field label="ارائه‌دهنده" hint="خالی = وراثت از پیش‌فرض پلتفرم">
          <Select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            <option value="">— پیش‌فرض پلتفرم —</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameFa}
                {p.enabled ? "" : " (غیرفعال)"}
                {p.hasKey ? "" : " (بدون کلید)"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="مدل" hint="خالی = مدل پیش‌فرض همان ارائه‌دهنده">
          {chosen && chosen.availableModels.length > 0 ? (
            <Select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="">— پیش‌فرض ارائه‌دهنده —</option>
              {chosen.availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          ) : (
            <TextInput dir="ltr" value={model} onChange={(e) => setModel(e.target.value)} />
          )}
        </Field>
        <Field label="ارائه‌دهندهٔ جایگزین" hint="فقط وقتی اصلی در دسترس نیست">
          <Select
            value={fallbackProviderId}
            onChange={(e) => setFallbackProviderId(e.target.value)}
          >
            <option value="">— بدون جایگزین —</option>
            {providers
              .filter((p) => p.id !== providerId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameFa}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="دما (۰ تا ۲)">
          <TextInput
            dir="ltr"
            inputMode="decimal"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          />
        </Field>
        <Field label="حداکثر توکن خروجی">
          <TextInput
            dir="ltr"
            inputMode="numeric"
            value={maxOutputTokens}
            onChange={(e) => setMaxOutputTokens(e.target.value)}
          />
        </Field>
        <Field label="مهلت پاسخ (میلی‌ثانیه)">
          <TextInput
            dir="ltr"
            inputMode="numeric"
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-3 rounded-medium border border-divider px-3 py-1.5">
        <Switch
          checked={status === "active"}
          onChange={(e) => setStatus(e.target.checked ? "active" : "inactive")}
          label={status === "active" ? "اتصال فعال" : "اتصال غیرفعال (بازگشت به پیش‌فرض)"}
          tone="selection"
        />
      </div>

      <div className="mt-3 rounded-medium border border-divider p-3">
        <div className="mb-2 text-caption font-semibold text-onSurface">دامنهٔ منابع دانش</div>
        <FilterPills
          options={[
            { value: "all", label: "همهٔ منابع منتشرشده" },
            { value: "none", label: "بدون بازیابی" },
            { value: "selected", label: "فقط منابع انتخاب‌شده" },
          ]}
          value={scopeMode}
          onChange={(v) => setScopeMode(v as "all" | "none" | "selected")}
        />
        <p className="mt-2 text-caption leading-relaxed text-muted">
          {scopeMode === "all"
            ? "این قابلیت می‌تواند به هر منبع منتشرشده استناد کند."
            : scopeMode === "none"
              ? "این قابلیت بدون جستجو در منابع پاسخ می‌دهد و هیچ استنادی نمی‌سازد."
              : "تنها منابعی که در زیر علامت می‌زنید قابل استناد خواهند بود؛ منابع دیگر حتی اگر مرتبط باشند حذف می‌شوند."}
        </p>
        {scopeMode === "selected" && (
          <div className="mt-2">
            {rag.isLoading ? (
              <div className="text-caption text-muted">در حال بارگذاری منابع…</div>
            ) : ragSources.length === 0 ? (
              <div className="text-caption text-muted">منبعی برای انتخاب موجود نیست.</div>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-medium bg-surface-variant/30 p-2">
                {ragSources.map((s) => {
                  const checked = selectedSourceIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-start gap-2 rounded-small px-2 py-1.5 hover:bg-surface-variant/60"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        onChange={(e) =>
                          setSelectedSourceIds((prev) =>
                            e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                          )
                        }
                      />
                      <span className="flex flex-col">
                        <span className="text-body-2 text-onSurface">{s.title}</span>
                        <span className="text-caption text-muted">
                          {s.sourceTypeFa}
                          {s.activeInRetrieval ? "" : " — خارج از بازیابی"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="mt-1 text-caption text-muted">
              {toPersianNumber(selectedSourceIds.length)} منبع انتخاب شده است.
            </div>
          </div>
        )}
      </div>

      {/* The preview is the SAME computation the save freezes into the audit
          trail — so what the operator reads here is what gets recorded. */}
      <div className="mt-3 rounded-medium bg-surface-variant/40 p-3">
        <div className="mb-1 text-caption font-semibold text-onSurface">اثر تغییر پیش از ذخیره</div>
        {impact.isLoading ? (
          <div className="text-caption text-muted">در حال محاسبه بر پایهٔ اجراهای واقعی…</div>
        ) : impact.data ? (
          <ul className="list-inside list-disc space-y-1 text-caption leading-relaxed text-muted">
            {impact.data.impactFa.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : (
          <div className="text-caption text-muted">پیش‌نمایش اثر در دسترس نیست.</div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={onSave} disabled={save.isPending}>
          {save.isPending ? "در حال ذخیره…" : "ذخیرهٔ اتصال"}
        </Button>
        {current.id && current.providerId && (
          <Button variant="secondary" onClick={onClear} disabled={clear.isPending}>
            حذف اتصال و بازگشت به پیش‌فرض
          </Button>
        )}
      </div>
    </Card>
  );
}

function Bindings() {
  const { can } = useAdminMe();
  const canManage = can("admin:ai:manage");
  const bindings = useAiBindings();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <Section
      title="اتصال مدل به قابلیت‌ها"
      subtitle="برای هر قابلیت، ارائه‌دهنده و مدل اجرا مشخص می‌شود. قابلیتی که اتصال اختصاصی ندارد، از ارائه‌دهندهٔ پیش‌فرض استفاده می‌کند."
    >
      <StateView query={bindings} loadingRows={4}>
        {(data) => (
          <DataTable
            head={
              <tr>
                <Th>قابلیت</Th>
                <Th>ارائه‌دهنده</Th>
                <Th>مدل</Th>
                <Th>وضعیت</Th>
                <Th>آخرین تغییر</Th>
                {canManage && <Th>ویرایش</Th>}
              </tr>
            }
          >
            {data.items.map((b) => {
              const provider = data.providers.find((p) => p.id === b.providerId);
              const degraded =
                b.configured &&
                (b.status === "inactive" ||
                  !provider ||
                  !provider.enabled ||
                  !provider.hasKey);
              return (
                <Fragment key={b.serviceType}>
                  <tr>
                    <Td>
                      <div className="flex flex-col">
                        <span className="font-medium text-onSurface">
                          {data.capabilities.find((c) => c.serviceType === b.serviceType)?.labelFa ??
                            b.serviceType}
                        </span>
                        <span className="text-caption text-muted" dir="ltr">
                          {b.serviceType}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      {b.configured ? (
                        (provider?.nameFa ?? b.providerId ?? "—")
                      ) : (
                        <span className="text-muted">پیش‌فرض پلتفرم (ارث‌بری)</span>
                      )}
                    </Td>
                    <Td dir="ltr" className="text-caption">
                      {b.model ?? (b.configured ? "پیش‌فرض ارائه‌دهنده" : "—")}
                    </Td>
                    <Td>
                      {degraded ? (
                        <Badge tone="warning">تنزل‌یافته</Badge>
                      ) : b.configured ? (
                        <Badge tone="success">فعال</Badge>
                      ) : (
                        <Badge tone="neutral">بدون اتصال اختصاصی</Badge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-caption text-muted">
                      {b.updatedAt ? toRelativeTime(b.updatedAt) : "—"}
                    </Td>
                    {canManage && (
                      <Td>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setEditing((v) => (v === b.serviceType ? null : b.serviceType))
                          }
                        >
                          {editing === b.serviceType ? "بستن" : "ویرایش اتصال"}
                        </Button>
                      </Td>
                    )}
                  </tr>
                  {canManage && editing === b.serviceType && (
                    <tr>
                      <td colSpan={6} className="px-4 pb-4 pt-0">
                        <BindingEditor
                          serviceType={b.serviceType}
                          providers={data.providers}
                          current={b}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </DataTable>
        )}
      </StateView>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Real usage split
// ---------------------------------------------------------------------------
// Requests/errors come from the runs the pipeline actually executed; tokens
// and provider/model come from the settled ledger. Anything unattributable is
// counted as such — never spread across buckets to make the table look full.

function UsageSplit() {
  const [range, setRange] = useState("30");
  const usage = useAiUsageBreakdown(Number(range));
  const ranges = [
    { value: "7", label: "۷ روز" },
    { value: "30", label: "۳۰ روز" },
    { value: "90", label: "۹۰ روز" },
  ];

  return (
    <Section
      title="تفکیک مصرف"
      subtitle="بر پایهٔ اجراهای ثبت‌شده و دفتر مصرف تسویه‌شده. مصرفی که به ارائه‌دهنده یا قابلیت قابل انتساب نباشد، جداگانه شمرده می‌شود."
      actions={<FilterPills options={ranges} value={range} onChange={setRange} />}
    >
      <StateView query={usage} loadingRows={3}>
        {(u) => {
          const splitTable = (
            title: string,
            rows: typeof u.byProvider
          ) => (
            <div className="flex-1">
              <h4 className="mb-2 text-body-2 font-semibold text-onSurface">{title}</h4>
              {rows.length === 0 ? (
                <div className="rounded-medium border border-divider p-3 text-caption text-muted">
                  در این بازه مصرفی ثبت نشده است.
                </div>
              ) : (
                <DataTable
                  head={
                    <tr>
                      <Th>عنوان</Th>
                      <Th>درخواست</Th>
                      <Th>توکن ورودی</Th>
                      <Th>توکن خروجی</Th>
                      <Th>مجموع توکن</Th>
                    </tr>
                  }
                >
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <Td>
                        <span className="font-medium text-onSurface">{r.labelFa}</span>
                        {/* Synthetic bucket keys are internal — never show them. */}
                        {r.labelFa !== r.key &&
                          !r.key.startsWith("__") &&
                          !r.key.startsWith("protocol:") && (
                          <span className="block text-caption text-muted" dir="ltr">
                            {r.key}
                          </span>
                        )}
                      </Td>
                      <Td className="tabular-nums">{toPersianNumber(r.requests)}</Td>
                      <Td className="tabular-nums">{toPersianNumber(r.inputTokens)}</Td>
                      <Td className="tabular-nums">{toPersianNumber(r.outputTokens)}</Td>
                      <Td className="tabular-nums">{toPersianNumber(r.totalTokens)}</Td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </div>
          );

          return (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
                <StatCard label="کل درخواست‌ها" value={u.totalRequests} />
                <StatCard label="مجموع توکن" value={u.totalTokens} />
                <StatCard
                  label="درخواست بدون انتساب"
                  value={u.unattributedRequests}
                  tone={u.unattributedRequests > 0 ? "warning" : "default"}
                  hint={
                    u.attributionAvailable
                      ? undefined
                      : "هیچ ردیف تسویه‌شده‌ای نام ارائه‌دهنده را ندارد."
                  }
                />
                <StatCard
                  label="مصرف بدون قابلیت"
                  value={u.unattributedServiceRequests}
                  tone={u.unattributedServiceRequests > 0 ? "warning" : "default"}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 desktop:grid-cols-2">
                {splitTable("به تفکیک ارائه‌دهنده", u.byProvider)}
                {splitTable("به تفکیک قابلیت", u.byService)}
              </div>
              <div className="grid grid-cols-1 gap-5 desktop:grid-cols-2">
                {splitTable("به تفکیک مدل", u.byModel)}
                <div className="flex-1">
                  <h4 className="mb-2 text-body-2 font-semibold text-onSurface">روزانه</h4>
                  {u.byDay.length === 0 ? (
                    <div className="rounded-medium border border-divider p-3 text-caption text-muted">
                      در این بازه مصرفی ثبت نشده است.
                    </div>
                  ) : (
                    <DataTable
                      head={
                        <tr>
                          <Th>تاریخ</Th>
                          <Th>درخواست</Th>
                          <Th>توکن</Th>
                        </tr>
                      }
                    >
                      {u.byDay.map((d) => (
                        <tr key={d.date}>
                          <Td className="whitespace-nowrap">{toPersianDate(d.date)}</Td>
                          <Td className="tabular-nums">{toPersianNumber(d.requests)}</Td>
                          <Td className="tabular-nums">{toPersianNumber(d.totalTokens)}</Td>
                        </tr>
                      ))}
                    </DataTable>
                  )}
                </div>
              </div>
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
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton kind="ai-providers" />
            <ExportButton kind="energy-usage" label="خروجی مصرف" />
          </div>
        }
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

      <Bindings />
      <ChatTools />
      <Prompts />
      <Metrics />
      <UsageSplit />
    </div>
  );
}
