// ============================================================
// LEGALIR — Admin announcements · END-TO-END (temp DB)
// ============================================================
// Proves the content-notifications surface is REAL, not decorative:
//
//   admin composes (POST /api/v1/admin/announcements)
//     → draft is stored but delivered to NO ONE
//     → published is delivered through the SAME `deriveNotifications`
//       feed every user already has (category "public")
//   admin retracts (PATCH …/announcements/:id { status: "draft" })
//     → it disappears from every feed immediately
//   audience LAWYERS reaches only a role === "LAWYER" user.
//
// `db.ts` resolves its store from the cwd at import time, so every module is
// imported DYNAMICALLY after chdir into a throwaway directory — a static
// import would bind (and mutate) the real dev DB. See the team convention.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type {
  AdminAnnouncement,
  CreateAnnouncementInput,
  NotificationItem,
} from "@legalir/types";
// Type-only namespace imports are erased at compile time, so they do not bind
// the module before the test chdirs into its temp DB (see the header note).
import type * as DbNS from "../db";
import type * as AnnouncementsNS from "../admin/announcements";

type Db = typeof DbNS;
type Announcements = typeof AnnouncementsNS;

type AdminHandler = (
  req: NextRequest,
  ctx: { params: Promise<{ segments?: string[] }> }
) => Promise<Response>;

let db: Db;
let store: Announcements;
let adminGet: AdminHandler;
let adminPost: AdminHandler;
let adminPatch: AdminHandler;

let adminId: string;
let adminSession: string;
let ordinaryId: string;
let ordinarySession: string;
let lawyerId: string;
let otherId: string;

let tmpDir: string;
let originalCwd: string;

const BASE = "http://localhost/api/v1/admin";

function segments(...parts: string[]): { params: Promise<{ segments: string[] }> } {
  return { params: Promise.resolve({ segments: parts }) };
}

function adminReq(url: string, init?: RequestInit): NextRequest {
  return new Request(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: `legalir-session=${adminSession}`,
      ...(init?.headers ?? {}),
    },
  }) as unknown as NextRequest;
}

function userReq(url: string, session: string, init?: RequestInit): NextRequest {
  return new Request(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: `legalir-session=${session}`,
      ...(init?.headers ?? {}),
    },
  }) as unknown as NextRequest;
}

/** The authored notices (not the static in-code catalog) in a user's feed. */
function authoredItems(userId: string): NotificationItem[] {
  return db
    .deriveNotifications(userId)
    .filter((n) => n.id.startsWith("announcement:"));
}

