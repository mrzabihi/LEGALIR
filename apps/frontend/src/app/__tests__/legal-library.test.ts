// ============================================================
// LEGALIR — Legal Library & Blog Tests
// ============================================================
// Covers:
//   1. Pure filtering/pagination helpers in @/lib/legal-library-db
//   2. JSON-DB seeding & read operations
//   3. Bookmark round-trip (setBookmark / getBookmarkedIds)
//   4. Route handlers: list, search, topics, [id], bookmark, blog
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { LegalContentType } from "@legalir/types";
import {
  filterLibraryItems,
  filterBlogItems,
  paginate,
  readLegalLibrary,
  readBlog,
  readBookmarks,
  writeBookmarks,
  getBookmarkedIds,
  setBookmark,
} from "@/lib/legal-library-db";

// ============================================================
// Mock the session lookup so route handlers can authenticate
// without touching .data/sessions.json in tests.
// ============================================================

import { findSessionById } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  findSessionById: vi.fn(),
}));

const mockFindSession = vi.mocked(findSessionById);

const TEST_USER = "u-test-001";

function authenticatedSession() {
  return {
    id: "sess-test-001",
    userId: TEST_USER,
    createdAt: "2026-08-01T00:00:00.000Z",
    expiresAt: "2999-01-01T00:00:00.000Z",
  };
}

function authedRequest(url: string): Request {
  return new Request(url, {
    headers: { cookie: "legalir-session=sess-test-001" },
  });
}

// ============================================================
// 1. Pure filtering helpers
// ============================================================

describe("filterLibraryItems", () => {
  const items = readLegalLibrary().items;

  it("returns all items when no filters are applied", () => {
    expect(filterLibraryItems(items, {})).toHaveLength(items.length);
  });

  it("filters by search across title and summary", () => {
    const result = filterLibraryItems(items, { search: "تأخیر" });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((i) => i.title.includes("تأخیر") || i.summary.includes("تأخیر"))).toBe(true);
  });

  it("filters by search across authority", () => {
    const result = filterLibraryItems(items, { search: "دیوان عالی" });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((i) => i.authority.includes("دیوان عالی"))).toBe(true);
  });

  it("filters by topic slug", () => {
    const result = filterLibraryItems(items, { topic: "damages-penalty" });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((i) => i.topicSlug === "damages-penalty")).toBe(true);
  });

  it("filters by source type", () => {
    const result = filterLibraryItems(items, { sourceType: "LAW_ARTICLE" as LegalContentType });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((i) => i.sourceType === "LAW_ARTICLE")).toBe(true);
  });

  it("returns empty array for a non-matching search", () => {
    expect(filterLibraryItems(items, { search: "چیزی که وجود ندارد" })).toHaveLength(0);
  });

  it("sorts by popular (featured/popular first)", () => {
    const result = filterLibraryItems(items, { sort: "popular" });
    const popularFirst = result[0]!;
    for (const item of result) {
      expect(Number(item.popular)).toBeLessThanOrEqual(Number(popularFirst.popular));
    }
  });

  it("sorts by title alphabetically", () => {
    const result = filterLibraryItems(items, { sort: "title" });
    const titles = result.map((i) => i.title);
    const sorted = [...titles].sort((a, b) => a.localeCompare(b, "fa"));
    expect(titles).toEqual(sorted);
  });
});

describe("filterBlogItems", () => {
  const items = readBlog().items;

  it("returns all items without filters", () => {
    expect(filterBlogItems(items, {})).toHaveLength(items.length);
  });

  it("filters by category", () => {
    const result = filterBlogItems(items, { category: "قراردادها" });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((i) => i.category === "قراردادها")).toBe(true);
  });

  it("filters by tag", () => {
    const result = filterBlogItems(items, { tag: "چک" });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((i) => i.tags.includes("چک"))).toBe(true);
  });

  it("returns empty for unknown category", () => {
    expect(filterBlogItems(items, { category: "دسته‌بندی-ناشناخته" })).toHaveLength(0);
  });
});

