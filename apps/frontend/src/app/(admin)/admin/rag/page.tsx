// ============================================================
// LEGALIR — Admin · Legal Resources & RAG (منابع حقوقی و RAG)
// ============================================================
// The review-and-publish surface for the retrieval corpus. Each source has a
// review state (ingested → … → published). Moving a source to "published"
// makes it reachable by retrieval AND optionally visible in the public
// library; retiring it removes it from retrieval. Every transition is
// permission-gated (`admin:rag:manage`) and audited server-side.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { useRagSources, useUpdateRagReview, useAdminMe } from "@/hooks/useAdmin";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import { RAG_REVIEW_STATE_FA } from "@legalir/types";
import type { RagReviewState, RagSource } from "@legalir/types";
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
} from "@/components/admin/ui";

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

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

function ReviewPanel({ source, onClose }: { source: RagSource; onClose: () => void }) {
  const update = useUpdateRagReview();
  const [state, setState] = useState<RagReviewState>(source.reviewState);
  const [publishToLibrary, setPublishToLibrary] = useState(source.publishedInLibrary);
  const [notes, setNotes] = useState(source.notes ?? "");
  const [evalScore, setEvalScore] = useState<string>(
    source.evalScore === null ? "" : String(source.evalScore)
  );
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function onSave() {
    setFeedback(null);
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
      setFeedback({ tone: "success", text: "بازبینی ثبت شد." });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "ثبت بازبینی ناموفق بود") });
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-h3 font-bold text-onSurface">{source.title}</h3>
        <Button size="sm" variant="ghost" onClick={onClose}>
          بستن
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 tablet:grid-cols-4">
        <div className="rounded-medium border border-divider p-3">
          <p className="text-caption text-muted">نوع منبع</p>
          <p className="text-body-2">{source.sourceTypeFa}</p>
        </div>
        <div className="rounded-medium border border-divider p-3">
          <p className="text-caption text-muted">مرجع</p>
          <p className="text-body-2">{source.authority}</p>
        </div>
        <div className="rounded-medium border border-divider p-3">
          <p className="text-caption text-muted">شماره/تاریخ سند</p>
          <p className="text-body-2" dir="ltr">
            {source.docNumber ?? "—"} {source.docDate ? `· ${source.docDate}` : ""}
          </p>
        </div>
        <div className="rounded-medium border border-divider p-3">
          <p className="text-caption text-muted">تعداد قطعه (chunk)</p>
          <p className="tabular-nums">{toPersianNumber(source.chunkCount)}</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-caption text-muted">
        <span>
          اعتبار: {source.validFrom ?? "—"} تا {source.validTo ?? "کنون"}
        </span>
        <span>·</span>
        <span>فعال در بازیابی: {source.activeInRetrieval ? "بله" : "خیر"}</span>
        {source.lastIndexedAt && <span>· نمایه‌سازی: {toPersianDate(source.lastIndexedAt)}</span>}
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

      <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
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
        <div className="col-span-2 flex items-end">
          <label className="flex items-center gap-2 text-body-2 text-on-surface-variant">
            <input
              type="checkbox"
              checked={publishToLibrary}
              onChange={(e) => setPublishToLibrary(e.target.checked)}
            />
            انتشار در کتابخانه عمومی
          </label>
        </div>
      </div>

      <div className="mt-3">
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
      </div>

      <div className="mt-3">
        <Button variant="primary" onClick={onSave} disabled={update.isPending}>
          ثبت بازبینی
        </Button>
      </div>
    </Card>
  );
}

export default function AdminRagPage() {
  const { can } = useAdminMe();
  const canManage = can("admin:rag:manage");

  const [state, setState] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RagSource | null>(null);

  const query = useRagSources({
    reviewState: (state || undefined) as RagReviewState | undefined,
    search: search || undefined,
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
      <PageHeader
        title="منابع حقوقی و RAG"
        description="بازبینی، تأیید و انتشار منابع بازیابی. انتشار یک منبع آن را برای موتور بازیابی فعال می‌کند."
      />

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
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجو در عنوان یا مرجع"
          className="min-w-[240px] flex-1"
        />
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
                {canManage && <Th>بازبینی</Th>}
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
                {canManage && (
                  <Td>
                    <Button size="sm" variant="secondary" onClick={() => setSelected(s)}>
                      بازبینی
                    </Button>
                  </Td>
                )}
              </tr>
            ))}
          </DataTable>
        )}
      </StateView>

      {selected && (
        <div className="mt-5">
          <ReviewPanel source={selected} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
