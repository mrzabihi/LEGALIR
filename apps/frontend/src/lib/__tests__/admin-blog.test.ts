// ============================================================
// LEGALIR — Admin blog authoring + AI content (§2, hermetic)
// ============================================================
// Covers the write-side of the ONE blog store (`.data/blog.json`) the public
// site reads:
//
//   • listAdminBlogPosts — status derivation for legacy fixtures
//   • upsertBlogPost     — create/update; publishing stamps `publishedAt`
//   • setBlogStatus      — publish/unpublish transitions
//   • deleteBlogPost     — removes item + detail
//   • generateBlogDraft  — AI draft is ALWAYS saved as a draft
//
// `node:fs` and the AI provider are mocked so the suite is hermetic — it
// asserts the module never fabricates a parallel store and never auto-publishes.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory stand-in for `.data/blog.json`. `fs` is mocked to read/write it.
const state = vi.hoisted(() => ({
  table: { items: [] as unknown[], details: {} as Record<string, unknown>, categories: [] as unknown[] } as {
    items: Record<string, unknown>[];
    details: Record<string, Record<string, unknown>>;
    categories: Record<string, unknown>[];
  },
  aiText: "",
  aiCalls: 0,
}));

vi.mock("node:fs", () => {
  const mocked = {
    existsSync: () => true,
    readFileSync: () => JSON.stringify(state.table),
    writeFileSync: (_p: string, data: string) => {
      state.table = JSON.parse(data);
    },
    mkdirSync: () => {},
  };
  return { default: mocked, ...mocked };
});

vi.mock("@/lib/ai/content", () => ({
  generateContentText: async () => {
    state.aiCalls += 1;
    return {
      text: state.aiText,
      provider: "mock",
      model: "mock-1",
      mock: true,
      totalTokens: 123,
      estimatedTokens: true,
    };
  },
}));

// Imported AFTER the mocks are registered.
import {
  listAdminBlogPosts,
  getAdminBlogPost,
  listBlogCategories,
  upsertBlogPost,
  setBlogStatus,
  deleteBlogPost,
  generateBlogDraft,
} from "@/lib/admin/blog";

function seedItem(over: Record<string, unknown> = {}) {
  return {
    id: "blog-1",
    slug: "rent-termination",
    titleFa: "فسخ قرارداد اجاره",
    excerpt: "خلاصه",
    coverImage: null,
    author: "تحریریه",
    category: "حقوق قراردادها",
    tags: ["اجاره"],
    readingTime: 3,
    publishedAt: "2026-01-01T00:00:00.000Z",
    featured: false,
    ...over,
  };
}

function seedDetail(slug: string, over: Record<string, unknown> = {}) {
  return {
    id: "blog-1",
    slug,
    titleFa: "فسخ قرارداد اجاره",
    excerpt: "خلاصه",
    body: "متن",
    coverImage: null,
    author: "تحریریه",
    category: "حقوق قراردادها",
    tags: ["اجاره"],
    readingTime: 3,
    publishedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    seoTitle: null,
    seoDescription: null,
    canonicalUrl: null,
    relatedSources: [],
    relatedGuides: [],
    relatedServices: [],
    previousPost: null,
    nextPost: null,
    ...over,
  };
}

beforeEach(() => {
  state.table = { items: [], details: {}, categories: [] };
  state.aiText = "";
  state.aiCalls = 0;
});

