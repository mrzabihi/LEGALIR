// @vitest-environment node
// ============================================================
// LEGALIR — Judicial review → final artifact · ACCEPTANCE (temp DB)
// ============================================================
// This is the §4/§5 acceptance path the UI depends on, proven end to end
// against the real route handlers and a real PDF render:
//
//   submit for review → operator note (visible / internal) → approve →
//   final artifact issued → owner downloads the exact stored bytes.
//
// The properties pinned here are the ones that would ship a WRONG or UNSAFE
// artifact if they regressed:
//
//   1. a submission opens exactly ONE review (idempotent, and a second
//      concurrent submission is refused);
//   2. INTERNAL notes never reach the owner's projection — filtered in the
//      persistence layer, not by a component;
//   3. deciding a review is server-authorized: a plain user and a read-only
//      operations role are both refused, not merely hidden in the nav;
//   4. approval names the version the reviewer read, and the server refuses
//      any other version id — the browser cannot approve text nobody saw;
//   5. approval issues the artifact in the SAME handler, ONCE: a repeat is
//      `REVIEW_CLOSED` and no second serial is minted;
//   6. the owner downloads byte-identical PDF bytes from private storage,
//      and a foreign reader sees a 404;
//   7. a tampered submitted version voids the approval instead of printing
//      text that no longer matches what was reviewed.
//
// `db.ts` resolves its store from the cwd at import time, so every module is
// imported DYNAMICALLY after chdir into a throwaway directory — a static
// import would bind (and mutate) the real dev DB. The two Vazirmatn files are
// copied into the temp dir so `renderJudicialPdf` renders a real sheet instead
// of failing with VAZIRMATN_MISSING.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type * as DbNS from "../db";
import type * as ReviewDbNS from "../judicial/review-db";
import type * as FinalizeNS from "../judicial/finalize";

type CollectionHandler = (req: NextRequest) => Promise<Response>;
type ItemHandler = (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
type DraftItemHandler = (
  req: NextRequest,
  ctx: { params: Promise<{ id: string; draftId: string }> }
) => Promise<Response>;
type AdminHandler = (
  req: NextRequest,
  ctx: { params: Promise<{ segments?: string[] }> }
) => Promise<Response>;

let db: typeof DbNS;
let reviewDb: typeof ReviewDbNS;
let finalize: typeof FinalizeNS;

let createRoute: { POST: CollectionHandler };
let answersRoute: { POST: ItemHandler };
let draftRoute: { POST: ItemHandler };
let draftsItemRoute: { PATCH: DraftItemHandler };
let reviewRoute: { GET: ItemHandler; POST: ItemHandler };
let finalDocRoute: { GET: ItemHandler };
let adminGet: AdminHandler;
let adminPatch: AdminHandler;

let ownerId: string;
let ownerSession: string;
let otherSession: string;
let reviewerSession: string;
let opsSession: string;
let plainSession: string;

let tmpDir: string;
let originalCwd: string;

const BASE = "http://localhost/api/v1/judicial/requests";
const ADMIN_BASE = "http://localhost/api/v1/admin";

function params(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function draftParams(id: string, draftId: string) {
  return { params: Promise.resolve({ id, draftId }) };
}

function segments(...parts: string[]): { params: Promise<{ segments?: string[] }> } {
  return { params: Promise.resolve({ segments: parts }) };
}

function req(url: string, session: string, init?: RequestInit): NextRequest {
  const request = new Request(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: `legalir-session=${session}`,
      ...(init?.headers ?? {}),
    },
  }) as Request & { nextUrl?: URL };
  // The App Router attaches `nextUrl`; the download route reads its query
  // string, so the stand-in has to carry the same field.
  request.nextUrl = new URL(url);
  return request as unknown as NextRequest;
}

interface ReviewBody {
  code: string;
  data: {
    review: {
      id: string;
      status: string;
      submittedVersionId: string;
      submittedVersionNumber: number;
      events: { kind: string; bodyFa: string | null; visibleToOwner: boolean }[];
    };
    replayed: boolean;
    finalDocument: { serialFa: string } | null;
  };
}

/**
 * Build a request with a complete statement, generate version 1, and return
 * the ids the review lane needs. Every test starts from its own request so a
 * failure in one cannot mask another.
 */
