// ============================================================
// LEGALIR — Admin legal-library authoring (§2, hermetic)
// ============================================================
// Covers the write-side of the ONE library store (`.data/legal-library.json`)
// the public site reads. Deliberately INDEPENDENT of the blog: a separate
// store, separate row types, separate lifecycle.
//
//   • listAdminLegalSources — status derivation for legacy fixtures
//   • upsertLegalSource     — create/update; publishing stamps `publishedAt`
//   • setLegalSourceStatus  — publish / unpublish / archive transitions
//   • deleteLegalSource     — removes item + detail
//
// `node:fs` is mocked so the suite is hermetic — it asserts the module mutates
// the SAME store it reads and never fabricates a parallel copy.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory stand-in for `.data/legal-library.json`. `fs` is mocked to read and
// write it, so the module under test exercises its real read/write path.
const state = vi.hoisted(() => ({
  table: {
    items: [] as Record<string, unknown>[],
    topics: [] as Record<string, unknown>[],
    details: {} as Record<string, Record<string, unknown>>,
  },
}));

vi.mock("node:fs", () => {
  const mocked = {
    existsSync: () => true,
    readFileSync: () => JSON.stringify(state.table),
    writeFileSync: (_p: string, data: string) => {
      state.table = JSON.parse(data);
    },
    mkdirSync: () => {
      /* noop — directories are simulated by the in-memory store */
    },
  };
  return { default: mocked, ...mocked };
});

// Imported AFTER the mock is registered.
import {
  listAdminLegalSources,
  getAdminLegalSource,
  listAdminLegalTopics,
  upsertLegalSource,
  setLegalSourceStatus,
  deleteLegalSource,
} from "@/lib/admin/legal-library";

/** A stored list item — a legacy fixture row with NO status/publishedAt. */
function seedItem(over: Record<string, unknown> = {}) {
  return {
    id: "src-1",
    slug: "civil-230",
    title: "ماده ۲۳۰ قانون مدنی",
    sourceType: "LAW_ARTICLE",
    sourceTypeFa: "قانون",
    topic: "قراردادها",
    topicSlug: "contracts",
    summary: "خلاصه",
    authority: "قانون مدنی",
    verificationStatus: "VERIFIED_OFFICIAL",
    publishedDate: "۱۴۰۰/۰۱/۰۱",
    updatedAt: "2026-01-02T00:00:00.000Z",
    readingTime: 3,
    popular: false,
    featured: false,
    ...over,
  };
}

function seedDetail(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    sourceType: "LAW_ARTICLE",
    sourceTypeFa: "قانون",
    title: "ماده ۲۳۰ قانون مدنی",
    summary: "خلاصه",
    body: "متن ماده",
    authority: "قانون مدنی",
    legalReviewStatus: "NOT_REVIEWED",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  state.table = { items: [], topics: [], details: {} };
});

describe("listAdminLegalSources — status derivation", () => {
  it("reads a legacy fixture with no stored status as PUBLISHED", () => {
    state.table.items = [seedItem()];
    state.table.details["src-1"] = seedDetail("src-1");
    const out = listAdminLegalSources();
    expect(out).toHaveLength(1);
    expect(out[0]!.status).toBe("PUBLISHED");
    expect(out[0]!.body).toBe("متن ماده");
  });

  it("honours an explicit stored status (ARCHIVED) over the derivation", () => {
    state.table.items = [seedItem({ status: "ARCHIVED" })];
    expect(listAdminLegalSources()[0]!.status).toBe("ARCHIVED");
  });

  it("builds an admin row from the list item when no detail row exists", () => {
    state.table.items = [seedItem({ id: "src-2", slug: "guide" })];
    const out = listAdminLegalSources();
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("src-2");
    // No detail row → an empty (never fabricated) body.
    expect(out[0]!.body).toBe("");
  });

  it("falls back to the id when a legacy row has no slug", () => {
    state.table.items = [seedItem({ id: "src-legacy", slug: undefined })];
    expect(listAdminLegalSources()[0]!.slug).toBe("src-legacy");
  });
});

