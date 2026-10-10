// ============================================================
// LEGALIR — Admin · Legal Library (کتابخانه لیگالیر)
// ============================================================
// The authoring surface for the INDEPENDENT legal-library section. It is
// deliberately NOT the blog: a separate store (`.data/legal-library.json`), a
// separate row model, a separate lifecycle, a separate permission pair
// (`admin:library:*`). Nothing here reads or writes `.data/blog.json`.
//
// Every control is real: list/search/filter → GET, create/edit → POST/PATCH,
// publish/unpublish/archive → PATCH status, delete → POST …/delete. All of them
// go to the ONE admin dispatcher, which re-checks the permission server-side,
// so hiding a button here is a UX affordance only — never the security border.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { Drawer, ConfirmDialog, snackbar } from "@legalir/ui";
import {
  useAdminLegalLibrary,
  useCreateLegalSource,
  useUpdateLegalSource,
  useSetLegalSourceStatus,
  useDeleteLegalSource,
  useAdminMe,
} from "@/hooks/useAdmin";
import { toPersianDate, toRelativeTime } from "@/lib/persian-utils";
import {
  LEGAL_SOURCE_STATUS_FA,
  type AdminLegalSource,
  type LegalContentType,
  type LegalSourceStatus,
} from "@legalir/types";
import {
  PageHeader,
  Card,
  StatCard,
  Section,
  DataTable,
  Th,
  Td,
  Badge,
  Button,
  Field,
  TextInput,
  TextArea,
  Select,
  SearchInput,
  FilterPills,
  StateView,
  InfoBanner,
} from "@/components/admin/ui";
import {
  IconEdit,
  IconDelete,
  IconAdd,
  IconCheckCircle,
  IconArchive,
  IconLibrary,
} from "@/lib/icons";

type Status = LegalSourceStatus;

const STATUS_TONE: Record<Status, "success" | "warning" | "neutral"> = {
  PUBLISHED: "success",
  DRAFT: "warning",
  ARCHIVED: "neutral",
};

/**
 * The content types an operator can author directly in the library. `BLOG_ARTICLE`
 * is intentionally EXCLUDED — the blog is a different section with its own
 * workflow; the library must not become a second blog authoring surface.
 */
const SOURCE_TYPE_OPTIONS: { value: LegalContentType; labelFa: string }[] = [
  { value: "LAW_ARTICLE", labelFa: "ماده قانونی" },
  { value: "REGULATION", labelFa: "آیین‌نامه" },
  { value: "UNIFICATION_RULING", labelFa: "رأی وحدت رویه" },
  { value: "JUDICIAL_DECISION", labelFa: "رأی قضایی" },
  { value: "LEGAL_GUIDE", labelFa: "راهنمای حقوقی" },
  { value: "HOW_TO", labelFa: "راهنمای عملی" },
  { value: "CHECKLIST", labelFa: "چک‌لیست" },
  { value: "FAQ", labelFa: "پرسش و پاسخ" },
  { value: "LEGAL_TOOL", labelFa: "ابزار حقوقی" },
  { value: "TEMPLATE_GUIDE", labelFa: "قالب و راهنما" },
  { value: "SOURCE", labelFa: "منبع" },
];

function sourceTypeLabel(t: LegalContentType): string {
  return SOURCE_TYPE_OPTIONS.find((o) => o.value === t)?.labelFa ?? t;
}

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

// ---------------------------------------------------------------------------
// Editor — a Drawer form for create + edit, with an in-place preview
// ---------------------------------------------------------------------------

interface EditorDraft {
  title: string;
  slug: string;
  sourceType: LegalContentType;
  topicSlug: string;
  authority: string;
  summary: string;
  body: string;
  readingTime: string;
  sourceUrl: string;
  officialSourceUrl: string;
  canonicalUrl: string;
  seoTitle: string;
  seoDescription: string;
  featured: boolean;
  popular: boolean;
  status: Status;
}