async function seedDraft(session = ownerSession): Promise<{
  requestId: string;
  draftId: string;
}> {
  const created = await createRoute.POST(
    req(BASE, session, {
      method: "POST",
      body: JSON.stringify({
        serviceId: "judicial_statement",
        startMode: "ai_draft",
        documentType: "statement",
        narrative:
          "مستأجر از پرداخت اجارهٔ دو ماه گذشته خودداری کرده و قرارداد اجاره موجود است.",
        idempotencyKey: `rq-${crypto.randomUUID()}`,
      }),
    })
  );
  expect(created.status).toBe(201);
  const requestId = ((await created.json()) as {
    data: { request: { id: string } };
  }).data.request.id;

  for (const [stepId, answers] of [
    ["parties", { addresseeName: "شرکت نمونه" }],
    [
      "claim",
      {
        claimKind: "debt",
        demandText: "مبلغ اجارهٔ معوق را ظرف ده روز پرداخت کنید.",
        hasPriorNotice: "false",
      },
    ],
  ] as const) {
    const saved = await answersRoute.POST(
      req(`${BASE}/${requestId}/answers`, session, {
        method: "POST",
        body: JSON.stringify({ stepId, answers, questionnaireVersion: 1 }),
      }),
      params(requestId)
    );
    expect(saved.status).toBe(200);
  }

  const generated = await draftRoute.POST(
    req(`${BASE}/${requestId}/draft`, session, {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: `gen-${crypto.randomUUID()}` }),
    }),
    params(requestId)
  );
  expect(generated.status).toBe(201);
  const draftId = ((await generated.json()) as {
    data: { draft: { id: string } };
  }).data.draft.id;
  return { requestId, draftId };
}

async function submitForReview(
  session: string,
  requestId: string,
  draftId: string,
  key = `rev-${crypto.randomUUID()}`
): Promise<{ status: number; body: ReviewBody }> {
  const res = await reviewRoute.POST(
    req(`${BASE}/${requestId}/review`, session, {
      method: "POST",
      body: JSON.stringify({ draftId, note: "برای بررسی ارسال شد.", idempotencyKey: key }),
    }),
    params(requestId)
  );
  return { status: res.status, body: (await res.json()) as ReviewBody };
}

async function ownerTimeline(
  requestId: string
): Promise<{ id: string; status: string; events: ReviewBody["data"]["review"]["events"] }[]> {
  const res = await reviewRoute.GET(
    req(`${BASE}/${requestId}/review`, ownerSession),
    params(requestId)
  );
  expect(res.status).toBe(200);
  return ((await res.json()) as {
    data: {
      items: {
        id: string;
        status: string;
        events: ReviewBody["data"]["review"]["events"];
      }[];
    };
  }).data.items;
}

/** The admin envelope as these tests read it: `data` on success, `code` on refusal. */
interface AdminActionBody {
  code?: string;
  data?: { finalDocument: { serialFa: string } | null };
}

