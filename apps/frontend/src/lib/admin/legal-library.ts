// ============================================================
// LEGALIR — Admin legal-library authoring (server-only)
// ============================================================
// Owns the write-side of `.data/legal-library.json` — the SAME store the
// public library reads (see lib/legal-library-db). This is deliberately
// INDEPENDENT of the blog: a separate store, separate row types, separate
// lifecycle. The admin mutates the library in place; there is no parallel copy.
//
// Invariants:
//   • publishing stamps `publishedAt`; any other status clears it so the public
//     list (which shows only published sources) drops the source;
//   • a newly created source is ALWAYS a DRAFT unless a status is supplied;
//   • the detail row is keyed by the source `id` (never the slug) so the public
//     detail lookup, bookmarks and the knowledge engine keep resolving by id;
//   • slugs are unique across list items.
// ============================================================

import type {
  AdminLegalSource,
  AdminLegalTopic,
  LegalContentType,
  LegalSourceStatus,
  UpsertLegalSourceInput,
} from "@legalir/types";
import {
  legalSourceStatusOf,
  readLegalLibrary,
  writeLegalLibrary,
  type LegalLibraryTable,
  type StoredLegalDetail,
  type StoredLegalListItem,
} from "@/lib/legal-library-db";
import { toPersianDate } from "@/lib/persian-utils";

/** Persian labels for each legal content type (used when creating a source). */
const SOURCE_TYPE_FA: Record<LegalContentType, string> = {
  LAW_ARTICLE: "قانون",
  REGULATION: "آیین‌نامه",
  UNIFICATION_RULING: "رأی وحدت رویه",
  JUDICIAL_DECISION: "رأی قضایی",
  LEGAL_GUIDE: "راهنما",
  HOW_TO: "راهنمای عملی",
  CHECKLIST: "چک‌لیست",
  FAQ: "پرسش و پاسخ",
  LEGAL_TOOL: "ابزار حقوقی",
  TEMPLATE_GUIDE: "قالب و راهنما",
  BLOG_ARTICLE: "مقاله",
  SOURCE: "منبع",
};

/** A fresh stable id for a source that has never been persisted. */
function localId(): string {
  return `src-${crypto.randomUUID()}`;
}

// ---------------------------------------------------------------------------
// Row projection (stored → admin)
// ---------------------------------------------------------------------------