describe("upsertLegalSource — create / update", () => {
  it("creates a DRAFT by default and slugifies the title", () => {
    const res = upsertLegalSource({ title: "Repair Rights" }, "admin-1");
    if ("error" in res) throw new Error("unexpected error");
    expect(res.status).toBe("DRAFT");
    expect(res.slug).toBe("repair-rights");
    expect(res.createdBy).toBe("admin-1");
    expect(res.publishedAt).toBeNull();
    // Persisted — a second read sees it.
    expect(listAdminLegalSources()).toHaveLength(1);
  });

  it("rejects an empty title", () => {
    const res = upsertLegalSource({ title: "   " });
    expect("error" in res && res.error).toBe("LIBRARY_TITLE_REQUIRED");
  });

  it("stamps publishedAt when created directly as PUBLISHED", () => {
    const res = upsertLegalSource({ title: "Live Source", status: "PUBLISHED" }, "admin-1");
    if ("error" in res) throw new Error("unexpected error");
    expect(res.status).toBe("PUBLISHED");
    expect(res.publishedAt).toBeTruthy();
  });

  it("updates in place without minting a new id and keeps publishedAt", () => {
    const first = upsertLegalSource({ title: "First", status: "PUBLISHED" }, "admin-1");
    if ("error" in first) throw new Error("unexpected error");
    const second = upsertLegalSource({ id: first.id, title: "First (edited)" }, "admin-1");
    if ("error" in second) throw new Error("unexpected error");
    expect(second.id).toBe(first.id);
    expect(listAdminLegalSources()).toHaveLength(1);
    expect(second.title).toBe("First (edited)");
    // Editing without a status keeps it PUBLISHED and preserves publishedAt.
    expect(second.status).toBe("PUBLISHED");
    expect(second.publishedAt).toBe(first.publishedAt);
  });

  it("mints a unique slug when a slug already exists", () => {
    upsertLegalSource({ title: "Same Title" }, "admin-1");
    const second = upsertLegalSource({ title: "Same Title" }, "admin-1");
    if ("error" in second) throw new Error("unexpected error");
    expect(second.slug).toBe("same-title-2");
  });

  it("keys the detail row by the source id, never the slug", () => {
    const res = upsertLegalSource({ title: "Keyed By Id", body: "متن" }, "admin-1");
    if ("error" in res) throw new Error("unexpected error");
    expect(state.table.details[res.id]).toBeDefined();
    expect(state.table.details[res.slug]).toBeUndefined();
  });

  it("persists the reference + official links on the detail row", () => {
    const res = upsertLegalSource(
      {
        title: "Linked Source",
        sourceUrl: "https://example.com/a",
        officialSourceUrl: "https://gov.ir/b",
      },
      "admin-1"
    );
    if ("error" in res) throw new Error("unexpected error");
    expect(res.sourceUrl).toBe("https://example.com/a");
    expect(res.officialSourceUrl).toBe("https://gov.ir/b");
    // And they survive a fresh read (single store).
    const reread = getAdminLegalSource(res.id);
    expect(reread!.sourceUrl).toBe("https://example.com/a");
    expect(reread!.officialSourceUrl).toBe("https://gov.ir/b");
  });
});

describe("setLegalSourceStatus — publish transitions", () => {
  it("publishes then archives (clearing publishedAt)", () => {
    const created = upsertLegalSource({ title: "Toggle Me" }, "admin-1");
    if ("error" in created) throw new Error("unexpected error");

    const published = setLegalSourceStatus(created.id, "PUBLISHED");
    if ("error" in published) throw new Error("unexpected error");
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).toBeTruthy();

    const archived = setLegalSourceStatus(created.id, "ARCHIVED");
    if ("error" in archived) throw new Error("unexpected error");
    expect(archived.status).toBe("ARCHIVED");
    expect(archived.publishedAt).toBeNull();
  });

  it("returns NOT_FOUND for an unknown id", () => {
    const res = setLegalSourceStatus("nope", "PUBLISHED");
    expect("error" in res && res.error).toBe("NOT_FOUND");
  });
});

describe("deleteLegalSource", () => {
  it("removes both the list item and its detail row", () => {
    const created = upsertLegalSource({ title: "Doomed" }, "admin-1");
    if ("error" in created) throw new Error("unexpected error");
    const res = deleteLegalSource(created.id);
    expect("ok" in res).toBe(true);
    expect(listAdminLegalSources()).toHaveLength(0);
    expect(getAdminLegalSource(created.id)).toBeUndefined();
  });

  it("returns NOT_FOUND for an unknown id", () => {
    const res = deleteLegalSource("nope");
    expect("error" in res && res.error).toBe("NOT_FOUND");
  });
});

describe("listAdminLegalTopics", () => {
  it("projects stored topics", () => {
    state.table.topics = [
      { slug: "contracts", titleFa: "قراردادها", category: "حقوق مدنی", contentCount: 4 },
    ];
    const out = listAdminLegalTopics();
    expect(out).toEqual([
      { slug: "contracts", titleFa: "قراردادها", category: "حقوق مدنی", contentCount: 4 },
    ]);
  });
});
