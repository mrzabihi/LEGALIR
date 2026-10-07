// ============================================================
// LEGALIR — Admin · Knowledge & AI Configuration center
//           (مرکز دانش و پیکربندی هوش مصنوعی)
// ============================================================
// §1 of the admin spec: ONE place to see and operate the knowledge pipeline
// and the AI/model configuration behind LegalIR.
//
// IMPORTANT — there is exactly ONE retrieval pipeline. The corpus
// (`.data/legal-corpus.json`) produced by the ingestion pipeline feeds BOTH
// the assistant's retrieval and this admin surface. This page never builds a
// parallel corpus: it inspects the same index, re-runs the SAME ingest so
// newly added law files enter it, and lets an operator verify a source is
// reachable by running a REAL query through `retrieveCorpus`.
//
// Tabs:
//   • خط لوله (pipeline) — real corpus stats, catalog coverage, re-ingest
//   • منابع (sources)    — per-source review + publish (the existing flow)
//   • آزمون بازیابی (retrieval) — a live query against the existing pipeline
// The model/provider configuration itself lives on /admin/ai; this center
// surfaces its live status and links there, so configuration stays in one
// authoritative place rather than being duplicated.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import Link from "next/link";
import {
  useRagSources,
  useUpdateRagReview,
  useRagPipeline,
  useRagSourceDetail,
  useTestRagRetrieval,
  useReingestRagCorpus,
  useAiProviders,
  useAdminMe,
} from "@/hooks/useAdmin";
import { toPersianNumber, toPersianDate, toRelativeTime } from "@/lib/persian-utils";
import { RAG_REVIEW_STATE_FA, AI_PROVIDER_STATUS_FA } from "@legalir/types";
import type { RagReviewState, RagSource, RagRetrievalHit } from "@legalir/types";
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
  InfoBanner,
  FilterPills,
  ExportButton,
  StatCard,
  Section,
  EmptyBlock,
  LoadingBlock,
  Tabs,
  type TabItem,
} from "@/components/admin/ui";
import { Drawer, snackbar } from "@legalir/ui";
import {
  IconDatabase,
  IconRefresh,
  IconSearch,
  IconBolt,
  IconLinkSource,
  IconCheckCircle,
  IconFileText,
} from "@/lib/icons";

const STATE_TONES: Record<
  RagReviewState,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  ingested: "neutral",
  extracted: "info",
  indexed: "info",
  under_review: "warning",
  approved: "brand",
  published: "success",
  retired: "neutral",
  failed: "danger",
};

const REVIEW_STATES: RagReviewState[] = [
  "ingested",
  "extracted",
  "indexed",
  "under_review",
  "approved",
  "published",
  "retired",
  "failed",
];

type Tab = "pipeline" | "sources" | "retrieval";

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

// ---------------------------------------------------------------------------
// Pipeline overview — real corpus stats + re-ingest
// ---------------------------------------------------------------------------

