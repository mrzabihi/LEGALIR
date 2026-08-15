// ============================================================
// LEGALIR — Legal Library & Blog JSON Database
// ============================================================
// Zero native dependencies. Reference content (sources, topics,
// blog posts, categories) is self-seeded into .data/*.json from
// @legalir/testing fixtures on first access. User bookmarks are
// read/written per-user against the same JSON-DB directory.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import type {
  BlogCategory,
  LegalBookmark,
  LegalContentType,
  V1BlogListItem,
  V1BlogPostDetail,
  V1LegalLibraryListItem,
  V1LegalLibraryTopic,
  V1LegalSourceDetail,
} from "@legalir/types";
import {
  fixtureBlogCategories,
  fixtureBlogListItems,
  fixtureBlogPostDetails,
  fixtureLegalLibraryListItems,
  fixtureLegalLibraryTopics,
  fixtureLegalSourceDetails,
} from "@legalir/testing";

const DATA_DIR = path.resolve(process.cwd(), ".data");

const LEGAL_LIBRARY_FILE = "legal-library.json";
const BLOG_FILE = "blog.json";
const BOOKMARKS_FILE = "legal-bookmarks.json";

// ============================================================
// JSON-DB primitives
// ============================================================

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile<T>(fileName: string, fallback: T): T {
  ensureDir();
  const file = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile<T>(fileName: string, data: T): void {
  ensureDir();
  fs.writeFileSync(path.join(DATA_DIR, fileName), JSON.stringify(data, null, 2), "utf-8");
}

// ============================================================
// Table shapes
// ============================================================

interface LegalLibraryTable {
  items: V1LegalLibraryListItem[];
  topics: V1LegalLibraryTopic[];
  details: Record<string, V1LegalSourceDetail>;
}

interface BlogTable {
  items: V1BlogListItem[];
  details: Record<string, V1BlogPostDetail>;
  categories: BlogCategory[];
}

function seedLegalLibrary(): LegalLibraryTable {
  return {
    items: fixtureLegalLibraryListItems,
    topics: fixtureLegalLibraryTopics,
    details: fixtureLegalSourceDetails,
  };
}

function seedBlog(): BlogTable {
  return {
    items: fixtureBlogListItems,
    details: fixtureBlogPostDetails,
    categories: fixtureBlogCategories,
  };
}

// ============================================================
// Read operations
// ============================================================

export function readLegalLibrary(): LegalLibraryTable {
  const table = readJsonFile<LegalLibraryTable | null>(LEGAL_LIBRARY_FILE, null);
  if (!table) {
    const seeded = seedLegalLibrary();
    writeJsonFile(LEGAL_LIBRARY_FILE, seeded);
    return seeded;
  }
  return table;
}

export function readBlog(): BlogTable {
  const table = readJsonFile<BlogTable | null>(BLOG_FILE, null);
  if (!table) {
    const seeded = seedBlog();
    writeJsonFile(BLOG_FILE, seeded);
    return seeded;
  }
  return table;
}

export function readBookmarks(): LegalBookmark[] {
  return readJsonFile<LegalBookmark[]>(BOOKMARKS_FILE, []);
}

export function writeBookmarks(bookmarks: LegalBookmark[]): void {
  writeJsonFile(BOOKMARKS_FILE, bookmarks);
}

// ============================================================
// Pure filtering helpers (exported for deterministic unit tests)
// ============================================================

export interface LibraryFilters {
  search?: string;
  topic?: string;
  sourceType?: LegalContentType;
  sort?: "newest" | "oldest" | "title" | "popular";
}

export function filterLibraryItems(
  items: V1LegalLibraryListItem[],
  { search = "", topic = "", sourceType, sort }: LibraryFilters
): V1LegalLibraryListItem[] {
  let result = [...items];

  const q = search.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q) ||
        (i.authority?.toLowerCase().includes(q) ?? false)
    );
  }
  if (topic) {
    result = result.filter((i) => i.topicSlug === topic);
  }
  if (sourceType) {
    result = result.filter((i) => i.sourceType === sourceType);
  }

  switch (sort) {
    case "newest":
      result.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
      break;
    case "oldest":
      result.sort((a, b) => (a.updatedAt ?? "").localeCompare(b.updatedAt ?? ""));
      break;
    case "title":
      result.sort((a, b) => a.title.localeCompare(b.title, "fa"));
      break;
    case "popular":
      result.sort((a, b) => Number(b.popular) - Number(a.popular));
      break;
    default:
      break;
  }

  return result;
}

export function filterBlogItems(
  items: V1BlogListItem[],
  { category = "", tag = "" }: { category?: string; tag?: string }
): V1BlogListItem[] {
  let result = [...items];
  if (category) {
    result = result.filter((i) => i.category === category);
  }
  if (tag) {
    result = result.filter((i) => i.tags.includes(tag));
  }
  return result;
}

export function paginate<T>(
  items: T[],
  page = 1,
  pageSize = 20
): { items: T[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } } {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const total = items.length;
  const totalPages = Math.ceil(total / safePageSize);
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    pagination: { page: safePage, pageSize: safePageSize, total, totalPages },
  };
}

// ============================================================
// Bookmark operations
// ============================================================

export function getBookmarkedIds(userId: string): Set<string> {
  return new Set(
    readBookmarks()
      .filter((b) => b.userId === userId)
      .map((b) => b.sourceId)
  );
}

export function setBookmark(userId: string, sourceId: string, bookmarked: boolean): boolean {
  const bookmarks = readBookmarks();
  const existing = bookmarks.find((b) => b.userId === userId && b.sourceId === sourceId);

  if (bookmarked && !existing) {
    bookmarks.push({ id: crypto.randomUUID(), userId, sourceId, createdAt: new Date().toISOString() });
    writeBookmarks(bookmarks);
    return true;
  }

  if (!bookmarked && existing) {
    writeBookmarks(bookmarks.filter((b) => b.userId !== userId || b.sourceId !== sourceId));
    return false;
  }

  return bookmarked;
}