async function adminAction(
  session: string,
  reviewId: string,
  body: Record<string, unknown>
): Promise<{ status: number; body: AdminActionBody }> {
  const res = await adminPatch(
    req(`${ADMIN_BASE}/judicial/reviews/${reviewId}`, session, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    segments("judicial", "reviews", reviewId)
  );
  return { status: res.status, body: (await res.json()) as AdminActionBody };
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-judicial-issuance-"));
  process.chdir(tmpDir);

  // The PDF renderer resolves the font from the cwd; give the temp DB the
  // same two files the app ships with so issuance runs for real. The package
  // is hoisted to the workspace root, so look in both places (the same
  // candidates `pdf-rtl.test.ts` uses).
  const fontDir = [
    path.join(originalCwd, "node_modules", "vazirmatn", "fonts", "ttf"),
    path.join(originalCwd, "..", "..", "node_modules", "vazirmatn", "fonts", "ttf"),
  ].find((dir) => fs.existsSync(path.join(dir, "Vazirmatn-Regular.ttf")));
  expect(fontDir, "vazirmatn fonts must be installed").toBeTruthy();
  const fontTarget = path.join(tmpDir, "node_modules", "vazirmatn", "fonts", "ttf");
  fs.mkdirSync(fontTarget, { recursive: true });
  for (const file of ["Vazirmatn-Regular.ttf", "Vazirmatn-Bold.ttf"]) {
    fs.copyFileSync(path.join(fontDir!, file), path.join(fontTarget, file));
  }

  db = await import("../db");
  reviewDb = await import("../judicial/review-db");
  finalize = await import("../judicial/finalize");

  createRoute = await import("@/app/api/v1/judicial/requests/route");
  answersRoute = await import("@/app/api/v1/judicial/requests/[id]/answers/route");
  draftRoute = await import("@/app/api/v1/judicial/requests/[id]/draft/route");
  draftsItemRoute = await import("@/app/api/v1/judicial/requests/[id]/drafts/[draftId]/route");
  reviewRoute = await import("@/app/api/v1/judicial/requests/[id]/review/route");
  finalDocRoute = await import("@/app/api/v1/judicial/requests/[id]/final-document/route");

  const adminRoute = await import("@/app/api/v1/admin/[[...segments]]/route");
  adminGet = adminRoute.GET as unknown as AdminHandler;
  adminPatch = adminRoute.PATCH as unknown as AdminHandler;

  const owner = db.createUser({ mobile: "09122000001", passwordHash: "x" });
  ownerId = owner.id;
  ownerSession = db.createSession(ownerId).id;

  otherSession = db.createSession(
    db.createUser({ mobile: "09122000002", passwordHash: "x" }).id
  ).id;

  const reviewer = db.createUser({ mobile: "09122000003", passwordHash: "x" });
  db.setUserRole(reviewer.id, "ADMIN");
  reviewerSession = db.createSession(reviewer.id).id;

  const ops = db.createUser({ mobile: "09122000004", passwordHash: "x" });
  db.setUserRole(ops.id, "ADMIN_OPS");
  opsSession = db.createSession(ops.id).id;

  plainSession = db.createSession(
    db.createUser({ mobile: "09122000005", passwordHash: "x" }).id
  ).id;
}, 60_000);

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// 1. Submission opens exactly one review
// ============================================================

describe("submission opens exactly one review", () => {
  it("opens one review, replays the same key, and refuses a second concurrent one", async () => {
    const { requestId, draftId } = await seedDraft();
    const key = `rev-${crypto.randomUUID()}`;

    const first = await submitForReview(ownerSession, requestId, draftId, key);
    expect(first.status).toBe(201);
    expect(first.body.data.review.status).toBe("pending");
    expect(first.body.data.review.submittedVersionId).toBe(draftId);
    expect(first.body.data.replayed).toBe(false);

    // The request itself moved to «در حال بررسی», not to an invented state.
    const itemRoute = await import("@/app/api/v1/judicial/requests/[id]/route");
    const row = await itemRoute.GET(
      req(`${BASE}/${requestId}`, ownerSession),
      params(requestId)
    );
    const request = ((await row.json()) as {
      data: { request: { status: string } };
    }).data.request;
    expect(request.status).toBe("under_review");

    const replay = await submitForReview(ownerSession, requestId, draftId, key);
    expect(replay.status).toBe(200);
    expect(replay.body.data.replayed).toBe(true);
    expect(replay.body.data.review.id).toBe(first.body.data.review.id);

    const second = await submitForReview(ownerSession, requestId, draftId);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("ALREADY_IN_REVIEW");

    expect(reviewDb.listReviewsForRequest(ownerId, requestId)).toHaveLength(1);
  });
});

// ============================================================
// 2. Internal notes never reach the owner
// ============================================================

describe("internal notes stay inside the review lane", () => {
  it("keeps an internal note out of the owner's timeline while the detail shows it", async () => {
    const { requestId, draftId } = await seedDraft();
    const submitted = await submitForReview(ownerSession, requestId, draftId);
    expect(submitted.status).toBe(201);
    const reviewId = submitted.body.data.review.id;

    const internal = await adminAction(reviewerSession, reviewId, {
      action: "note",
      noteFa: "یادداشت داخلی: پیش‌نویس نیازمند تطبیق با قرارداد پیوست است.",
      internalNote: true,
    });
    expect(internal.status).toBe(200);

    const publicNote = await adminAction(reviewerSession, reviewId, {
      action: "note",
      noteFa: "لطفاً شمارهٔ قرارداد را در متن ذکر کنید.",
    });
    expect(publicNote.status).toBe(200);

    const mine = await ownerTimeline(requestId);
    const ownerEvents = mine[0]!.events;
    expect(ownerEvents.some((e) => (e.bodyFa ?? "").includes("یادداشت داخلی"))).toBe(false);
    expect(ownerEvents.some((e) => (e.bodyFa ?? "").includes("شمارهٔ قرارداد"))).toBe(true);

    // The operator workspace still carries it — the note was recorded, not dropped.
    const adminDetailRes = await adminGet(
      req(`${ADMIN_BASE}/judicial/reviews/${reviewId}`, reviewerSession),
      segments("judicial", "reviews", reviewId)
    );
    expect(adminDetailRes.status).toBe(200);
    const adminDetail = ((await adminDetailRes.json()) as {
      data: { internalEvents: { bodyFa: string | null }[] };
    }).data;
    expect(
      adminDetail.internalEvents.some((e) => (e.bodyFa ?? "").includes("یادداشت داخلی"))
    ).toBe(true);
  });
});