function PipelineSection({ canManage }: { canManage: boolean }) {
  const pipeline = useRagPipeline();
  const reingest = useReingestRagCorpus();
  const providers = useAiProviders();

  async function onReingest() {
    try {
      const report = await reingest.mutateAsync();
      snackbar.show({
        message: `نمایه‌سازی مجدد انجام شد: ${toPersianNumber(report.sources)} منبع، ${toPersianNumber(report.chunks)} قطعه.`,
        variant: "success",
      });
    } catch (err) {
      snackbar.show({ message: errMessage(err, "نمایه‌سازی مجدد ناموفق بود"), variant: "error" });
    }
  }

  return (
    <div className="space-y-6">
      <Section
        title="خط لولهٔ دانش"
        subtitle="وضعیت واقعی نمایهٔ بازیابی؛ همان نمایه‌ای که موتور پاسخ به آن ارجاع می‌دهد."
        actions={
          canManage ? (
            <Button
              variant="secondary"
              size="sm"
              startIcon={<IconRefresh size={15} />}
              loading={reingest.isPending}
              onClick={onReingest}
            >
              نمایه‌سازی مجدد منابع
            </Button>
          ) : undefined
        }
      >
        <StateView query={pipeline} loadingRows={3}>
          {(data) => (
            <>
              <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-5">
                <StatCard label="منابع نمایه‌شده" value={data.status.sourceCount} />
                <StatCard label="قطعات (chunk)" value={data.status.chunkCount} />
                <StatCard label="توکن‌های نمایه" value={data.status.tokenCount} />
                <StatCard
                  label="فعال در بازیابی"
                  value={data.status.activeInRetrieval}
                  tone="success"
                />
                <StatCard
                  label="پوشش کاتالوگ قانون"
                  value={`${toPersianNumber(data.coverage.ingested)} / ${toPersianNumber(data.coverage.curated)}`}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 tablet:grid-cols-2">
                <Card className="p-4">
                  <p className="text-caption text-muted">پوشهٔ منابع (ورودی خط لوله)</p>
                  <p className="mt-1 break-all font-mono text-caption text-on-surface" dir="ltr">
                    {data.status.corpusDir}
                  </p>
                  <p className="mt-2 text-caption text-muted">
                    آخرین نمایه‌سازی:{" "}
                    {data.status.lastIngestedAt
                      ? `${toPersianDate(data.status.lastIngestedAt)} · ${toRelativeTime(data.status.lastIngestedAt)}`
                      : "—"}
                  </p>
                  <p className="mt-1 text-caption text-muted">نسخهٔ نمایه: {data.status.corpusVersion}</p>
                </Card>

                <Card className="p-4">
                  <p className="text-caption text-muted">فایل‌های شناسایی‌شدهٔ هنوز نمایه‌نشده</p>
                  {data.status.unindexedFiles.length === 0 ? (
                    <p className="mt-2 flex items-center gap-1.5 text-body-2 text-emerald-600 dark:text-emerald-400">
                      <IconCheckCircle size={16} /> همهٔ فایل‌ها نمایه شده‌اند.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {data.status.unindexedFiles.slice(0, 8).map((f) => (
                        <li
                          key={f}
                          className="flex items-center gap-1.5 text-caption text-on-surface"
                          dir="ltr"
                        >
                          <IconFileText size={14} /> {f}
                        </li>
                      ))}
                      {data.status.unindexedFiles.length > 8 && (
                        <li className="text-caption text-muted">
                          و {toPersianNumber(data.status.unindexedFiles.length - 8)} فایل دیگر…
                        </li>
                      )}
                    </ul>
                  )}
                  {canManage && data.status.unindexedFiles.length > 0 && (
                    <p className="mt-2 text-caption text-amber-600 dark:text-amber-400">
                      برای ورود این فایل‌ها به خط لوله، «نمایه‌سازی مجدد» را اجرا کنید.
                    </p>
                  )}
                </Card>
              </div>
            </>
          )}
        </StateView>
      </Section>

      <Section
        title="پیکربندی مدل و ارائه‌دهنده"
        subtitle="ارائه‌دهنده‌های LLM در یک جای مرجع مدیریت می‌شوند؛ وضعیت زندهٔ آن‌ها اینجاست."
        actions={
          <Link href="/admin/ai">
            <Button variant="secondary" size="sm" startIcon={<IconBolt size={15} />}>
              مدیریت ارائه‌دهنده‌ها
            </Button>
          </Link>
        }
      >
        <StateView query={providers} loadingRows={2}>
          {(data) => (
            <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2 desktop:grid-cols-3">
              {data.items.map((p) => (
                <Card key={p.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium text-on-surface">
                      {p.nameFa}
                      {p.isDefault && <Badge tone="brand">پیش‌فرض</Badge>}
                    </span>
                    <Badge tone={p.status === "configured" ? "success" : "warning"}>
                      {AI_PROVIDER_STATUS_FA[p.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-caption text-muted" dir="ltr">
                    {p.model ?? "—"}
                  </p>
                  {!data.secretStorageConfigured && (
                    <p className="mt-2 text-caption text-amber-600 dark:text-amber-400">
                      ذخیره‌سازی امن کلید پیکربندی نشده است.
                    </p>
                  )}
                </Card>
              ))}
              {data.items.length === 0 && (
                <Card className="p-4 tablet:col-span-2 desktop:col-span-3">
                  <EmptyBlock message="ارائه‌دهندهٔ فعالی پیکربندی نشده است." />
                </Card>
              )}
            </div>
          )}
        </StateView>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Retrieval test — a live query through the ONE existing pipeline
// ---------------------------------------------------------------------------

function RetrievalTester() {
  const test = useTestRagRetrieval();
  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState("5");
  const [result, setResult] = useState<{
    query: string;
    activeSources: number;
    totalSources: number;
    hits: RagRetrievalHit[];
  } | null>(null);

  async function onRun() {
    if (!query.trim()) {
      snackbar.show({ message: "عبارت جستجو را وارد کنید.", variant: "error" });
      return;
    }
    try {
      const res = await test.mutateAsync({ query, maxResults: Number(maxResults) });
      setResult(res);
    } catch (err) {
      snackbar.show({ message: errMessage(err, "آزمون بازیابی ناموفق بود"), variant: "error" });
    }
  }

  return (
    <Section
      title="آزمون بازیابی"
      subtitle="یک پرسش واقعی را از همان خط لولهٔ بازیابی عبور دهید تا مطمئن شوید منابع درست بازیابی می‌شوند."
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1">
          <label className="mb-1 block text-caption font-medium text-on-surface-variant">
            عبارت جستجو
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted">
              <IconSearch size={16} />
            </span>
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onRun()}
              placeholder="مثلاً: شرایط فسخ قرارداد اجاره"
              className="ps-9"
            />
          </div>
        </div>
        <div className="w-32">
          <label className="mb-1 block text-caption font-medium text-on-surface-variant">
            حداکثر نتیجه
          </label>
          <Select value={maxResults} onChange={(e) => setMaxResults(e.target.value)}>
            {["3", "5", "10", "20"].map((n) => (
              <option key={n} value={n}>
                {toPersianNumber(Number(n))}
              </option>
            ))}
          </Select>
        </div>
        <Button
          variant="primary"
          startIcon={<IconLinkSource size={15} />}
          loading={test.isPending}
          onClick={onRun}
        >
          اجرای بازیابی
        </Button>
      </div>

      <div className="mt-4">
        {test.isPending ? (
          <LoadingBlock rows={3} />
        ) : result === null ? (
          <Card className="p-6">
            <EmptyBlock
              message="نتیجه‌ای نمایش داده نشده است."
              hint="یک عبارت وارد کرده و «اجرای بازیابی» را بزنید."
            />
          </Card>
        ) : result.hits.length === 0 ? (
          <InfoBanner tone="warning">
            هیچ قطعه‌ای بازیابی نشد. یا عبارت با واژگان منابع هم‌خوان نیست، یا منابع مرتبط در وضعیت
            «تأیید/انتشار» نیستند.
          </InfoBanner>
        ) : (
          <>
            <p className="mb-3 text-caption text-muted">
              {result.hits.length} نتیجه از میان {toPersianNumber(result.activeSources)} منبع فعال (از
              مجموع {toPersianNumber(result.totalSources)}).
            </p>
            <div className="space-y-3">
              {result.hits.map((h) => (
                <Card key={h.chunkId} className="p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium text-on-surface">
                      <IconDatabase size={15} className="text-muted" />
                      {h.title}
                    </span>
                    <div className="flex items-center gap-2">
                      {h.locator && <span className="text-caption text-muted">{h.locator}</span>}
                      <Badge tone={h.activeInRetrieval ? "success" : "neutral"}>
                        {h.activeInRetrieval ? "فعال در بازیابی" : "غیرفعال"}
                      </Badge>
                      <Badge tone="brand">امتیاز {toPersianNumber(h.score)}</Badge>
                    </div>
                  </div>
                  <p className="text-body-2 text-on-surface-variant">{h.excerpt}</p>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Source detail drawer — the actual searchable chunks
// ---------------------------------------------------------------------------

function SourceDetailDrawer({
  sourceId,
  onClose,
}: {
  sourceId: string | null;
  onClose: () => void;
}) {
  const detail = useRagSourceDetail(sourceId);
  return (
    <Drawer
      open={Boolean(sourceId)}
      onClose={onClose}
      width={560}
      title={detail.data ? `منبع — ${detail.data.source.title}` : "منبع"}
    >
      {detail.isLoading ? (
        <LoadingBlock rows={5} />
      ) : detail.data ? (
        <div className="space-y-4">
          <div className="rounded-large border border-divider p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATE_TONES[detail.data.source.reviewState]}>
                {RAG_REVIEW_STATE_FA[detail.data.source.reviewState]}
              </Badge>
              <Badge tone={detail.data.source.activeInRetrieval ? "success" : "neutral"}>
                {detail.data.source.activeInRetrieval ? "فعال در بازیابی" : "غیرفعال"}
              </Badge>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-caption">
              <div>
                <dt className="text-muted">نوع منبع</dt>
                <dd className="text-on-surface-variant">{detail.data.source.sourceTypeFa}</dd>
              </div>
              <div>
                <dt className="text-muted">مرجع</dt>
                <dd className="text-on-surface-variant">{detail.data.source.authority}</dd>
              </div>
              <div>
                <dt className="text-muted">تعداد قطعه</dt>
                <dd className="tabular-nums">{toPersianNumber(detail.data.source.chunkCount)}</dd>
              </div>
              <div>
                <dt className="text-muted">خروجی ارزیابی</dt>
                <dd className="tabular-nums">
                  {detail.data.source.evalScore === null
                    ? "—"
                    : toPersianNumber(detail.data.source.evalScore)}
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <h4 className="mb-2 text-body-2 font-bold text-on-surface">
              قطعات قابل بازیابی ({toPersianNumber(detail.data.chunks.length)})
            </h4>
            <div className="space-y-2">
              {detail.data.chunks.map((ch) => (
                <div key={ch.id} className="rounded-medium border border-divider p-3">
                  {ch.locator && (
                    <p className="mb-1 text-caption font-medium text-brand">{ch.locator}</p>
                  )}
                  <p className="text-caption text-on-surface-variant">{ch.text}</p>
                </div>
              ))}
              {detail.data.chunks.length === 0 && (
                <p className="text-caption text-muted">قطعه‌ای برای این منبع ثبت نشده است.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <EmptyBlock message="منبع یافت نشد." />
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Sources tab — review + publish (the existing, audited flow)
// ---------------------------------------------------------------------------

function SourcesSection({ canManage }: { canManage: boolean }) {
  const [state, setState] = useState<string>("");
  const [search, setSearch] = useState("");
  const [reviewTarget, setReviewTarget] = useState<RagSource | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Debounce the search box so the source list re-queries on a pause.
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const query = useRagSources({
    reviewState: (state || undefined) as RagReviewState | undefined,
    search: debouncedSearch || undefined,
  });

  const filters = useMemo(
    () => [
      { value: "", label: "همه" },
      ...REVIEW_STATES.map((s) => ({ value: s, label: RAG_REVIEW_STATE_FA[s] })),
    ],
    []
  );

  return (
    <div>
      {!canManage && (
        <InfoBanner tone="warning">
          شما مجوز مدیریت منابع RAG را ندارید؛ این فهرست فقط‌خواندنی است.
        </InfoBanner>
      )}

      {query.data && (
        <div className="mb-4 flex flex-wrap gap-2 text-caption text-muted">
          {REVIEW_STATES.map((s) =>
            query.data.counts[s] !== undefined ? (
              <Badge key={s} tone={STATE_TONES[s]}>
                {RAG_REVIEW_STATE_FA[s]}: {toPersianNumber(query.data.counts[s])}
              </Badge>
            ) : null
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted">
            <IconSearch size={16} />
          </span>
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو در عنوان یا مرجع"
            className="ps-9"
          />
        </div>
        <FilterPills options={filters} value={state} onChange={setState} />
      </div>

      <StateView
        query={query}
        loadingRows={6}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="منبعی با این فیلتر یافت نشد."
      >
        {(data) => (
          <DataTable
            head={
              <tr>
                <Th>عنوان</Th>
                <Th>نوع</Th>
                <Th>مرجع</Th>
                <Th>وضعیت بازبینی</Th>
                <Th>بازیابی</Th>
                <Th>انتشار عمومی</Th>
                <Th>عملیات</Th>
              </tr>
            }
          >
            {data.items.map((s) => (
              <tr key={s.id}>
                <Td className="max-w-[280px]">
                  <span className="block truncate font-medium text-on-surface" title={s.title}>
                    {s.title}
                  </span>
                </Td>
                <Td className="text-caption text-muted">{s.sourceTypeFa}</Td>
                <Td className="text-caption text-muted">
                  {s.authority}
                  {s.domain ? ` · ${s.domain}` : ""}
                </Td>
                <Td>
                  <Badge tone={STATE_TONES[s.reviewState]}>
                    {RAG_REVIEW_STATE_FA[s.reviewState]}
                  </Badge>
                </Td>
                <Td>
                  {s.activeInRetrieval ? (
                    <Badge tone="success">فعال</Badge>
                  ) : (
                    <Badge tone="neutral">غیرفعال</Badge>
                  )}
                </Td>
                <Td>
                  {s.publishedInLibrary ? (
                    <Badge tone="brand">منتشرشده</Badge>
                  ) : (
                    <span className="text-caption text-muted">—</span>
                  )}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setDetailId(s.id)}>
                      جزئیات
                    </Button>
                    {canManage && (
                      <Button size="sm" variant="secondary" onClick={() => setReviewTarget(s)}>
                        بازبینی
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </StateView>

      {reviewTarget && (
        <Drawer
          open={Boolean(reviewTarget)}
          onClose={() => setReviewTarget(null)}
          width={560}
          title={`بازبینی — ${reviewTarget.title}`}
        >
          <ReviewForm source={reviewTarget} onDone={() => setReviewTarget(null)} />
        </Drawer>
      )}

      <SourceDetailDrawer sourceId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function ReviewForm({ source, onDone }: { source: RagSource; onDone: () => void }) {
  const update = useUpdateRagReview();
  const [state, setState] = useState<RagReviewState>(source.reviewState);
  const [publishToLibrary, setPublishToLibrary] = useState(source.publishedInLibrary);
  const [notes, setNotes] = useState(source.notes ?? "");
  const [evalScore, setEvalScore] = useState<string>(
    source.evalScore === null ? "" : String(source.evalScore)
  );

  async function onSave() {
    try {
      await update.mutateAsync({
        id: source.id,
        input: {
          reviewState: state,
          publishedInLibrary: publishToLibrary,
          notes,
          evalScore: evalScore === "" ? null : Number(evalScore),
        },
      });
      snackbar.show({ message: "بازبینی ثبت شد.", variant: "success" });
      onDone();
    } catch (err) {
      snackbar.show({ message: errMessage(err, "ثبت بازبینی ناموفق بود"), variant: "error" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-large border border-divider p-3">
        <p className="text-caption text-muted">نوع منبع</p>
        <p className="text-body-2">{source.sourceTypeFa}</p>
        <p className="mt-2 text-caption text-muted">مرجع</p>
        <p className="text-body-2">{source.authority}</p>
        <p className="mt-2 text-caption text-muted">
          فعال در بازیابی: {source.activeInRetrieval ? "بله" : "خیر"}
        </p>
        {source.lastIndexedAt && (
          <p className="text-caption text-muted">
            نمایه‌سازی: {toPersianDate(source.lastIndexedAt)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-caption font-medium text-on-surface-variant">
            وضعیت بازبینی
          </span>
          <Select value={state} onChange={(e) => setState(e.target.value as RagReviewState)}>
            {REVIEW_STATES.map((s) => (
              <option key={s} value={s}>
                {RAG_REVIEW_STATE_FA[s]}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="mb-1 block text-caption font-medium text-on-surface-variant">
            امتیاز ارزیابی (۰ تا ۱)
          </span>
          <TextInput
            type="number"
            step="0.01"
            min={0}
            max={1}
            value={evalScore}
            onChange={(e) => setEvalScore(e.target.value)}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-body-2 text-on-surface-variant">
        <input
          type="checkbox"
          checked={publishToLibrary}
          onChange={(e) => setPublishToLibrary(e.target.checked)}
        />
        انتشار در کتابخانه عمومی
      </label>

      <label className="block">
        <span className="mb-1 block text-caption font-medium text-on-surface-variant">
          یادداشت بازبین
        </span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-medium border border-divider bg-surface px-3 py-2 text-body-2 text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </label>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          انصراف
        </Button>
        <Button variant="primary" onClick={onSave} loading={update.isPending}>
          ثبت بازبینی
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminRagPage() {
  const { can } = useAdminMe();
  const canManage = can("admin:rag:manage");
  const [tab, setTab] = useState<Tab>("pipeline");

  const tabs: TabItem<Tab>[] = [
    { value: "pipeline", label: "خط لوله و مدل‌ها", icon: <IconDatabase size={16} /> },
    { value: "sources", label: "منابع دانش", icon: <IconFileText size={16} /> },
    { value: "retrieval", label: "آزمون بازیابی", icon: <IconLinkSource size={16} /> },
  ];

  return (
    <div>
      <PageHeader
        title="مرکز دانش و پیکربندی هوش مصنوعی"
        description="وضعیت خط لولهٔ بازیابی، مدیریت منابع دانش و آزمون زندهٔ بازیابی — همه بر پایهٔ همان نمایهٔ مرجعی که موتور پاسخ استفاده می‌کند."
        actions={<ExportButton kind="rag-sources" label="خروجی منابع" />}
      />

      {!canManage && (
        <InfoBanner tone="warning">
          شما مجوز مدیریت منابع RAG را ندارید؛ عملیات تغییر در این صفحه غیرفعال است.
        </InfoBanner>
      )}

      <Tabs items={tabs} value={tab} onChange={setTab} ariaLabel="بخش‌های مرکز دانش" />

      {tab === "pipeline" && <PipelineSection canManage={canManage} />}
      {tab === "sources" && <SourcesSection canManage={canManage} />}
      {tab === "retrieval" && <RetrievalTester />}
    </div>
  );
}