describe("paginate", () => {
  const source = [1, 2, 3, 4, 5];

  it("returns the first page slice", () => {
    const { items, pagination } = paginate(source, 1, 2);
    expect(items).toEqual([1, 2]);
    expect(pagination).toEqual({ page: 1, pageSize: 2, total: 5, totalPages: 3 });
  });

  it("returns the last page slice", () => {
    const { items, pagination } = paginate(source, 3, 2);
    expect(items).toEqual([5]);
    expect(pagination.totalPages).toBe(3);
  });

  it("clamps invalid page/pageSize to safe minimums", () => {
    const { pagination } = paginate(source, 0, 0);
    expect(pagination.page).toBe(1);
    expect(pagination.pageSize).toBe(1);
  });
});

// ============================================================
// 2. JSON-DB seeding & read operations
// ============================================================

describe("readLegalLibrary", () => {
  it("seeds and returns list items, topics, and details", () => {
    const table = readLegalLibrary();
    expect(table.items.length).toBeGreaterThan(0);
    expect(table.topics.length).toBeGreaterThan(0);
    expect(Object.keys(table.details).length).toBeGreaterThan(0);
  });

  it("exposes the three verified law sources as details", () => {
    const { details } = readLegalLibrary();
    expect(details["src-law-civil-230"]).toBeDefined();
    expect(details["src-law-procedure-522"]).toBeDefined();
    expect(details["src-unity-decision-805"]).toBeDefined();
  });

  it("returns detail with a legal body for a law article", () => {
    const { details } = readLegalLibrary();
    const source = details["src-law-civil-230"]!;
    expect(source.sourceType).toBe("LAW_ARTICLE");
    expect(source.body).toBeTruthy();
    expect(source.relatedSources.length).toBeGreaterThan(0);
  });
});

describe("readBlog", () => {
  it("seeds and returns items, details, and categories", () => {
    const table = readBlog();
    expect(table.items.length).toBeGreaterThan(0);
    expect(Object.keys(table.details).length).toBeGreaterThan(0);
    expect(table.categories.length).toBeGreaterThan(0);
  });

  it("exposes published blog post details by slug", () => {
    const { details } = readBlog();
    expect(details["contract-penalty-clause"]).toBeDefined();
    expect(details["tenant-rights-guide"]).toBeDefined();
  });
});

// ============================================================
// 3. Bookmark round-trip
// ============================================================

describe("bookmarks", () => {
  const BOOKMARK_USER = "u-bookmark-test";
  const SOURCE_ID = "src-law-civil-230";

  beforeEach(() => {
    const remaining = readBookmarks().filter((b) => b.userId !== BOOKMARK_USER);
    writeBookmarks(remaining);
  });

  it("starts with no bookmarks for a fresh user", () => {
    expect(getBookmarkedIds(BOOKMARK_USER).has(SOURCE_ID)).toBe(false);
  });

  it("adds a bookmark and reflects it in the bookmark set", () => {
    setBookmark(BOOKMARK_USER, SOURCE_ID, true);
    expect(getBookmarkedIds(BOOKMARK_USER).has(SOURCE_ID)).toBe(true);
  });

  it("is idempotent when adding twice", () => {
    setBookmark(BOOKMARK_USER, SOURCE_ID, true);
    setBookmark(BOOKMARK_USER, SOURCE_ID, true);
    const count = readBookmarks().filter(
      (b) => b.userId === BOOKMARK_USER && b.sourceId === SOURCE_ID
    ).length;
    expect(count).toBe(1);
  });

  it("removes a bookmark", () => {
    setBookmark(BOOKMARK_USER, SOURCE_ID, true);
    setBookmark(BOOKMARK_USER, SOURCE_ID, false);
    expect(getBookmarkedIds(BOOKMARK_USER).has(SOURCE_ID)).toBe(false);
  });

  it("does not leak bookmarks across users", () => {
    setBookmark(BOOKMARK_USER, SOURCE_ID, true);
    expect(getBookmarkedIds("u-other-user").has(SOURCE_ID)).toBe(false);
  });
});

// ============================================================
// 4. Route handlers
// ============================================================

import { GET as getLibrary } from "@/app/api/v1/legal-library/route";
import { GET as getSearch } from "@/app/api/v1/legal-library/search/route";
import { GET as getTopics } from "@/app/api/v1/legal-library/topics/route";
import { GET as getSourceDetail } from "@/app/api/v1/legal-library/[id]/route";
import { POST as postBookmark, DELETE as deleteBookmark } from "@/app/api/v1/legal-library/[id]/bookmark/route";
import { GET as getBookmarks } from "@/app/api/v1/legal-library/bookmarks/route";
import { GET as getBlog } from "@/app/api/v1/blog/route";
import { GET as getBlogPost } from "@/app/api/v1/blog/[slug]/route";

