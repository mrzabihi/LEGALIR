// ============================================================
// LEGALIR — Admin · Content & Notifications (محتوا و اطلاع‌رسانی)
// ============================================================
// Three real surfaces, all backed by the ONE store the public site reads:
//   • مقالات (posts)     — full authoring: create / edit / publish / unpublish
//     / delete. Writes go to `.data/blog.json`, the SAME file the public blog
//     API serves, so a published post appears publicly with no extra step.
//   • تولید با AI (AI)   — generate a legal-article draft from the configured
//     provider (honestly reporting the mock). A generated draft is ALWAYS a
//     DRAFT; the operator must publish it intentionally — never auto-published.
//   • اطلاع‌رسانی (notices) — platform announcements, delivered through the
//     SAME derived notification feed users already have (category "public").
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { Drawer, ConfirmDialog, snackbar } from "@legalir/ui";
import {
  useAdminBlog,
  useCreateBlogPost,
  useUpdateBlogPost,
  useSetBlogPostStatus,
  useDeleteBlogPost,
  useGenerateBlogDraft,
  useAdminMe,
} from "@/hooks/useAdmin";
import { toPersianNumber, toPersianDate, toRelativeTime } from "@/lib/persian-utils";
import { BLOG_POST_STATUS_FA, type AdminBlogPost, type GeneratedBlogDraft } from "@legalir/types";
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
  EmptyBlock,
  LoadingBlock,
  InfoBanner,
  ExportButton,
  Tabs,
  type TabItem,
} from "@/components/admin/ui";
import { AnnouncementPanel } from "@/components/admin/announcement-panel";
import {
  IconEdit,
  IconDelete,
  IconAdd,
  IconBolt,
  IconCheckCircle,
  IconDocument,
  IconBell,
} from "@/lib/icons";

type Status = AdminBlogPost["status"];

const STATUS_TONE: Record<Status, "success" | "info" | "warning"> = {
  PUBLISHED: "success",
  SCHEDULED: "info",
  DRAFT: "warning",
};

type Tab = "posts" | "generate" | "announcements";

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

// ---------------------------------------------------------------------------
// Post editor — a Drawer form for create + edit
// ---------------------------------------------------------------------------

interface EditorDraft {
  titleFa: string;
  slug: string;
  excerpt: string;
  body: string;
  category: string;
  author: string;
  tags: string;
  readingTime: string;
  seoTitle: string;
  seoDescription: string;
  featured: boolean;
  status: Status;
}

function toEditorDraft(post: AdminBlogPost | null): EditorDraft {
  return {
    titleFa: post?.titleFa ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    body: post?.body ?? "",
    category: post?.category ?? "",
    author: post?.author ?? "",
    tags: (post?.tags ?? []).join("، "),
    readingTime: post ? String(post.readingTime) : "",
    seoTitle: post?.seoTitle ?? "",
    seoDescription: post?.seoDescription ?? "",
    featured: post?.featured ?? false,
    status: post?.status ?? "DRAFT",
  };
}