// ============================================================
// 3. Deciding a review is server-authorized
// ============================================================

describe("only a reviewer role may decide", () => {
  it("refuses a plain user and a read-only operations role", async () => {
    const { requestId, draftId } = await seedDraft();
    const submitted = await submitForReview(ownerSession, requestId, draftId);
    const reviewId = submitted.body.data.review.id;

    const asUser = await adminAction(plainSession, reviewId, {
      action: "approve",
      versionId: draftId,
    });
    expect(asUser.status).toBe(403);

    // ADMIN_OPS holds `admin:judicial:read` but not `admin:judicial:review`.
    const asOps = await adminAction(opsSession, reviewId, {
      action: "approve",
      versionId: draftId,
    });
    expect(asOps.status).toBe(403);

    expect(reviewDb.getReviewById(reviewId)?.status).toBe("pending");
    expect(reviewDb.getFinalDocumentForRequest(requestId)).toBeNull();
  });
});

// ============================================================
// 4–6. Approval issues the artifact exactly once
// ============================================================

describe("approval issues exactly one artifact", () => {
  it("refuses an unnamed version, then issues, then replays nothing", async () => {
    const { requestId, draftId } = await seedDraft();
    const submitted = await submitForReview(ownerSession, requestId, draftId);
    const reviewId = submitted.body.data.review.id;

    const unnamed = await adminAction(reviewerSession, reviewId, { action: "approve" });
    expect(unnamed.status).toBe(400);
    expect(unnamed.body.code).toBe("VERSION_REQUIRED");
    expect(reviewDb.getFinalDocumentForRequest(requestId)).toBeNull();

    const approved = await adminAction(reviewerSession, reviewId, {
      action: "approve",
      versionId: draftId,
      noteFa: "متن تأیید شد.",
    });
    expect(approved.status).toBe(200);

    const serialFa = approved.body.data!.finalDocument!.serialFa;
    // «LGR-JD-۱۴۰۵-۰۰۰۰۰۱» — the year and sequence are Persian digits.
    expect(serialFa).toMatch(/^LGR-JD-۱۴۰۵-[۰-۹]{6}$/);

    const review = reviewDb.getReviewById(reviewId)!;
    expect(review.status).toBe("approved");

    const issued = reviewDb.getFinalDocumentForRequest(requestId)!;
    expect(issued.serialFa).toBe(serialFa);
    expect(issued.versionId).toBe(draftId);
    expect(issued.documentHash).toBe(review.submittedTextHash);
    expect(issued.pageCount).toBeGreaterThan(0);
    // One register row, not two.
    expect(
      db
        .readTable<{ requestId: string }>("judicial_final_documents")
        .filter((d) => d.requestId === requestId)
    ).toHaveLength(1);

    // A second approval is refused outright — no second artifact.
    const again = await adminAction(reviewerSession, reviewId, {
      action: "approve",
      versionId: draftId,
    });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("REVIEW_CLOSED");
    expect(
      db
        .readTable<{ requestId: string }>("judicial_final_documents")
        .filter((d) => d.requestId === requestId)
    ).toHaveLength(1);

    // `issueFinalDocument` is itself idempotent: calling it again replays.
    const replay = await finalize.issueFinalDocument({
      reviewId,
      actorLabelFa: "کارشناس",
    });
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.replayed).toBe(true);
      expect(replay.document.serialFa).toBe(serialFa);
    }
  });

  it("ships the stored bytes to the owner and 404s a foreign reader", async () => {
    const { requestId, draftId } = await seedDraft();
    const submitted = await submitForReview(ownerSession, requestId, draftId);
    const reviewId = submitted.body.data.review.id;

    const approved = await adminAction(reviewerSession, reviewId, {
      action: "approve",
      versionId: draftId,
    });
    expect(approved.status).toBe(200);

    const issued = reviewDb.getFinalDocumentForRequest(requestId)!;

    const download = await finalDocRoute.GET(
      req(`${BASE}/${requestId}/final-document?download=1`, ownerSession),
      params(requestId)
    );
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toBe("application/pdf");
    expect(download.headers.get("content-disposition")).toContain("attachment");
    expect(download.headers.get("x-document-sha256")).toBe(issued.pdfHash);
    expect(download.headers.get("cache-control")).toContain("no-store");

    // The bytes are the ones written at issuance, from PRIVATE storage.
    const bytes = new Uint8Array(await download.arrayBuffer());
    expect(bytes.byteLength).toBe(issued.sizeBytes);
    expect(bytes.byteLength).toBeGreaterThan(1_000);
    const header = new TextDecoder("latin1").decode(bytes.subarray(0, 5));
    expect(header).toBe("%PDF-");
    const stored = path.join(tmpDir, ".data", "judicial-documents", issued.storageKey);
    expect(fs.readFileSync(stored).byteLength).toBe(issued.sizeBytes);

    // A different account cannot tell the artifact exists.
    const foreign = await finalDocRoute.GET(
      req(`${BASE}/${requestId}/final-document`, otherSession),
      params(requestId)
    );
    expect(foreign.status).toBe(404);

    // The owner's own timeline records the issuance without exposing internals.
    const mine = await ownerTimeline(requestId);
    expect(mine[0]!.events.some((e) => e.kind === "final_issued")).toBe(true);
  });
});