describe("Legal Library route handlers", () => {
  beforeEach(() => {
    mockFindSession.mockReturnValue(authenticatedSession());
  });

  it("returns 401 when unauthenticated", async () => {
    mockFindSession.mockReturnValue(undefined);
    const res = await getLibrary(new Request("http://localhost/api/v1/legal-library"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns paginated list items", async () => {
    const res = await getLibrary(authedRequest("http://localhost/api/v1/legal-library?page=1&pageSize=5"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items).toHaveLength(5);
    expect(body.data.pagination.total).toBeGreaterThanOrEqual(5);
  });

  it("applies search filter on the list", async () => {
    const res = await getLibrary(authedRequest("http://localhost/api/v1/legal-library?search=ماده"));
    const body = await res.json();
    expect(body.data.items.length).toBeGreaterThan(0);
    for (const item of body.data.items) {
      expect(item.title.includes("ماده") || item.summary.includes("ماده")).toBe(true);
    }
  });

  it("returns search results with normalized query", async () => {
    const res = await getSearch(authedRequest("http://localhost/api/v1/legal-library/search?q=خسارت"));
    const body = await res.json();
    expect(body.data.query).toBe("خسارت");
    expect(body.data.normalizedQuery).toBe("خسارت");
    expect(body.data.items.length).toBeGreaterThan(0);
  });

  it("returns topics", async () => {
    const res = await getTopics(authedRequest("http://localhost/api/v1/legal-library/topics"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]).toHaveProperty("slug");
    expect(body.data[0]).toHaveProperty("titleFa");
  });

  it("returns source detail with isBookmarked flag", async () => {
    const res = await getSourceDetail(
      authedRequest("http://localhost/api/v1/legal-library/src-law-civil-230"),
      { params: Promise.resolve({ id: "src-law-civil-230" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("src-law-civil-230");
    expect(body.data).toHaveProperty("isBookmarked");
    expect(body.data.body).toBeTruthy();
  });

  it("returns 404 for unknown source id", async () => {
    const res = await getSourceDetail(
      authedRequest("http://localhost/api/v1/legal-library/unknown-id"),
      { params: Promise.resolve({ id: "unknown-id" }) }
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
  });

  it("bookmarks and un-bookmarks a source", async () => {
    const add = await postBookmark(
      authedRequest("http://localhost/api/v1/legal-library/src-law-civil-230/bookmark"),
      { params: Promise.resolve({ id: "src-law-civil-230" }) }
    );
    expect((await add.json()).data.bookmarked).toBe(true);

    const listRes = await getBookmarks(authedRequest("http://localhost/api/v1/legal-library/bookmarks"));
    const listBody = await listRes.json();
    expect(listBody.data.items.some((i: { id: string }) => i.id === "src-law-civil-230")).toBe(true);

    const remove = await deleteBookmark(
      authedRequest("http://localhost/api/v1/legal-library/src-law-civil-230/bookmark"),
      { params: Promise.resolve({ id: "src-law-civil-230" }) }
    );
    expect((await remove.json()).data.bookmarked).toBe(false);
  });
});

describe("Blog route handlers", () => {
  it("returns blog list items", async () => {
    const res = await getBlog(new Request("http://localhost/api/v1/blog"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.length).toBeGreaterThan(0);
    expect(body.data.items[0]).toHaveProperty("slug");
  });

  it("filters blog by category", async () => {
    const res = await getBlog(new Request("http://localhost/api/v1/blog?category=قراردادها"));
    const body = await res.json();
    expect(body.data.items.length).toBeGreaterThan(0);
    for (const item of body.data.items) {
      expect(item.category).toBe("قراردادها");
    }
  });

  it("returns blog post detail by slug", async () => {
    const res = await getBlogPost(
      new Request("http://localhost/api/v1/blog/contract-penalty-clause"),
      { params: Promise.resolve({ slug: "contract-penalty-clause" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.slug).toBe("contract-penalty-clause");
    expect(body.data.body).toBeTruthy();
  });

  it("returns 404 for unknown blog slug", async () => {
    const res = await getBlogPost(
      new Request("http://localhost/api/v1/blog/nonexistent"),
      { params: Promise.resolve({ slug: "nonexistent" }) }
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
  });
});