/** Compose an announcement directly through the store. */
function compose(
  partial: Partial<CreateAnnouncementInput> & { title: string; message: string }
): AdminAnnouncement {
  const res = store.createAnnouncement(
    { audience: "ALL", publish: true, ...partial },
    adminId
  );
  if ("error" in res) throw new Error(`unexpected create error: ${res.error}`);
  return res;
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-announcement-admin-"));
  process.chdir(tmpDir);

  db = await import("../db");
  store = await import("../admin/announcements");

  const route = await import("@/app/api/v1/admin/[[...segments]]/route");
  adminGet = route.GET as unknown as AdminHandler;
  adminPost = route.POST as unknown as AdminHandler;
  adminPatch = route.PATCH as unknown as AdminHandler;

  const admin = db.createUser({ mobile: "09120000001", passwordHash: "x" });
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminId = admin.id;
  adminSession = db.createSession(adminId).id;

  const ordinary = db.createUser({ mobile: "09120000002", passwordHash: "x" });
  ordinaryId = ordinary.id;
  ordinarySession = db.createSession(ordinaryId).id;

  const lawyer = db.createUser({ mobile: "09120000003", passwordHash: "x" });
  db.setUserRole(lawyer.id, "LAWYER");
  lawyerId = lawyer.id;

  const other = db.createUser({ mobile: "09120000004", passwordHash: "x" });
  otherId = other.id;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// Store — validation + lifecycle
// ============================================================

describe("announcements store — validation", () => {
  it("rejects a missing title, a missing body, and an unknown audience", () => {
    expect(
      store.createAnnouncement(
        { title: "  ", message: "سلام", audience: "ALL", publish: true },
        adminId
      )
    ).toEqual({ error: "TITLE_REQUIRED" });
    expect(
      store.createAnnouncement(
        { title: "عنوان", message: "   ", audience: "ALL", publish: true },
        adminId
      )
    ).toEqual({ error: "MESSAGE_REQUIRED" });
    expect(
      store.createAnnouncement(
        { title: "عنوان", message: "متن", audience: "EVERYONE" as never, publish: true },
        adminId
      )
    ).toEqual({ error: "INVALID_AUDIENCE" });
  });

  it("trims text and refuses an action label with no destination", () => {
    const a = store.createAnnouncement(
      {
        title: "  عنوان کوتاه  ",
        message: "  متن  ",
        href: null,
        actionLabel: "ببین",
        audience: "ALL",
        publish: false,
      },
      adminId
    );
    if ("error" in a) throw new Error(a.error);
    expect(a.title).toBe("عنوان کوتاه");
    expect(a.message).toBe("متن");
    expect(a.href).toBeNull();
    expect(a.actionLabel).toBeNull();
  });
});

describe("announcements store — lifecycle", () => {
  it("a published note carries publishedAt; a draft does not", () => {
    const draft = compose({ title: "پیش‌نویس", message: "هنوز منتشر نشده", publish: false });
    const live = compose({ title: "منتشر", message: "الان منتشر شد", publish: true });
    expect(draft.status).toBe("draft");
    expect(draft.publishedAt).toBeNull();
    expect(live.status).toBe("published");
    expect(live.publishedAt).not.toBeNull();
  });

  it("publishing a draft stamps publishedAt; re-publishing keeps the original timestamp", () => {
    const draft = compose({ title: "بعداً منتشر", message: "زمان‌بندی‌شده", publish: false });
    const first = store.setAnnouncementStatus(draft.id, "published", adminId);
    if ("error" in first) throw new Error(first.error);
    expect(first.status).toBe("published");
    expect(first.publishedAt).not.toBeNull();
    const stamp = first.publishedAt;

    const again = store.setAnnouncementStatus(draft.id, "published", adminId);
    if ("error" in again) throw new Error(again.error);
    expect(again.publishedAt).toBe(stamp); // idempotent — feed order does not jump
  });

  it("retracting returns the note to draft and it is no longer listed as live", () => {
    const live = compose({ title: "بازگردانی", message: "به‌زودی حذف می‌شود", publish: true });
    const back = store.setAnnouncementStatus(live.id, "draft", adminId);
    if ("error" in back) throw new Error(back.error);
    expect(back.status).toBe("draft");
    const reloaded = store.listAnnouncements().find((a) => a.id === live.id);
    expect(reloaded?.status).toBe("draft");
  });

  it("updating an unknown id reports NOT_FOUND", () => {
    expect(store.setAnnouncementStatus("nope", "published", adminId)).toEqual({
      error: "NOT_FOUND",
    });
  });
});

// ============================================================
// Delivery through the real notification feed
// ============================================================

describe("delivery through deriveNotifications", () => {
  it("a published ALL announcement reaches every user; a draft reaches no one", () => {
    const live = compose({
      title: "اطلاعیه سراسری",
      message: "برای همه",
      audience: "ALL",
      publish: true,
    });
    const draft = compose({
      title: "پیش‌نویس محرمانه",
      message: "هنوز نه",
      audience: "ALL",
      publish: false,
    });

    for (const uid of [ordinaryId, lawyerId, otherId]) {
      const ids = authoredItems(uid).map((n) => n.id);
      expect(ids).toContain(`announcement:${live.id}`);
      expect(ids).not.toContain(`announcement:${draft.id}`);
    }
  });

  it("a LAWYERS announcement reaches only a role === LAWYER user", () => {
    const forLawyers = compose({
      title: "ویژه وکلا",
      message: "فقط برای وکلا",
      audience: "LAWYERS",
      publish: true,
    });
    const id = `announcement:${forLawyers.id}`;
    expect(authoredItems(lawyerId).map((n) => n.id)).toContain(id);
    expect(authoredItems(ordinaryId).map((n) => n.id)).not.toContain(id);
    expect(authoredItems(otherId).map((n) => n.id)).not.toContain(id);
  });

  it("a retracted announcement vanishes from every feed at once", () => {
    const live = compose({
      title: "موقت",
      message: "جمع‌آوری می‌شود",
      audience: "ALL",
      publish: true,
    });
    const id = `announcement:${live.id}`;
    expect(authoredItems(otherId).map((n) => n.id)).toContain(id);
    store.setAnnouncementStatus(live.id, "draft", adminId);
    expect(authoredItems(otherId).map((n) => n.id)).not.toContain(id);
  });

  it("authored notices live in the same 'public' category as the static catalog", () => {
    const live = compose({
      title: "دسته عمومی",
      message: "هم‌خانه با کاتالوگ",
      audience: "ALL",
      publish: true,
    });
    const item = db
      .deriveNotifications(otherId)
      .find((n) => n.id === `announcement:${live.id}`);
    expect(item?.category).toBe("public");
    expect(item?.read).toBe(false);
    // the static catalog is still present alongside it
    expect(db.deriveNotifications(otherId).some((n) => n.id.startsWith("ann:"))).toBe(true);
  });

  it("links ride through when a destination is provided", () => {
    const live = compose({
      title: "با لینک",
      message: "به ماشین‌حساب‌ها",
      href: "/calculators",
      actionLabel: "مشاهده",
      audience: "ALL",
      publish: true,
    });
    const item = db
      .deriveNotifications(otherId)
      .find((n) => n.id === `announcement:${live.id}`);
    expect(item?.href).toBe("/calculators");
    expect(item?.actionLabel).toBe("مشاهده");
  });
});

// ============================================================
// HTTP surface — dispatcher route
// ============================================================

describe("admin announcements API", () => {
  it("an ordinary user cannot compose — 403", async () => {
    const res = await adminPost(
      userReq(`${BASE}/announcements`, ordinarySession, {
        method: "POST",
        body: JSON.stringify({ title: "x", message: "y", audience: "ALL", publish: true }),
      }),
      segments("announcements")
    );
    expect(res.status).toBe(403);
  });

  it("an unauthenticated caller is refused — 401", async () => {
    const res = await adminPost(
      new Request(`${BASE}/announcements`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "x", message: "y", audience: "ALL", publish: true }),
      }) as unknown as NextRequest,
      segments("announcements")
    );
    expect(res.status).toBe(401);
  });

  it("POST composes and returns 201, and the note reaches the feed", async () => {
    const res = await adminPost(
      adminReq(`${BASE}/announcements`, {
        method: "POST",
        body: JSON.stringify({
          title: "از طریق API",
          message: "ثبت‌شده با درخواست واقعی",
          audience: "ALL",
          publish: true,
        }),
      }),
      segments("announcements")
    );
    expect(res.status).toBe(201);
    const { data } = (await res.json()) as { data: AdminAnnouncement };
    expect(data.status).toBe("published");
    expect(authoredItems(ordinaryId).map((n) => n.id)).toContain(`announcement:${data.id}`);
  });

  it("POST with an empty title is refused — 400 TITLE_REQUIRED", async () => {
    const res = await adminPost(
      adminReq(`${BASE}/announcements`, {
        method: "POST",
        body: JSON.stringify({ title: "  ", message: "y", audience: "ALL", publish: true }),
      }),
      segments("announcements")
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("TITLE_REQUIRED");
  });

  it("GET lists authored notices newest-first", async () => {
    const res = await adminGet(adminReq(`${BASE}/announcements`), segments("announcements"));
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { items: AdminAnnouncement[] } };
    expect(data.items.length).toBeGreaterThan(0);
    for (let i = 1; i < data.items.length; i += 1) {
      expect(data.items[i - 1]!.createdAt >= data.items[i]!.createdAt).toBe(true);
    }
  });

  it("PATCH publishes a draft and PATCH again retracts it", async () => {
    const draft = compose({
      title: "مدیریت وضعیت",
      message: "از HTTP",
      audience: "ALL",
      publish: false,
    });
    expect(authoredItems(ordinaryId).map((n) => n.id)).not.toContain(`announcement:${draft.id}`);

    const pub = await adminPatch(
      adminReq(`${BASE}/announcements/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "published" }),
      }),
      segments("announcements", draft.id)
    );
    expect(pub.status).toBe(200);
    expect(authoredItems(ordinaryId).map((n) => n.id)).toContain(`announcement:${draft.id}`);

    const retract = await adminPatch(
      adminReq(`${BASE}/announcements/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "draft" }),
      }),
      segments("announcements", draft.id)
    );
    expect(retract.status).toBe(200);
    expect(authoredItems(ordinaryId).map((n) => n.id)).not.toContain(
      `announcement:${draft.id}`
    );
  });

  it("PATCH with an unknown status is refused — 400 INVALID_STATUS", async () => {
    const live = compose({ title: "وضعیت بد", message: "نامعتبر", audience: "ALL", publish: true });
    const res = await adminPatch(
      adminReq(`${BASE}/announcements/${live.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "archived" }),
      }),
      segments("announcements", live.id)
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("INVALID_STATUS");
  });

  it("PATCH on an unknown id is refused — 404", async () => {
    const res = await adminPatch(
      adminReq(`${BASE}/announcements/missing`, {
        method: "PATCH",
        body: JSON.stringify({ status: "published" }),
      }),
      segments("announcements", "missing")
    );
    expect(res.status).toBe(404);
  });

  it("every mutation is recorded in the audit trail", async () => {
    const live = compose({ title: "قابل رهگیری", message: "ردیابی", audience: "ALL", publish: true });
    await adminPatch(
      adminReq(`${BASE}/announcements/${live.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "draft" }),
      }),
      segments("announcements", live.id)
    );
    const res = await adminGet(
      adminReq(`${BASE}/audit?resourceType=announcement`),
      segments("audit")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { items?: { action: string }[] } | { action: string }[];
    };
    const items = Array.isArray(body.data) ? body.data : (body.data.items ?? []);
    const actions = items.map((r) => r.action);
    expect(actions).toContain("announcement.create");
    expect(actions.some((a) => a === "announcement.publish" || a === "announcement.retract")).toBe(
      true
    );
  });
});
