// ============================================================
// LEGALIR — Admin blog authoring + AI content generation (server-only)
// ============================================================
// Owns the write-side of `.data/blog.json` — the SAME store the public site
// reads (see lib/legal-library-db). The admin mutates it in place: there is no
// parallel blog store.
//
// Invariants:
//   • publishing stamps `publishedAt`; moving back to draft/scheduled clears it
//     so the public list (which only shows published posts) drops the post;
//   • AI-generated posts are ALWAYS saved as drafts unless the operator
//     explicitly passes a publishing status — never auto-published;
//   • slugs are unique across list items and details.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import type {
  AdminBlogCategory,
  AdminBlogPost,
  BlogCategory,
  GeneratedBlogDraft,
  GenerateBlogDraftInput,
  UpsertBlogPostInput,
  V1BlogListItem,
  V1BlogPostDetail,
} from "@legalir/types";
import { generateContentText } from "@/lib/ai/content";

/**
 * The blog lifecycle as declared on the admin row. Derived from the row type
 * itself because the barrel `@legalir/types` re-exports a DIFFERENT, wider
 * `BlogPostStatus` (the public BlogPost one) — deriving avoids the collision.
 */
type BlogStatus = AdminBlogPost["status"];

const DATA_DIR = path.resolve(process.cwd(), ".data");
const BLOG_FILE = "blog.json";

/**
 * A stored detail row — the public shape plus admin-only extras. Older
 * fixtures have neither `status` nor `createdBy`, hence both are optional and
 * derived/back-filled on read.
 */
type StoredDetail = V1BlogPostDetail & {
  status?: BlogStatus;
  aiAssisted?: boolean;
  createdBy?: string | null;
  createdAt?: string;
};

interface BlogTable {
  items: V1BlogListItem[];
  details: Record<string, StoredDetail>;
  categories: BlogCategory[];
}