function toAdminLegalSource(
  item: StoredLegalListItem,
  detail: StoredLegalDetail | undefined
): AdminLegalSource {
  return {
    id: item.id,
    slug: item.slug || item.id,
    title: item.title,
    sourceType: item.sourceType,
    sourceTypeFa: item.sourceTypeFa,
    topic: item.topic,
    topicSlug: item.topicSlug,
    summary: item.summary,
    body: detail?.body ?? "",
    authority: item.authority,
    verificationStatus: item.verificationStatus,
    legalReviewStatus: detail?.legalReviewStatus ?? "NOT_REVIEWED",
    publishedDate: item.publishedDate,
    updatedAt: item.updatedAt,
    readingTime: item.readingTime,
    popular: item.popular,
    featured: item.featured,
    status: legalSourceStatusOf(item),
    // `|| null` (not `?? null`): the store writes an EMPTY STRING to clear the
    // publish stamp, so an unpublished source must read back as `null`.
    publishedAt: item.publishedAt || null,
    seoTitle: item.seoTitle ?? null,
    seoDescription: item.seoDescription ?? null,
    canonicalUrl: item.canonicalUrl ?? null,
    sourceUrl: detail?.sourceUrl ?? null,
    officialSourceUrl: detail?.officialSourceUrl ?? null,
    createdBy: item.createdBy ?? null,
    createdAt: item.createdAt ?? item.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export function listAdminLegalSources(): AdminLegalSource[] {
  const { items, details } = readLegalLibrary();
  return items
    .map((item) => toAdminLegalSource(item, details[item.id]))
    .sort((a, b) =>
      (b.updatedAt || b.publishedAt || "").localeCompare(a.updatedAt || a.publishedAt || "")
    );
}

export function getAdminLegalSource(id: string): AdminLegalSource | undefined {
  const { items, details } = readLegalLibrary();
  const item = items.find((i) => i.id === id);
  if (!item) return undefined;
  return toAdminLegalSource(item, details[item.id]);
}

export function listAdminLegalTopics(): AdminLegalTopic[] {
  return readLegalLibrary().topics.map((t) => ({
    slug: t.slug,
    titleFa: t.titleFa,
    category: t.category,
    contentCount: t.contentCount,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A URL slug that keeps Unicode (Persian) letters, so a Persian title yields a
 * readable slug rather than an empty one. Falls back to a random suffix when
 * the base is empty.
 */
function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueSlug(base: string, table: LegalLibraryTable, exceptSlug?: string): string {
  const slugBase = base || `lib-${crypto.randomUUID().slice(0, 8)}`;
  const taken = (s: string) => s !== exceptSlug && table.items.some((i) => i.slug === s);
  if (!taken(slugBase)) return slugBase;
  let n = 2;
  while (taken(`${slugBase}-${n}`)) n += 1;
  return `${slugBase}-${n}`;
}

function estimateReadingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function faDate(iso: string): string {
  try {
    return toPersianDate(iso, { dateStyle: "long" });
  } catch {
    return iso;
  }
}

/** A blank detail skeleton for a brand-new source (never a fake document). */
function emptyDetail(item: StoredLegalListItem, now: string): StoredLegalDetail {
  return {
    id: item.id,
    sourceType: item.sourceType,
    sourceTypeFa: item.sourceTypeFa,
    title: item.title,
    shortTitle: null,
    lawName: null,
    articleNumber: null,
    judgmentNumber: null,
    authority: item.authority,
    jurisdiction: "ایران",
    publicationDate: null,
    effectiveDate: null,
    lastAmendmentDate: null,
    status: "معتبر",
    summary: item.summary,
    body: "",
    simpleExplanation: null,
    practicalApplication: null,
    keyPoints: null,
    examples: null,
    sourceUrl: null,
    officialSourceUrl: null,
    sourceProvider: null,
    sourceDomain: null,
    verificationStatus: item.verificationStatus,
    lastVerifiedAt: null,
    version: 1,
    relatedSources: [],
    relatedGuides: [],
    relatedServices: [],
    legalReviewStatus: "NOT_REVIEWED",
    isBookmarked: false,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Write — create / update
// ---------------------------------------------------------------------------

export function upsertLegalSource(
  input: UpsertLegalSourceInput,
  actorId?: string
): AdminLegalSource | { error: string } {
  const title = (input.title ?? "").trim();
  if (!title) return { error: "LIBRARY_TITLE_REQUIRED" };

  const table = readLegalLibrary();
  const now = new Date().toISOString();

  const idx = input.id ? table.items.findIndex((i) => i.id === input.id) : -1;
  const existing = idx >= 0 ? table.items[idx] : undefined;
  const existingDetail = existing ? table.details[existing.id] : undefined;

  // New sources default to DRAFT; an edit that omits a status keeps the one the
  // source already had (so an edit can never silently unpublish a live source).
  const status: LegalSourceStatus =
    input.status ?? (existing ? legalSourceStatusOf(existing) : "DRAFT");

  const slug = uniqueSlug(
    slugify(input.slug?.trim() || "") || slugify(title) || existing?.slug || "",
    table,
    existing?.slug
  );

  const sourceType: LegalContentType = input.sourceType ?? existing?.sourceType ?? "LEGAL_GUIDE";
  const sourceTypeFa = SOURCE_TYPE_FA[sourceType] ?? existing?.sourceTypeFa ?? "منبع";
  const body = input.body ?? existingDetail?.body ?? "";
  const readingTime =
    input.readingTime ?? (body ? estimateReadingTime(body) : existing?.readingTime ?? 1);

  // Publishing stamps `publishedAt` (idempotent); any other status clears it so
  // the public list drops the source.
  const publishedAt = status === "PUBLISHED" ? existing?.publishedAt || now : "";
  const publishedDate =
    existing?.publishedDate ?? (status === "PUBLISHED" ? faDate(publishedAt || now) : null);

  const item: StoredLegalListItem = {
    id: existing?.id ?? localId(),
    slug,
    title,
    sourceType,
    sourceTypeFa,
    topic: input.topic ?? existing?.topic ?? null,
    topicSlug: input.topicSlug ?? existing?.topicSlug ?? null,
    summary: input.summary ?? existing?.summary ?? "",
    authority: input.authority?.trim() || existing?.authority || "LEGALIR",
    verificationStatus: existing?.verificationStatus ?? "UNVERIFIED",
    publishedDate,
    updatedAt: now,
    readingTime,
    popular: input.popular ?? existing?.popular ?? false,
    featured: input.featured ?? existing?.featured ?? false,
    status,
    publishedAt,
    seoTitle: input.seoTitle ?? existing?.seoTitle ?? null,
    seoDescription: input.seoDescription ?? existing?.seoDescription ?? null,
    canonicalUrl: input.canonicalUrl ?? existing?.canonicalUrl ?? null,
    createdBy: existing?.createdBy ?? actorId ?? null,
    createdAt: existing?.createdAt ?? now,
  };

  const detail: StoredLegalDetail = {
    ...(existingDetail ?? emptyDetail(item, now)),
    id: item.id,
    sourceType,
    sourceTypeFa,
    title: item.title,
    summary: item.summary,
    authority: item.authority,
    body,
    // Reference + official links live on the detail row (the public detail page
    // renders them) — authorable here, never fabricated when omitted.
    sourceUrl: input.sourceUrl ?? existingDetail?.sourceUrl ?? null,
    officialSourceUrl: input.officialSourceUrl ?? existingDetail?.officialSourceUrl ?? null,
    updatedAt: now,
    createdBy: existingDetail?.createdBy ?? actorId ?? null,
  };

  if (idx >= 0) table.items[idx] = item;
  else table.items.unshift(item);
  // The detail row is keyed by the source id — never by slug — so the public
  // detail lookup, bookmarks and the knowledge engine keep resolving by id.
  table.details[item.id] = detail;

  writeLegalLibrary(table);
  return getAdminLegalSource(item.id)!;
}

export function setLegalSourceStatus(
  id: string,
  status: LegalSourceStatus
): AdminLegalSource | { error: string } {
  const table = readLegalLibrary();
  const item = table.items.find((i) => i.id === id);
  if (!item) return { error: "NOT_FOUND" };
  const now = new Date().toISOString();

  if (status === "PUBLISHED" && !item.publishedAt) item.publishedAt = now;
  if (status !== "PUBLISHED") item.publishedAt = "";
  item.status = status;
  item.updatedAt = now;
  if (status === "PUBLISHED" && !item.publishedDate) item.publishedDate = faDate(now);

  const detail = table.details[item.id];
  if (detail) {
    // The detail carries the Persian *validity* status, not the lifecycle —
    // only its mtime is bumped so the public detail re-renders current.
    detail.updatedAt = now;
  }
  writeLegalLibrary(table);
  return getAdminLegalSource(id)!;
}

export function deleteLegalSource(id: string): { ok: true } | { error: string } {
  const table = readLegalLibrary();
  const idx = table.items.findIndex((i) => i.id === id);
  if (idx === -1) return { error: "NOT_FOUND" };
  table.items.splice(idx, 1);
  Reflect.deleteProperty(table.details, id);
  writeLegalLibrary(table);
  return { ok: true };
}