function toEditorDraft(source: AdminLegalSource | null): EditorDraft {
  return {
    title: source?.title ?? "",
    slug: source?.slug ?? "",
    sourceType: source?.sourceType ?? "LEGAL_GUIDE",
    topicSlug: source?.topicSlug ?? "",
    authority: source?.authority ?? "",
    summary: source?.summary ?? "",
    body: source?.body ?? "",
    readingTime: source ? String(source.readingTime) : "",
    sourceUrl: source?.sourceUrl ?? "",
    officialSourceUrl: source?.officialSourceUrl ?? "",
    canonicalUrl: source?.canonicalUrl ?? "",
    seoTitle: source?.seoTitle ?? "",
    seoDescription: source?.seoDescription ?? "",
    featured: source?.featured ?? false,
    popular: source?.popular ?? false,
    status: source?.status ?? "DRAFT",
  };
}

function SourceEditor({
  source,
  topics,
  onClose,
}: {
  /** null = create a new source. */
  source: AdminLegalSource | null;
  topics: { slug: string; titleFa: string }[];
  onClose: () => void;
}) {
  const isNew = source === null;
  const create = useCreateLegalSource();
  const update = useUpdateLegalSource();
  const setStatus = useSetLegalSourceStatus();
  const [form, setForm] = useState<EditorDraft>(() => toEditorDraft(source));
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const busy = create.isPending || update.isPending || setStatus.isPending;

  function patch<K extends keyof EditorDraft>(key: K, value: EditorDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toPayload() {
    return {
      title: form.title.trim(),
      // An explicit slug keeps the public URL stable; slugify runs server-side.
      slug: form.slug.trim() || null,
      sourceType: form.sourceType,
      topicSlug: form.topicSlug.trim() || null,
      authority: form.authority.trim() || null,
      summary: form.summary.trim() || null,
      body: form.body,
      readingTime: form.readingTime.trim() === "" ? null : Number(form.readingTime),
      sourceUrl: form.sourceUrl.trim() || null,
      officialSourceUrl: form.officialSourceUrl.trim() || null,
      canonicalUrl: form.canonicalUrl.trim() || null,
      seoTitle: form.seoTitle.trim() || null,
      seoDescription: form.seoDescription.trim() || null,
      featured: form.featured,
      popular: form.popular,
      status: form.status,
    };
  }

  function validate(): string | null {
    if (!form.title.trim()) return "عنوان منبع الزامی است.";
    if (!form.summary.trim()) return "خلاصه الزامی است.";
    return null;
  }

  async function onSave() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    try {
      if (isNew) {
        await create.mutateAsync(toPayload());
        snackbar.show({ message: "منبع ایجاد شد.", variant: "success" });
      } else {
        await update.mutateAsync({ id: source.id, input: toPayload() });
        snackbar.show({ message: "منبع ذخیره شد.", variant: "success" });
      }
      onClose();
    } catch (err) {
      snackbar.show({ message: errMessage(err, "ذخیرهٔ منبع ناموفق بود"), variant: "error" });
    }
  }

  async function onTogglePublish() {
    if (isNew) return;
    const next: Status = source.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    try {
      await setStatus.mutateAsync({ id: source.id, status: next });
      snackbar.show({
        message: next === "PUBLISHED" ? "منبع منتشر شد." : "انتشار منبع لغو شد.",
        variant: "success",
      });
      setForm((f) => ({ ...f, status: next }));
    } catch (err) {
      snackbar.show({ message: errMessage(err, "تغییر وضعیت ناموفق بود"), variant: "error" });
    }
  }

  if (preview) {
    return (
      <div className="space-y-4">
        <InfoBanner tone="info">
          این پیش‌نمایش دقیقاً همان چیزی است که پس از انتشار به‌صورت عمومی نمایش داده می‌شود.
        </InfoBanner>
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="brand">{sourceTypeLabel(form.sourceType)}</Badge>
            <Badge tone={STATUS_TONE[form.status]}>{LEGAL_SOURCE_STATUS_FA[form.status]}</Badge>
            {form.featured && <Badge tone="info">شاخص</Badge>}
          </div>
          <h2 className="text-title-medium font-bold text-on-surface">{form.title || "بدون عنوان"}</h2>
          {form.summary && (
            <p className="mt-2 text-body-2 text-on-surface-variant">{form.summary}</p>
          )}
          {form.authority && (
            <p className="mt-2 text-caption text-muted">مرجع: {form.authority}</p>
          )}
          {form.canonicalUrl && (
            <p className="mt-2 text-caption text-muted" dir="ltr">
              {form.canonicalUrl}
            </p>
          )}
          <div className="mt-4 whitespace-pre-wrap border-t border-divider pt-4 text-body-2 text-on-surface-variant">
            {form.body || "متنی برای این منبع ثبت نشده است."}
          </div>
        </Card>
        <div className="flex justify-end gap-2 border-t border-divider pt-4">
          <Button variant="ghost" onClick={() => setPreview(false)}>
            بازگشت به ویرایش
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field label="عنوان منبع" error={error ?? undefined}>
        <TextInput
          value={form.title}
          onChange={(e) => patch("title", e.target.value)}
          placeholder="مثلاً: شرایط فسخ قرارداد اجاره"
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
        <Field label="نشانی یکتا (slug)" hint="خالی بگذارید تا خودکار ساخته شود.">
          <TextInput
            value={form.slug}
            onChange={(e) => patch("slug", e.target.value)}
            placeholder="rent-termination"
            dir="ltr"
          />
        </Field>
        <Field label="نوع منبع">
          <Select
            value={form.sourceType}
            onChange={(e) => patch("sourceType", e.target.value as LegalContentType)}
          >
            {SOURCE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.labelFa}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
        <Field label="موضوع / دسته" hint="از موضوعات موجود کتابخانه انتخاب کنید.">
          <Select value={form.topicSlug} onChange={(e) => patch("topicSlug", e.target.value)}>
            <option value="">— بدون موضوع —</option>
            {topics.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.titleFa}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="مرجع / مرجع صادرکننده" hint="مثلاً: مجلس شورای اسلامی">
          <TextInput
            value={form.authority}
            onChange={(e) => patch("authority", e.target.value)}
            placeholder="LEGALIR"
          />
        </Field>
      </div>

      <Field
        label="خلاصه"
        hint="یک پاراگراف کوتاه که در فهرست و کارت کتابخانه نمایش داده می‌شود."
        error={error ?? undefined}
      >
        <TextArea rows={2} value={form.summary} onChange={(e) => patch("summary", e.target.value)} />
      </Field>

      <Field label="متن کامل" hint="قالب Markdown با تیترهای ## پشتیبانی می‌شود.">
        <TextArea
          rows={10}
          value={form.body}
          onChange={(e) => patch("body", e.target.value)}
          className="font-mono text-caption"
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
        <Field label="پیوند منبع" hint="نشانی مرجع اصلی (اختیاری) — در صفحهٔ جزئیات به‌صورت «مشاهده منبع» نمایش داده می‌شود.">
          <TextInput
            value={form.sourceUrl}
            onChange={(e) => patch("sourceUrl", e.target.value)}
            placeholder="https://…"
            dir="ltr"
          />
        </Field>
        <Field label="پیوند منبع رسمی" hint="نشانی مرجع رسمی/دولتی (اختیاری) — بر «پیوند منبع» اولویت دارد.">
          <TextInput
            value={form.officialSourceUrl}
            onChange={(e) => patch("officialSourceUrl", e.target.value)}
            placeholder="https://…"
            dir="ltr"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
        <Field label="نشانی کانونیکال" hint="برای جلوگیری از محتوای تکراری در موتورهای جستجو (اختیاری).">
          <TextInput
            value={form.canonicalUrl}
            onChange={(e) => patch("canonicalUrl", e.target.value)}
            placeholder="https://…"
            dir="ltr"
          />
        </Field>
        <Field label="زمان مطالعه (دقیقه)" hint="خالی بگذارید تا از متن محاسبه شود.">
          <TextInput
            type="number"
            min={1}
            value={form.readingTime}
            onChange={(e) => patch("readingTime", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
        <Field label="عنوان سئو (Meta title)">
          <TextInput value={form.seoTitle} onChange={(e) => patch("seoTitle", e.target.value)} />
        </Field>
        <Field label="توضیح سئو (Meta description)">
          <TextArea
            rows={2}
            value={form.seoDescription}
            onChange={(e) => patch("seoDescription", e.target.value)}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-body-2 text-on-surface-variant">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => patch("featured", e.target.checked)}
          />
          منبع شاخص
        </label>
        <label className="flex items-center gap-2 text-body-2 text-on-surface-variant">
          <input
            type="checkbox"
            checked={form.popular}
            onChange={(e) => patch("popular", e.target.checked)}
          />
          پربازدید
        </label>
        <label className="flex items-center gap-2 text-body-2 text-on-surface-variant">
          وضعیت
          <Select
            value={form.status}
            onChange={(e) => patch("status", e.target.value as Status)}
            className="w-40"
          >
            {(["DRAFT", "PUBLISHED", "ARCHIVED"] as Status[]).map((s) => (
              <option key={s} value={s}>
                {LEGAL_SOURCE_STATUS_FA[s]}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-divider pt-4">
        <Button variant="ghost" onClick={() => setPreview(true)}>
          پیش‌نمایش
        </Button>
        {!isNew && (
          <Button variant="ghost" onClick={onTogglePublish} loading={setStatus.isPending}>
            {source.status === "PUBLISHED" ? "لغو انتشار" : "انتشار"}
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          انصراف
        </Button>
        <Button variant="primary" onClick={onSave} loading={busy}>
          {isNew ? "ایجاد منبع" : "ذخیرهٔ تغییرات"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Library list — search + status filter + stats + table
// ---------------------------------------------------------------------------

function LibrarySection({ canManage }: { canManage: boolean }) {
  const query = useAdminLegalLibrary();
  const del = useDeleteLegalSource();
  const setStatus = useSetLegalSourceStatus();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | Status>("");
  const [editing, setEditing] = useState<AdminLegalSource | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<AdminLegalSource | null>(null);

  const items = query.data?.items ?? [];
  const topics = query.data?.topics ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        (s.authority?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, search, statusFilter]);

  const counts = useMemo(
    () => ({
      total: items.length,
      published: items.filter((s) => s.status === "PUBLISHED").length,
      draft: items.filter((s) => s.status === "DRAFT").length,
      archived: items.filter((s) => s.status === "ARCHIVED").length,
    }),
    [items]
  );

  const filters = [
    { value: "", label: "همه" },
    { value: "PUBLISHED", label: "منتشرشده" },
    { value: "DRAFT", label: "پیش‌نویس" },
    { value: "ARCHIVED", label: "بایگانی‌شده" },
  ];

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await del.mutateAsync(deleting.id);
      snackbar.show({ message: "منبع حذف شد.", variant: "success" });
      setDeleting(null);
    } catch (err) {
      snackbar.show({ message: errMessage(err, "حذف ناموفق بود"), variant: "error" });
    }
  }

  async function changeStatus(s: AdminLegalSource, status: Status, okMessage: string) {
    try {
      await setStatus.mutateAsync({ id: s.id, status });
      snackbar.show({ message: okMessage, variant: "success" });
    } catch (err) {
      snackbar.show({ message: errMessage(err, "تغییر وضعیت ناموفق بود"), variant: "error" });
    }
  }

  return (
    <div>
      {!canManage && (
        <InfoBanner tone="warning">
          شما مجوز مدیریت کتابخانه را ندارید؛ این فهرست فقط‌خواندنی است.
        </InfoBanner>
      )}

      {query.data && (
        <div className="mb-5 grid grid-cols-2 gap-3 tablet:grid-cols-4">
          <StatCard label="کل منابع" value={counts.total} icon={<IconLibrary size={18} />} />
          <StatCard
            label="منتشرشده"
            value={counts.published}
            tone="success"
            icon={<IconCheckCircle size={18} />}
          />
          <StatCard label="پیش‌نویس" value={counts.draft} tone="warning" />
          <StatCard label="بایگانی‌شده" value={counts.archived} icon={<IconArchive size={18} />} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="جستجو در عنوان، نشانی، خلاصه یا مرجع"
          className="min-w-[240px] flex-1"
        />
        <FilterPills
          options={filters}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as "" | Status)}
        />
        {canManage && (
          <Button
            variant="primary"
            size="sm"
            startIcon={<IconAdd size={15} />}
            onClick={() => setEditing(null)}
          >
            منبع جدید
          </Button>
        )}
      </div>

      <StateView
        query={query}
        loadingRows={6}
        isEmpty={() => filtered.length === 0}
        emptyMessage={
          items.length === 0
            ? "هنوز منبعی در کتابخانه ثبت نشده است."
            : "منبعی با این فیلتر یافت نشد."
        }
      >
        {() => (
          <DataTable
            head={
              <tr>
                <Th>عنوان</Th>
                <Th>نوع</Th>
                <Th>وضعیت</Th>
                <Th>انتشار</Th>
                <Th>به‌روزرسانی</Th>
                <Th>عملیات</Th>
              </tr>
            }
          >
            {filtered.map((s) => (
              <tr key={s.id}>
                <Td className="max-w-[320px]">
                  <div className="flex items-center gap-2">
                    <span className="block truncate font-medium text-on-surface" title={s.title}>
                      {s.title}
                    </span>
                    {s.featured && <Badge tone="info">شاخص</Badge>}
                  </div>
                  <span className="mt-0.5 block truncate text-caption text-muted" dir="ltr">
                    {s.slug}
                  </span>
                </Td>
                <Td className="text-caption text-muted">{sourceTypeLabel(s.sourceType)}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[s.status]}>{LEGAL_SOURCE_STATUS_FA[s.status]}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-caption text-muted">
                  {s.publishedAt ? toPersianDate(s.publishedAt) : "—"}
                </Td>
                <Td className="whitespace-nowrap text-caption text-muted">
                  {s.updatedAt ? `${toPersianDate(s.updatedAt)} · ${toRelativeTime(s.updatedAt)}` : "—"}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {canManage && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          startIcon={<IconEdit size={14} />}
                          onClick={() => setEditing(s)}
                        >
                          ویرایش
                        </Button>
                        {s.status !== "PUBLISHED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => changeStatus(s, "PUBLISHED", "منبع منتشر شد.")}
                            loading={setStatus.isPending && setStatus.variables?.id === s.id}
                          >
                            انتشار
                          </Button>
                        )}
                        {s.status === "PUBLISHED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => changeStatus(s, "DRAFT", "انتشار لغو شد.")}
                            loading={setStatus.isPending && setStatus.variables?.id === s.id}
                          >
                            لغو انتشار
                          </Button>
                        )}
                        {s.status !== "ARCHIVED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => changeStatus(s, "ARCHIVED", "منبع بایگانی شد.")}
                            loading={setStatus.isPending && setStatus.variables?.id === s.id}
                          >
                            بایگانی
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          startIcon={<IconDelete size={14} />}
                          onClick={() => setDeleting(s)}
                        >
                          حذف
                        </Button>
                      </>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </StateView>

      <Drawer
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        width={640}
        title={editing ? `ویرایش — ${editing.title}` : "منبع جدید کتابخانه"}
      >
        {editing !== undefined && (
          <SourceEditor
            source={editing}
            topics={topics.map((t) => ({ slug: t.slug, titleFa: t.titleFa }))}
            onClose={() => setEditing(undefined)}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="حذف منبع کتابخانه"
        description={
          deleting
            ? `منبع «${deleting.title}» حذف شود؟ این عمل بازگشت‌پذیر نیست.`
            : undefined
        }
        confirmLabel="حذف"
        destructive
        loading={del.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminLegalLibraryPage() {
  const { can } = useAdminMe();
  const canManage = can("admin:library:manage");

  return (
    <div>
      <PageHeader
        title="کتابخانه لیگالیر"
        description="منابع حقوقی را بنویسید، پیش‌نمایش بگیرید و منتشر کنید — روی همان مخزن مستقل کتابخانه که سایت عمومی می‌خواند (جدا از وبلاگ)."
      />

      <Section
        title="منابع کتابخانه"
        subtitle="پیش‌نویس‌ها و منابع بایگانی‌شده هرگز برای کاربران عمومی نمایش داده نمی‌شوند."
      >
        <LibrarySection canManage={canManage} />
      </Section>
    </div>
  );
}