function readBlogTable(): BlogTable {
  const file = path.join(DATA_DIR, BLOG_FILE);
  if (!fs.existsSync(file)) {
    return { items: [], details: {}, categories: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as Partial<BlogTable>;
    return {
      items: parsed.items ?? [],
      details: parsed.details ?? {},
      categories: parsed.categories ?? [],
    };
  } catch {
    return { items: [], details: {}, categories: [] };
  }
}

function writeBlogTable(table: BlogTable): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, BLOG_FILE), JSON.stringify(table, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------

/**
 * The stored status field when present; otherwise derived from `publishedAt`
 * so the pre-existing fixture posts (which have no status field) read as
 * PUBLISHED, and any post whose `publishedAt` is empty reads as DRAFT.
 */
function statusOf(item: V1BlogListItem, detail: StoredDetail | undefined): BlogStatus {
  if (detail?.status) return detail.status;
  return item.publishedAt ? "PUBLISHED" : "DRAFT";
}

function toAdminPost(item: V1BlogListItem, detail: StoredDetail | undefined): AdminBlogPost {
  return {
    id: item.id,
    slug: item.slug,
    titleFa: item.titleFa,
    excerpt: item.excerpt,
    body: detail?.body ?? "",
    coverImage: item.coverImage,
    author: item.author,
    category: item.category,
    tags: item.tags,
    readingTime: item.readingTime,
    status: statusOf(item, detail),
    publishedAt: item.publishedAt || null,
    featured: item.featured,
    seoTitle: detail?.seoTitle ?? null,
    seoDescription: detail?.seoDescription ?? null,
    canonicalUrl: detail?.canonicalUrl ?? null,
    aiAssisted: Boolean(detail?.aiAssisted),
    createdBy: detail?.createdBy ?? null,
    createdAt: detail?.createdAt ?? item.publishedAt ?? "",
    updatedAt: detail?.updatedAt ?? item.publishedAt ?? "",
  };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export function listAdminBlogPosts(): AdminBlogPost[] {
  const { items, details } = readBlogTable();
  return items
    .map((item) => toAdminPost(item, details[item.slug]))
    .sort((a, b) =>
      (b.updatedAt || b.publishedAt || "").localeCompare(a.updatedAt || a.publishedAt || "")
    );
}

export function getAdminBlogPost(id: string): AdminBlogPost | undefined {
  const { items, details } = readBlogTable();
  const item = items.find((i) => i.id === id);
  if (!item) return undefined;
  return toAdminPost(item, details[item.slug]);
}

export function listBlogCategories(): AdminBlogCategory[] {
  return readBlogTable().categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    titleFa: c.titleFa,
    description: c.description ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function uniqueSlug(base: string, table: BlogTable, exceptSlug?: string): string {
  const slugBase = base || `blog-${crypto.randomUUID().slice(0, 8)}`;
  const taken = (s: string) =>
    (s !== exceptSlug && table.items.some((i) => i.slug === s)) ||
    (s !== exceptSlug && Boolean(table.details[s]));
  if (!taken(slugBase)) return slugBase;
  let n = 2;
  while (taken(`${slugBase}-${n}`)) n += 1;
  return `${slugBase}-${n}`;
}

function estimateReadingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// ---------------------------------------------------------------------------
// Write — create / update
// ---------------------------------------------------------------------------

export function upsertBlogPost(
  input: UpsertBlogPostInput,
  actorId?: string
): AdminBlogPost | { error: string } {
  const titleFa = (input.titleFa ?? "").trim();
  if (!titleFa) return { error: "BLOG_TITLE_REQUIRED" };

  const table = readBlogTable();
  const now = new Date().toISOString();

  const idx = input.id ? table.items.findIndex((i) => i.id === input.id) : -1;
  const existing = idx >= 0 ? table.items[idx]! : undefined;
  const existingDetail = existing ? table.details[existing.slug] : undefined;
  // A new post defaults to DRAFT; an edit that omits a status keeps the one the
  // post already had (so an edit can never silently unpublish a live post).
  const status: BlogStatus =
    input.status ?? (existing ? statusOf(existing, existingDetail) : "DRAFT");

  const slug = uniqueSlug(
    slugify(input.slug?.trim() || "") || slugify(titleFa) || existing?.slug || "",
    table,
    existing?.slug
  );

  const body = input.body ?? existingDetail?.body ?? "";
  const readingTime =
    input.readingTime ?? (body ? estimateReadingTime(body) : existing?.readingTime ?? 1);

  // Publishing stamps `publishedAt` (idempotent); any other status clears it so
  // the public list drops the post.
  const publishedAt = status === "PUBLISHED" ? existing?.publishedAt || now : "";

  const item: V1BlogListItem = {
    id: existing?.id ?? `blog-${crypto.randomUUID()}`,
    slug,
    titleFa,
    excerpt: input.excerpt ?? existing?.excerpt ?? "",
    coverImage: input.coverImage ?? existing?.coverImage ?? null,
    author: input.author?.trim() || existing?.author || "تیم تحریریه لیگال‌آیر",
    category: input.category?.trim() || existing?.category || "",
    tags: input.tags ?? existing?.tags ?? [],
    readingTime,
    publishedAt,
    featured: input.featured ?? existing?.featured ?? false,
  };

  const detail: StoredDetail = {
    id: item.id,
    slug,
    titleFa: item.titleFa,
    excerpt: item.excerpt,
    body,
    coverImage: item.coverImage,
    author: item.author,
    category: item.category,
    tags: item.tags,
    readingTime: item.readingTime,
    publishedAt,
    updatedAt: now,
    seoTitle: input.seoTitle ?? existingDetail?.seoTitle ?? null,
    seoDescription: input.seoDescription ?? existingDetail?.seoDescription ?? null,
    canonicalUrl: existingDetail?.canonicalUrl ?? null,
    relatedSources: existingDetail?.relatedSources ?? [],
    relatedGuides: existingDetail?.relatedGuides ?? [],
    relatedServices: existingDetail?.relatedServices ?? [],
    previousPost: existingDetail?.previousPost ?? null,
    nextPost: existingDetail?.nextPost ?? null,
    status,
    aiAssisted: input.aiAssisted ?? existingDetail?.aiAssisted ?? false,
    createdBy: existingDetail?.createdBy ?? actorId ?? null,
    createdAt: existingDetail?.createdAt ?? now,
  };

  // If the slug changed, drop the stale detail key.
  if (existing && existing.slug !== slug) Reflect.deleteProperty(table.details, existing.slug);
  if (idx >= 0) table.items[idx] = item;
  else table.items.unshift(item);
  table.details[slug] = detail;

  writeBlogTable(table);
  return getAdminBlogPost(item.id)!;
}

export function setBlogStatus(
  id: string,
  status: BlogStatus
): AdminBlogPost | { error: string } {
  const table = readBlogTable();
  const item = table.items.find((i) => i.id === id);
  if (!item) return { error: "NOT_FOUND" };
  const detail = table.details[item.slug];
  const now = new Date().toISOString();

  if (status === "PUBLISHED" && !item.publishedAt) item.publishedAt = now;
  if (status !== "PUBLISHED") item.publishedAt = "";
  if (detail) {
    detail.status = status;
    detail.updatedAt = now;
    detail.publishedAt = item.publishedAt;
  }
  writeBlogTable(table);
  return getAdminBlogPost(id)!;
}

export function deleteBlogPost(id: string): { ok: true } | { error: string } {
  const table = readBlogTable();
  const idx = table.items.findIndex((i) => i.id === id);
  if (idx === -1) return { error: "NOT_FOUND" };
  const slug = table.items[idx]!.slug;
  table.items.splice(idx, 1);
  Reflect.deleteProperty(table.details, slug);
  writeBlogTable(table);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// AI content generation (§2) — always DRAFTS unless explicitly published
// ---------------------------------------------------------------------------

const BLOG_SYSTEM_PROMPT =
  "شما نویسندهٔ محتوای حقوقی فارسی برای وبلاگ «لیگال‌آیر» هستید. متن را روان، دقیق و قابل‌استناد بنویسید، از ادعای بی‌منبع بپرهیزید و در پایان یادآوری کنید که این محتوا جایگزین مشاورهٔ وکیل نیست. ساختار خروجی را دقیقاً به این شکل برگردانید:\n" +
  "عنوان: <عنوان مقاله>\n" +
  "خلاصه: <یک پاراگراف کوتاه>\n" +
  "برچسب‌ها: <برچسب۱، برچسب۲، برچسب۳>\n" +
  "---\n" +
  "<متن کامل مقاله در قالب Markdown با تیترهای ## >";

/** Tolerant parse of the model's structured output into draft fields. */
function parseDraft(text: string, fallbackTitle: string, fallbackTags: string[]) {
  let titleFa = fallbackTitle;
  let excerpt = "";
  let tags = fallbackTags;

  const lines = text.split(/\r?\n/);
  const bodyLines: string[] = [];
  let inBody = false;

  for (const line of lines) {
    if (line.trim() === "---") {
      inBody = true;
      continue;
    }
    if (!inBody) {
      const t = line.match(/^\s*عنوان\s*[:：]\s*(.+)$/);
      if (t) {
        titleFa = t[1]!.trim();
        continue;
      }
      const e = line.match(/^\s*خلاصه\s*[:：]\s*(.+)$/);
      if (e) {
        excerpt = e[1]!.trim();
        continue;
      }
      // Tolerant of «برچسب‌ها» / «برچسب ها» / «برچسبها» (ZWNJ, space, none).
      const g = line.match(/^\s*برچسب[^:：]*[:：]\s*(.+)$/);
      if (g) {
        tags = g[1]!
          .split(/[،,]/)
          .map((s) => s.trim())
          .filter(Boolean);
        continue;
      }
      // Skip stray preamble lines before the body separator.
      if (line.trim()) bodyLines.push(line);
    } else {
      bodyLines.push(line);
    }
  }

  const body = bodyLines.join("\n").trim() || text.trim();
  if (!excerpt) {
    const firstPara = body.split(/\n+/).find((l) => l.trim() && !l.trim().startsWith("#"));
    excerpt = (firstPara ?? "").trim().slice(0, 200);
  }
  if (tags.length === 0) tags = fallbackTags;
  return { titleFa, excerpt, tags, body };
}

export async function generateBlogDraft(
  input: GenerateBlogDraftInput,
  actorId: string
): Promise<GeneratedBlogDraft | { error: string }> {
  const topic = (input.topic ?? "").trim();
  if (!topic) return { error: "TOPIC_REQUIRED" };

  const category = input.category?.trim() || "";
  const keywords = (input.keywords ?? []).map((k) => k.trim()).filter(Boolean);
  const tone = input.tone?.trim();
  const titleHint = input.titleHint?.trim();

  const prompt = [
    titleHint ? `عنوان پیشنهادی: ${titleHint}` : null,
    `موضوع مقاله: ${topic}`,
    category ? `دسته‌بندی: ${category}` : null,
    keywords.length ? `واژگان کلیدی: ${keywords.join("، ")}` : null,
    tone ? `لحن: ${tone}` : null,
    "طول: حدود ۶۰۰ تا ۹۰۰ کلمه.",
  ]
    .filter(Boolean)
    .join("\n");

  const generated = await generateContentText({ system: BLOG_SYSTEM_PROMPT, prompt });
  const parsed = parseDraft(generated.text, titleHint || topic, keywords);

  const table = readBlogTable();
  const slug = uniqueSlug(slugify(titleHint || topic) || slugify(parsed.titleFa), table);

  const draft: GeneratedBlogDraft = {
    titleFa: parsed.titleFa,
    slug,
    excerpt: parsed.excerpt,
    body: parsed.body,
    category,
    tags: parsed.tags,
    readingTime: estimateReadingTime(parsed.body),
    metaTitle: parsed.titleFa,
    metaDescription: parsed.excerpt,
    provider: generated.provider,
    model: generated.model,
    mock: generated.mock,
    totalTokens: generated.totalTokens,
    estimatedTokens: generated.estimatedTokens,
    savedPostId: null,
  };

  // Save ONLY when explicitly requested — and ALWAYS as a draft. Nothing is
  // auto-published; the operator must publish intentionally.
  if (input.save) {
    const saved = upsertBlogPost(
      {
        titleFa: draft.titleFa,
        slug: draft.slug,
        excerpt: draft.excerpt,
        body: draft.body,
        category: draft.category,
        tags: draft.tags,
        readingTime: draft.readingTime,
        coverImage: null,
        seoTitle: draft.metaTitle,
        seoDescription: draft.metaDescription,
        status: "DRAFT",
        author: `AI Assistant (${actorId})`,
        aiAssisted: true,
      },
      actorId
    );
    if ("error" in saved) return saved;
    draft.savedPostId = saved.id;
  }

  return draft;
}