describe("listAdminBlogPosts — status derivation", () => {
  it("reads a fixture with publishedAt but no stored status as PUBLISHED", () => {
    state.table.items = [seedItem()];
    state.table.details["rent-termination"] = seedDetail("rent-termination");
    const out = listAdminBlogPosts();
    expect(out).toHaveLength(1);
    expect(out[0]!.status).toBe("PUBLISHED");
    expect(out[0]!.updatedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("reads an empty publishedAt as DRAFT", () => {
    state.table.items = [seedItem({ publishedAt: "" })];
    const out = listAdminBlogPosts();
    expect(out[0]!.status).toBe("DRAFT");
    expect(out[0]!.publishedAt).toBeNull();
  });

  it("honours an explicit stored status over the derivation", () => {
    state.table.items = [seedItem()];
    state.table.details["rent-termination"] = seedDetail("rent-termination", {
      status: "SCHEDULED",
    });
    expect(listAdminBlogPosts()[0]!.status).toBe("SCHEDULED");
  });
});

describe("upsertBlogPost — create / update", () => {
  it("creates a DRAFT by default and slugifies the title", () => {
    const res = upsertBlogPost({ titleFa: "Repair Rights" }, "admin-1");
    if ("error" in res) throw new Error("unexpected error");
    expect(res.status).toBe("DRAFT");
    expect(res.slug).toBe("repair-rights");
    expect(res.createdBy).toBe("admin-1");
    expect(res.publishedAt).toBeNull();
    // Persisted — a second read sees it.
    expect(listAdminBlogPosts()).toHaveLength(1);
  });

  it("rejects an empty title", () => {
    const res = upsertBlogPost({ titleFa: "   " });
    expect("error" in res && res.error).toBe("BLOG_TITLE_REQUIRED");
  });

  it("stamps publishedAt when created directly as PUBLISHED", () => {
    const res = upsertBlogPost({ titleFa: "Live Post", status: "PUBLISHED" }, "admin-1");
    if ("error" in res) throw new Error("unexpected error");
    expect(res.status).toBe("PUBLISHED");
    expect(res.publishedAt).toBeTruthy();
  });

  it("updates in place without minting a new id", () => {
    const first = upsertBlogPost({ titleFa: "First", status: "PUBLISHED" }, "admin-1");
    if ("error" in first) throw new Error("unexpected error");
    const second = upsertBlogPost({ id: first.id, titleFa: "First (edited)" }, "admin-1");
    if ("error" in second) throw new Error("unexpected error");
    expect(second.id).toBe(first.id);
    expect(listAdminBlogPosts()).toHaveLength(1);
    expect(second.titleFa).toBe("First (edited)");
    // Editing without a status keeps it PUBLISHED and preserves publishedAt.
    expect(second.status).toBe("PUBLISHED");
    expect(second.publishedAt).toBe(first.publishedAt);
  });
});

describe("setBlogStatus — publish transitions", () => {
  it("publishes then unpublishes (clearing publishedAt)", () => {
    const created = upsertBlogPost({ titleFa: "Toggle Me" }, "admin-1");
    if ("error" in created) throw new Error("unexpected error");

    const published = setBlogStatus(created.id, "PUBLISHED");
    if ("error" in published) throw new Error("unexpected error");
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).toBeTruthy();

    const reverted = setBlogStatus(created.id, "DRAFT");
    if ("error" in reverted) throw new Error("unexpected error");
    expect(reverted.status).toBe("DRAFT");
    expect(reverted.publishedAt).toBeNull();
  });

  it("returns NOT_FOUND for an unknown id", () => {
    const res = setBlogStatus("nope", "PUBLISHED");
    expect("error" in res && res.error).toBe("NOT_FOUND");
  });
});

describe("deleteBlogPost", () => {
  it("removes both the list item and its detail row", () => {
    const created = upsertBlogPost({ titleFa: "Doomed" }, "admin-1");
    if ("error" in created) throw new Error("unexpected error");
    const res = deleteBlogPost(created.id);
    expect("ok" in res).toBe(true);
    expect(listAdminBlogPosts()).toHaveLength(0);
    expect(getAdminBlogPost(created.id)).toBeUndefined();
  });

  it("returns NOT_FOUND for an unknown id", () => {
    const res = deleteBlogPost("nope");
    expect("error" in res && res.error).toBe("NOT_FOUND");
  });
});

describe("generateBlogDraft — AI content is always a draft", () => {
  beforeEach(() => {
    state.aiText =
      "عنوان: مسئولیت کارفرما\n" +
      "خلاصه: یک خلاصهٔ کوتاه.\n" +
      "برچسب‌ها: کارفرما، پیمانکاری\n" +
      "---\n" +
      "## مقدمه\n\nمتن کامل مقاله.";
  });

  it("parses the structured output without persisting when save is false", async () => {
    const res = await generateBlogDraft({ topic: "مسئولیت کارفرما" }, "admin-1");
    if ("error" in res) throw new Error("unexpected error");
    expect(res.titleFa).toBe("مسئولیت کارفرما");
    expect(res.tags).toEqual(["کارفرما", "پیمانکاری"]);
    expect(res.body).toContain("متن کامل مقاله");
    expect(res.mock).toBe(true);
    expect(res.savedPostId).toBeNull();
    expect(listAdminBlogPosts()).toHaveLength(0);
  });

  it("saves as DRAFT with aiAssisted=true when requested", async () => {
    const res = await generateBlogDraft({ topic: "مسئولیت کارفرما", save: true }, "admin-1");
    if ("error" in res) throw new Error("unexpected error");
    expect(res.savedPostId).toBeTruthy();
    const saved = getAdminBlogPost(res.savedPostId!);
    expect(saved).toBeDefined();
    expect(saved!.status).toBe("DRAFT");
    expect(saved!.aiAssisted).toBe(true);
  });

  it("rejects an empty topic without calling the provider", async () => {
    const res = await generateBlogDraft({ topic: "  " }, "admin-1");
    expect("error" in res && res.error).toBe("TOPIC_REQUIRED");
    expect(state.aiCalls).toBe(0);
  });
});

describe("listBlogCategories", () => {
  it("projects stored categories", () => {
    state.table.categories = [
      { id: "c1", slug: "contracts", titleFa: "قراردادها", description: "دربارهٔ قرارداد" },
    ];
    const out = listBlogCategories();
    expect(out).toEqual([
      { id: "c1", slug: "contracts", titleFa: "قراردادها", description: "دربارهٔ قرارداد" },
    ]);
  });
});
