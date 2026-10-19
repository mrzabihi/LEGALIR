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
            <div className="rounded-medium border border-divider px-3 py-1.5">
              <Switch
                checked={Boolean(form.isDefault)}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                label="ارائه‌دهنده پیش‌فرض"
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
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const providerRows = providers.data?.items ?? [];
  const providersPager = useClientPagination(providerRows);

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

      <ChatTools />
      <Prompts />
      <Metrics />
    </div>
  );
}