function PostEditor({
  post,
  categories,
  onClose,
}: {
  /** null = create a new post. */
  post: AdminBlogPost | null;
  categories: { id: string; titleFa: string }[];
  onClose: () => void;
}) {
  const isNew = post === null;
  const create = useCreateBlogPost();
  const update = useUpdateBlogPost();
  const setStatus = useSetBlogPostStatus();
  const [form, setForm] = useState<EditorDraft>(() => toEditorDraft(post));
  const [error, setError] = useState<string | null>(null);

  const busy = create.isPending || update.isPending || setStatus.isPending;

  function patch<K extends keyof EditorDraft>(key: K, value: EditorDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSave() {
    if (!form.titleFa.trim()) {
      setError("عنوان مقاله الزامی است.");
      return;
    }
    setError(null);
    const payload = {
      titleFa: form.titleFa.trim(),
      // An explicit slug keeps the public URL stable; slugify runs server-side.
      slug: form.slug.trim() || null,
      excerpt: form.excerpt.trim() || null,
      body: form.body,
      category: form.category.trim() || null,
      author: form.author.trim() || null,
      tags: form.tags
        .split(/[،,]/)
        .map((t) => t.trim())
        .filter(Boolean),
      readingTime: form.readingTime.trim() === "" ? null : Number(form.readingTime),
      seoTitle: form.seoTitle.trim() || null,
      seoDescription: form.seoDescription.trim() || null,
      featured: form.featured,
      status: form.status,
    };
    try {
      if (isNew) {
        await create.mutateAsync(payload);
        snackbar.show({ message: "مقاله ایجاد شد.", variant: "success" });
      } else {
        await update.mutateAsync({ id: post.id, input: payload });
        snackbar.show({ message: "مقاله ذخیره شد.", variant: "success" });
      }
      onClose();
    } catch (err) {
      snackbar.show({ message: errMessage(err, "ذخیرهٔ مقاله ناموفق بود"), variant: "error" });
    }
  }

  async function onTogglePublish() {
    if (isNew) return;
    const next: Status = post.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    try {
      await setStatus.mutateAsync({ id: post.id, status: next });
      snackbar.show({
        message: next === "PUBLISHED" ? "مقاله منتشر شد." : "انتشار مقاله لغو شد.",
        variant: "success",
      });
      setForm((f) => ({ ...f, status: next }));
    } catch (err) {
      snackbar.show({ message: errMessage(err, "تغییر وضعیت ناموفق بود"), variant: "error" });
    }
  }

  return (
    <div className="space-y-4">
      <Field label="عنوان مقاله" error={error ?? undefined}>
        <TextInput
          value={form.titleFa}
          onChange={(e) => patch("titleFa", e.target.value)}
          placeholder="مثلاً: شرایط فسخ قرارداد اجاره"
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
        <Field label="نشانی (slug)" hint="خالی بگذارید تا خودکار ساخته شود.">
          <TextInput
            value={form.slug}
            onChange={(e) => patch("slug", e.target.value)}
            placeholder="rent-termination"
            dir="ltr"
          />
        </Field>
        <Field label="دسته‌بندی">
          <TextInput
            value={form.category}
            onChange={(e) => patch("category", e.target.value)}
            list="blog-categories"
            placeholder="مثلاً: حقوق قراردادها"
          />
          <datalist id="blog-categories">
            {categories.map((c) => (
              <option key={c.id} value={c.titleFa} />
            ))}
          </datalist>
        </Field>
      </div>

      <Field label="نویسنده">
        <TextInput
          value={form.author}
          onChange={(e) => patch("author", e.target.value)}
          placeholder="تیم تحریریه لیگال‌آیر"
        />
      </Field>

      <Field label="خلاصه" hint="یک پاراگراف کوتاه که در فهرست و کارت مقاله نمایش داده می‌شود.">
        <TextArea
          rows={2}
          value={form.excerpt}
          onChange={(e) => patch("excerpt", e.target.value)}
        />
      </Field>

      <Field label="متن مقاله" hint="قالب Markdown با تیترهای ## پشتیبانی می‌شود.">
        <TextArea
          rows={10}
          value={form.body}
          onChange={(e) => patch("body", e.target.value)}
          className="font-mono text-caption"
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
        <Field label="برچسب‌ها" hint="با ویرگول جدا کنید.">
          <TextInput value={form.tags} onChange={(e) => patch("tags", e.target.value)} />
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
          مقالهٔ شاخص
        </label>
        <label className="flex items-center gap-2 text-body-2 text-on-surface-variant">
          وضعیت
          <Select
            value={form.status}
            onChange={(e) => patch("status", e.target.value as Status)}
            className="w-40"
          >
            {(["DRAFT", "PUBLISHED", "SCHEDULED"] as Status[]).map((s) => (
              <option key={s} value={s}>
                {BLOG_POST_STATUS_FA[s]}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-divider pt-4">
        {!isNew && (
          <Button variant="ghost" onClick={onTogglePublish} loading={setStatus.isPending}>
            {post.status === "PUBLISHED" ? "لغو انتشار" : "انتشار"}
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          انصراف
        </Button>
        <Button variant="primary" onClick={onSave} loading={busy}>
          {isNew ? "ایجاد مقاله" : "ذخیرهٔ تغییرات"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Posts tab — the authoring list
// ---------------------------------------------------------------------------

function PostsSection({ canManage }: { canManage: boolean }) {
  const query = useAdminBlog();
  const del = useDeleteBlogPost();
  const setStatus = useSetBlogPostStatus();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | Status>("");
  const [editing, setEditing] = useState<AdminBlogPost | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<AdminBlogPost | null>(null);

  const items = query.data?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.titleFa.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [items, search, statusFilter]);

  const counts = useMemo(
    () => ({
      total: items.length,
      published: items.filter((p) => p.status === "PUBLISHED").length,
      draft: items.filter((p) => p.status === "DRAFT").length,
    }),
    [items]
  );

  const filters = [
    { value: "", label: "همه" },
    { value: "PUBLISHED", label: "منتشرشده" },
    { value: "DRAFT", label: "پیش‌نویس" },
    { value: "SCHEDULED", label: "زمان‌بندی‌شده" },
  ];

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await del.mutateAsync(deleting.id);
      snackbar.show({ message: "مقاله حذف شد.", variant: "success" });
      setDeleting(null);
    } catch (err) {
      snackbar.show({ message: errMessage(err, "حذف ناموفق بود"), variant: "error" });
    }
  }

  async function togglePublish(p: AdminBlogPost) {
    const next: Status = p.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    try {
      await setStatus.mutateAsync({ id: p.id, status: next });
      snackbar.show({
        message: next === "PUBLISHED" ? "مقاله منتشر شد." : "انتشار لغو شد.",
        variant: "success",
      });
    } catch (err) {
      snackbar.show({ message: errMessage(err, "تغییر وضعیت ناموفق بود"), variant: "error" });
    }
  }

  return (
    <div>
      {!canManage && (
        <InfoBanner tone="warning">
          شما مجوز مدیریت محتوا را ندارید؛ این فهرست فقط‌خواندنی است.
        </InfoBanner>
      )}

      {query.data && (
        <div className="mb-5 grid grid-cols-2 gap-3 tablet:grid-cols-3">
          <StatCard label="کل مقاله‌ها" value={counts.total} icon={<IconDocument size={18} />} />
          <StatCard
            label="منتشرشده"
            value={counts.published}
            tone="success"
            icon={<IconCheckCircle size={18} />}
          />
          <StatCard label="پیش‌نویس" value={counts.draft} tone="warning" />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="جستجو در عنوان، نشانی یا دسته"
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
            مقالهٔ جدید
          </Button>
        )}
      </div>

      <StateView
        query={query}
        loadingRows={6}
        isEmpty={() => filtered.length === 0}
        emptyMessage={
          items.length === 0 ? "هنوز مقاله‌ای ثبت نشده است." : "مقاله‌ای با این فیلتر یافت نشد."
        }
      >
        {() => (
          <DataTable
            head={
              <tr>
                <Th>عنوان</Th>
                <Th>نشانی (slug)</Th>
                <Th>دسته</Th>
                <Th>وضعیت</Th>
                <Th>به‌روزرسانی</Th>
                <Th>عملیات</Th>
              </tr>
            }
          >
            {filtered.map((p) => (
              <tr key={p.id}>
                <Td className="max-w-[320px]">
                  <div className="flex items-center gap-2">
                    <span className="block truncate font-medium text-on-surface" title={p.titleFa}>
                      {p.titleFa}
                    </span>
                    {p.aiAssisted && <Badge tone="brand">AI</Badge>}
                    {p.featured && <Badge tone="info">شاخص</Badge>}
                  </div>
                </Td>
                <Td dir="ltr" className="text-caption text-muted">
                  {p.slug}
                </Td>
                <Td className="text-caption text-muted">{p.category || "—"}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[p.status]}>{BLOG_POST_STATUS_FA[p.status]}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-caption text-muted">
                  {p.updatedAt
                    ? `${toPersianDate(p.updatedAt)} · ${toRelativeTime(p.updatedAt)}`
                    : "—"}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {canManage && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          startIcon={<IconEdit size={14} />}
                          onClick={() => setEditing(p)}
                        >
                          ویرایش
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => togglePublish(p)}
                          loading={setStatus.isPending && setStatus.variables?.id === p.id}
                        >
                          {p.status === "PUBLISHED" ? "لغو انتشار" : "انتشار"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          startIcon={<IconDelete size={14} />}
                          onClick={() => setDeleting(p)}
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
        width={620}
        title={editing ? `ویرایش — ${editing.titleFa}` : "مقالهٔ جدید"}
      >
        {editing !== undefined && (
          <PostEditor
            post={editing}
            categories={query.data?.categories ?? []}
            onClose={() => setEditing(undefined)}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="حذف مقاله"
        description={
          deleting ? `مقالهٔ «${deleting.titleFa}» حذف شود؟ این عمل بازگشت‌پذیر نیست.` : undefined
        }
        confirmLabel="حذف"
        destructive
        loading={del.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI generation tab — always a draft
// ---------------------------------------------------------------------------

function GenerateSection({ canManage }: { canManage: boolean }) {
  const generate = useGenerateBlogDraft();
  const create = useCreateBlogPost();
  const [topic, setTopic] = useState("");
  const [titleHint, setTitleHint] = useState("");
  const [category, setCategory] = useState("");
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState("");
  const [result, setResult] = useState<GeneratedBlogDraft | null>(null);
  const [saved, setSaved] = useState(false);

  async function onGenerate(save: boolean) {
    if (!topic.trim()) {
      snackbar.show({ message: "موضوع مقاله را وارد کنید.", variant: "error" });
      return;
    }
    setResult(null);
    setSaved(false);
    try {
      const res = await generate.mutateAsync({
        topic: topic.trim(),
        titleHint: titleHint.trim() || null,
        category: category.trim() || null,
        keywords: keywords
          .split(/[،,]/)
          .map((k) => k.trim())
          .filter(Boolean),
        tone: tone.trim() || null,
        save,
      });
      setResult(res);
      if (res.savedPostId) setSaved(true);
      snackbar.show({
        message: save ? "پیش‌نویس تولید و ذخیره شد." : "پیش‌نویس تولید شد.",
        variant: "success",
      });
    } catch (err) {
      snackbar.show({ message: errMessage(err, "تولید محتوا ناموفق بود"), variant: "error" });
    }
  }

  async function onSaveDraft() {
    if (!result) return;
    try {
      const created = await create.mutateAsync({
        titleFa: result.titleFa,
        slug: result.slug,
        excerpt: result.excerpt,
        body: result.body,
        category: result.category || null,
        tags: result.tags,
        readingTime: result.readingTime,
        seoTitle: result.metaTitle,
        seoDescription: result.metaDescription,
        status: "DRAFT",
        author: "دستیار هوش مصنوعی",
        aiAssisted: true,
      });
      setSaved(true);
      snackbar.show({ message: `پیش‌نویس «${created.titleFa}» ذخیره شد.`, variant: "success" });
    } catch (err) {
      snackbar.show({ message: errMessage(err, "ذخیرهٔ پیش‌نویس ناموفق بود"), variant: "error" });
    }
  }

  return (
    <div className="space-y-6">
      <InfoBanner tone="info">
        محتوای تولیدشدهٔ هوش مصنوعی هرگز خودکار منتشر نمی‌شود: ابتدا به‌صورت پیش‌نویس ذخیره می‌شود و
        انتشار آن تصمیم صریح شماست.
      </InfoBanner>

      <Section
        title="تولید پیش‌نویس مقاله"
        subtitle="موضوع و راهنماها را بدهید تا از ارائه‌دهندهٔ پیکربندی‌شده یک پیش‌نویس بگیرید."
      >
        <div className="space-y-4">
          <Field label="موضوع مقاله">
            <TextInput
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="مثلاً: مسئولیت کارفرما در قرارداد پیمانکاری"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
            <Field label="عنوان پیشنهادی (اختیاری)">
              <TextInput value={titleHint} onChange={(e) => setTitleHint(e.target.value)} />
            </Field>
            <Field label="دسته‌بندی (اختیاری)">
              <TextInput value={category} onChange={(e) => setCategory(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
            <Field label="واژگان کلیدی (اختیاری)" hint="با ویرگول جدا کنید.">
              <TextInput value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            </Field>
            <Field label="لحن (اختیاری)">
              <TextInput
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="مثلاً: رسمی، آموزشی"
              />
            </Field>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              startIcon={<IconBolt size={15} />}
              loading={generate.isPending}
              disabled={!canManage}
              onClick={() => onGenerate(false)}
            >
              تولید و پیش‌نمایش
            </Button>
            <Button
              variant="primary"
              startIcon={<IconAdd size={15} />}
              loading={generate.isPending}
              disabled={!canManage}
              onClick={() => onGenerate(true)}
            >
              تولید و ذخیره به‌عنوان پیش‌نویس
            </Button>
          </div>
          {!canManage && (
            <p className="text-caption text-muted">برای تولید محتوا به مجوز مدیریت محتوا نیاز دارید.</p>
          )}
        </div>
      </Section>

      {generate.isPending ? (
        <LoadingBlock rows={5} />
      ) : result ? (
        <Section
          title="پیش‌نمایش پیش‌نویس"
          subtitle="بازبینی و ویرایش پیش‌نویس در تب «مقالات» انجام می‌شود."
          actions={
            saved ? (
              <Badge tone="success">ذخیره‌شده به‌عنوان پیش‌نویس</Badge>
            ) : (
              <Button variant="primary" size="sm" loading={create.isPending} onClick={onSaveDraft}>
                ذخیره به‌عنوان پیش‌نویس
              </Button>
            )
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {result.mock ? (
              <Badge tone="warning">خروجی آزمایشی (بدون ارائه‌دهندهٔ واقعی)</Badge>
            ) : (
              <Badge tone="success">ارائه‌دهندهٔ واقعی</Badge>
            )}
            <Badge tone="neutral">{result.provider}</Badge>
            <span className="text-caption text-muted" dir="ltr">
              {result.model}
            </span>
            <span className="text-caption text-muted">
              {toPersianNumber(result.totalTokens)} توکن
              {result.estimatedTokens ? " (تخمینی)" : ""}
            </span>
          </div>

          <Card className="p-4">
            <h3 className="text-title-small font-bold text-on-surface">{result.titleFa}</h3>
            {result.excerpt && (
              <p className="mt-2 text-body-2 text-on-surface-variant">{result.excerpt}</p>
            )}
            {result.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.tags.map((t) => (
                  <Badge key={t} tone="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
            <div className="mt-4 whitespace-pre-wrap border-t border-divider pt-4 text-body-2 text-on-surface-variant">
              {result.body}
            </div>
          </Card>
        </Section>
      ) : (
        <Card className="p-6">
          <EmptyBlock
            message="پیش‌نویسی تولید نشده است."
            hint="موضوع را وارد کرده و یکی از دکمه‌های تولید را بزنید."
          />
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminContentPage() {
  const { can } = useAdminMe();
  const canManage = can("admin:content:manage");
  const [tab, setTab] = useState<Tab>("posts");

  const tabs: TabItem<Tab>[] = [
    { value: "posts", label: "مقالات", icon: <IconDocument size={16} /> },
    { value: "generate", label: "تولید با هوش مصنوعی", icon: <IconBolt size={16} /> },
    { value: "announcements", label: "اطلاع‌رسانی", icon: <IconBell size={16} /> },
  ];

  return (
    <div>
      <PageHeader
        title="محتوا و اطلاع‌رسانی"
        description="نوشتن و انتشار مقالات وبلاگ، تولید پیش‌نویس با هوش مصنوعی، و اطلاعیه‌های پلتفرم — همه روی همان مخزنی که سایت عمومی می‌خواند."
        actions={<ExportButton kind="blog" label="خروجی مقالات" />}
      />

      <Tabs items={tabs} value={tab} onChange={setTab} ariaLabel="بخش‌های محتوا و اطلاع‌رسانی" />

      {tab === "posts" && <PostsSection canManage={canManage} />}
      {tab === "generate" && <GenerateSection canManage={canManage} />}
      {tab === "announcements" && (
        <Section
          title="اطلاع‌رسانی و اعلان‌ها"
          subtitle="اطلاعیه‌های منتشرشده از طریق مرکز اعلان کاربران (زنگ اعلان) تحویل داده می‌شوند."
        >
          <AnnouncementPanel />
        </Section>
      )}
    </div>
  );
}