// ============================================================
// 7. A changed submitted version voids the approval
// ============================================================

describe("stale text never gets printed", () => {
  it("refuses approval when the submitted version no longer hashes to the review", async () => {
    const { requestId, draftId } = await seedDraft();
    const submitted = await submitForReview(ownerSession, requestId, draftId);
    const reviewId = submitted.body.data.review.id;

    // Simulate a version row that was rewritten out from under the review
    // (a migration, a bad import) — not something the API allows.
    const rows = db.readTable<{ id: string; text: string }>("judicial_draft_versions");
    const idx = rows.findIndex((d) => d.id === draftId);
    expect(idx).toBeGreaterThanOrEqual(0);
    rows[idx] = { ...rows[idx]!, text: `${rows[idx]!.text}\nمتن افزوده‌شده پس از ارسال` };
    db.writeTable("judicial_draft_versions", rows);

    const refused = await adminAction(reviewerSession, reviewId, {
      action: "approve",
      versionId: draftId,
    });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe("STALE_VERSION");
    expect(reviewDb.getReviewById(reviewId)?.status).toBe("pending");
    expect(reviewDb.getFinalDocumentForRequest(requestId)).toBeNull();
  });

  it("still approves the submitted snapshot after the owner edits a new version", async () => {
    const { requestId, draftId } = await seedDraft();
    const submitted = await submitForReview(ownerSession, requestId, draftId);
    const reviewId = submitted.body.data.review.id;

    // The owner revises while the review is open: a NEW immutable version is
    // appended; version 1 — the text the reviewer read — is untouched.
    const revised = await draftsItemRoute.PATCH(
      req(`${BASE}/${requestId}/drafts/${draftId}`, ownerSession, {
        method: "PATCH",
        body: JSON.stringify({ text: "متن ویرایش‌شده توسط کاربر برای نسخهٔ بعد." }),
      }),
      draftParams(requestId, draftId)
    );
    expect(revised.status).toBe(200);
    const versions = (
      (await revised.json()) as { data: { drafts: { version: number }[] } }
    ).data.drafts;
    expect(versions.length).toBeGreaterThanOrEqual(2);

    const approved = await adminAction(reviewerSession, reviewId, {
      action: "approve",
      versionId: draftId,
    });
    expect(approved.status).toBe(200);

    // The artifact records the version that was reviewed, not the newer edit.
    const issued = reviewDb.getFinalDocumentForRequest(requestId)!;
    expect(issued.versionId).toBe(draftId);
    expect(issued.versionNumber).toBe(submitted.body.data.review.submittedVersionNumber);
  });
});
