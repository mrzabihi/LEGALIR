// ============================================================
// LEGALIR — Blog public visibility (unpublished never reaches the site)
// ============================================================
// Locks in the rule the public blog surface must obey: a DRAFT/ARCHIVED post
// is stored in the admin blog store but is NEVER served publicly — not in the
// list, not by direct slug. Publishing makes it appear; unpublishing hides it
// again. This is the blog analogue of `isPubliclyVisible` for the library.
//
// `legal-library-db`/`admin/blog` resolve `.data` from `process.cwd()` at
// module load, so every module (including the route handlers) is dynamically
// imported AFTER chdir into a throwaway directory — the real dev blog store is
// never touched.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type * as libModule from "@/lib/legal-library-db";
import type * as blogAdminModule from "@/lib/admin/blog";
import type * as blogRoute from "@/app/api/v1/blog/route";
import type * as blogSlugRoute from "@/app/api/v1/blog/[slug]/route";

type Lib = typeof libModule;
type BlogAdmin = typeof blogAdminModule;

let lib: Lib;
let blogAdmin: BlogAdmin;
let getBlog: typeof blogRoute.GET;
let getBlogPost: typeof blogSlugRoute.GET;
let tmpDir: string;
let originalCwd: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-blog-public-"));
  process.chdir(tmpDir);
  lib = await import("@/lib/legal-library-db");
  blogAdmin = await import("@/lib/admin/blog");
  getBlog = (await import("@/app/api/v1/blog/route")).GET;
  getBlogPost = (await import("@/app/api/v1/blog/[slug]/route")).GET;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// Pure guard
// ============================================================

describe("isBlogPostPubliclyVisible", () => {
  const draftItem = { id: "b", slug: "s", titleFa: "t", publishedAt: "" } as never;
  const pubItem = { id: "b", slug: "s", titleFa: "t", publishedAt: "2026-08-01T00:00:00Z" } as never;

  it("is public when the detail status is PUBLISHED", () => {
    expect(lib.isBlogPostPubliclyVisible(pubItem, { status: "PUBLISHED" } as never)).toBe(true);
  });

  it("is hidden when the detail status is DRAFT", () => {
    expect(lib.isBlogPostPubliclyVisible(pubItem, { status: "DRAFT" } as never)).toBe(false);
  });

  it("is hidden when the detail status is SCHEDULED (not yet PUBLISHED)", () => {
    expect(lib.isBlogPostPubliclyVisible(pubItem, { status: "SCHEDULED" } as never)).toBe(false);
  });

  it("falls back to publishedAt for a legacy row with no status", () => {
    expect(lib.isBlogPostPubliclyVisible(pubItem, {} as never)).toBe(true);
    expect(lib.isBlogPostPubliclyVisible(draftItem, {} as never)).toBe(false);
    expect(lib.isBlogPostPubliclyVisible(undefined, undefined)).toBe(false);
  });
});

// ============================================================
// Public route behaviour
// ============================================================

async function listSlugs(): Promise<string[]> {
  const res = await getBlog(new Request("http://localhost/api/v1/blog?pageSize=100"));
  const body = await res.json();
  return body.data.items.map((i: { slug: string }) => i.slug);
}

describe("public blog routes hide unpublished posts", () => {
  it("serves the seeded published posts", async () => {
    const slugs = await listSlugs();
    expect(slugs).toContain("contract-penalty-clause");
  });

  it("does NOT list a freshly-saved DRAFT, and 404s it by slug", async () => {
    const saved = blogAdmin.upsertBlogPost(
      { titleFa: "پیش‌نویس آزمایشی", body: "متن پیش‌نویس", status: "DRAFT" },
      "admin-1"
    );
    if ("error" in saved) throw new Error("unexpected error");

    // Confirmed stored (admin store) …
    expect(lib.readBlog().details[saved.slug]).toBeDefined();
    // … but invisible publicly, in the list …
    expect(await listSlugs()).not.toContain(saved.slug);
    // … and by direct slug (indistinguishable from missing).
    const detail = await getBlogPost(
      new Request(`http://localhost/api/v1/blog/${saved.slug}`),
      { params: Promise.resolve({ slug: saved.slug }) }
    );
    expect(detail.status).toBe(404);
  });

  it("publishing the same post makes it public again; unpublishing hides it", async () => {
    const saved = blogAdmin.upsertBlogPost(
      { titleFa: "مطلب قابل انتشار", body: "متن", status: "DRAFT" },
      "admin-1"
    );
    if ("error" in saved) throw new Error("unexpected error");

    blogAdmin.setBlogStatus(saved.id, "PUBLISHED");
    expect(await listSlugs()).toContain(saved.slug);
    const ok = await getBlogPost(
      new Request(`http://localhost/api/v1/blog/${saved.slug}`),
      { params: Promise.resolve({ slug: saved.slug }) }
    );
    expect(ok.status).toBe(200);

    blogAdmin.setBlogStatus(saved.id, "DRAFT");
    expect(await listSlugs()).not.toContain(saved.slug);
    const gone = await getBlogPost(
      new Request(`http://localhost/api/v1/blog/${saved.slug}`),
      { params: Promise.resolve({ slug: saved.slug }) }
    );
    expect(gone.status).toBe(404);
  });
});
