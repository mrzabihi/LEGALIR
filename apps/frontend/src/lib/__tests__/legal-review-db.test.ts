// ============================================================
// LEGALIR — Per-type legal review store + revision route (temp DB)
// ============================================================
// §7 of the contract brief: clause citations and «قبل از امضا» tips are
// stored in the DB with a content VERSION, and an authorised reviewer can
// correct them without a deploy. This drives the real route handlers plus
// the store against an isolated temp DB:
//
//   • every type reports its clauses with a real printed heading;
//   • a stored record REPLACES the seed for that clause (never merged);
//   • a second save of the same (type, clause, article) bumps the version;
//   • an invalid save is refused with a named error code;
//   • tips fall back to the seed until a stored row exists, and back again
//     after the stored row is deleted;
//   • every write lands in the platform audit trail.
//
// `db.ts` resolves its store from the cwd at import time, so every module is
// imported DYNAMICALLY after chdir. A static import would bind the real dev
// DB — see the team convention.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type * as DbModule from "../db";
import type * as LegalReviewDbModule from "../contracts/legal-review-db";
import type * as LegalBasisModule from "../contracts/legal-basis";

type Db = typeof DbModule;
type LegalReviewDb = typeof LegalReviewDbModule;

let db: Db;
let legalDb: LegalReviewDb;
let legalBasis: typeof LegalBasisModule;

let adminSession: string;
let userSession: string;
let tmpDir: string;
let originalCwd: string;

type Handler = (req: NextRequest) => Promise<Response>;
let GET: Handler;
let POST: Handler;
let DELETE: Handler;

const ROUTE = "http://localhost/api/v1/admin/legal-review";
// A clause the SEED cites for property_rent — so the stored-vs-seed
// replacement is observable on a real, rendered clause.
const SEEDED_CLAUSE = "rent.costs";

function req(url: string, method: string, session: string, body?: unknown): NextRequest {
  const request = new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      cookie: `legalir-session=${session}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // The route reads the query through `nextUrl`; a bare Request has none.
  Object.defineProperty(request, "nextUrl", { value: new URL(url) });
  return request as unknown as NextRequest;
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-legal-review-"));
  process.chdir(tmpDir);

  db = await import("../db");
  legalDb = await import("../contracts/legal-review-db");
  legalBasis = await import("../contracts/legal-basis");

  const admin = db.createUser({ mobile: "09120000401", passwordHash: "x" });
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminSession = db.createSession(admin.id).id;

  // A plain user with no admin permission at all.
  const user = db.createUser({ mobile: "09120000402", passwordHash: "x" });
  userSession = db.createSession(user.id).id;

  const route = await import("@/app/api/v1/admin/legal-review/route");
  GET = route.GET as unknown as Handler;
  POST = route.POST as unknown as Handler;
  DELETE = route.DELETE as unknown as Handler;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================

describe("GET — the per-type legal review report", () => {
  it("refuses a caller without the review permission", async () => {
    const res = await GET(req(ROUTE, "GET", userSession));
    expect(res.status).toBe(403);
  });

  it("returns every type, and labels each clause with its printed heading", async () => {
    const res = await GET(req(ROUTE, "GET", adminSession));
    expect(res.status).toBe(200);

    const { data } = await json<{
      data: {
        types: {
          typeId: string;
          typeFa: string;
          report: {
            clauses: {
              clauseId: string;
              clauseHeadingFa: string;
              overridden: boolean;
              seeded: { articleFa: string; status: string }[];
            }[];
            tips: unknown[];
            unflaggedCount: number;
          };
        }[];
      };
    }>(res);

    expect(data.types.length).toBeGreaterThan(5);

    const rent = data.types.find((t) => t.typeId === "property_rent");
    expect(rent).toBeTruthy();
    expect(rent!.typeFa).toBeTruthy();

    // The seeded clause is reported as NOT overridden and labelled with the
    // real heading from the renderer, never the raw clause id.
    const seeded = rent!.report.clauses.find((c) => c.clauseId === SEEDED_CLAUSE);
    expect(seeded).toBeTruthy();
    expect(seeded!.overridden).toBe(false);
    expect(seeded!.seeded.length).toBeGreaterThan(0);
    expect(seeded!.clauseHeadingFa).toContain("ماده");
    expect(seeded!.clauseHeadingFa).not.toBe(SEEDED_CLAUSE);

    // §7 — a type with no stored tips still shows the seed tips.
    expect(rent!.report.tips.length).toBeGreaterThan(0);
  });

  it("filters by ?type= and 404s an unknown type", async () => {
    const one = await GET(req(`${ROUTE}?type=property_sale`, "GET", adminSession));
    expect(one.status).toBe(200);
    const filtered = await json<{ data: { types: { typeId: string }[] } }>(one);
    expect(filtered.data.types.map((t) => t.typeId)).toEqual(["property_sale"]);

    const bad = await GET(req(`${ROUTE}?type=not_a_type`, "GET", adminSession));
    expect(bad.status).toBe(404);
  });
});

describe("POST — a save is versioned and replaces the seed", () => {
  const REVISED_NOTE =
    "هزینه‌های لازم برای نگه‌داشتن ملک بر عهدهٔ مالک است، مگر آنکه خلاف آن صریحاً توافق شود.";

  it("refuses a note shorter than the reviewed minimum", async () => {
    const res = await POST(
      req(ROUTE, "POST", adminSession, {
        kind: "clause",
        contractType: "property_rent",
        clauseId: SEEDED_CLAUSE,
        sourceNameFa: "قانون مدنی",
        articleFa: "ماده ۴۸۶ قانون مدنی",
        noteFa: "کوتاه",
        status: "reviewed",
      })
    );
    expect(res.status).toBe(400);
    const body = await json<{ code: string }>(res);
    expect(body.code).toBe("NOTE_REQUIRED");
  });

  it("creates version 1, then bumps to version 2 on the second save", async () => {
    const first = await POST(
      req(ROUTE, "POST", adminSession, {
        kind: "clause",
        contractType: "property_rent",
        clauseId: SEEDED_CLAUSE,
        sourceNameFa: "قانون مدنی",
        articleFa: "ماده ۴۸۶ قانون مدنی",
        noteFa: REVISED_NOTE,
        status: "reviewed",
      })
    );
    expect(first.status).toBe(200);
    const created = await json<{
      data: {
        record: { id: string; contentVersion: number; reviewedAt: string; status: string };
        previous: unknown;
        report: {
          clauses: { clauseId: string; overridden: boolean; records: { id: string }[] }[];
          reviewedClauseCount: number;
        };
      };
    }>(first);

    expect(created.data.record.id).toMatch(/^lcr-/);
    expect(created.data.record.contentVersion).toBe(1);
    expect(created.data.record.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(created.data.previous).toBeNull();

    // The report now shows the clause as OVERRIDDEN and no longer falls back.
    const row = created.data.report.clauses.find((c) => c.clauseId === SEEDED_CLAUSE);
    expect(row?.overridden).toBe(true);
    expect(row?.records.map((r) => r.id)).toContain(created.data.record.id);

    const second = await POST(
      req(ROUTE, "POST", adminSession, {
        kind: "clause",
        contractType: "property_rent",
        clauseId: SEEDED_CLAUSE,
        sourceNameFa: "قانون مدنی",
        articleFa: "ماده ۴۸۶ قانون مدنی",
        noteFa: `${REVISED_NOTE} (بازبینی دوم)`,
        status: "reviewed",
      })
    );
    expect(second.status).toBe(200);
    const revised = await json<{
      data: {
        record: { id: string; contentVersion: number };
        previous: { contentVersion: number } | null;
      };
    }>(second);

    expect(revised.data.record.id).toBe(created.data.record.id);
    expect(revised.data.record.contentVersion).toBe(2);
    expect(revised.data.previous?.contentVersion).toBe(1);

    // The merged catalog — the read path every annex uses — now carries the
    // STORED citation (note + version), not the seeded one.
    const merged = legalDb.mergedLegalBasisCatalog();
    const citations = merged.property_rent?.[SEEDED_CLAUSE] ?? [];
    expect(citations).toHaveLength(1);
    expect(citations[0]!.noteFa).toContain("بازبینی دوم");
    expect(citations[0]!.contentVersion).toBe(2);

    // The audit trail records the write with before → after.
    const audit = db
      .readTable<{ action: string; resourceId: string; after: { contentVersion?: number } }>(
        "admin_audit_log"
      )
      .filter((a) => a.action === "contract.legal_review.clause_saved");
    expect(audit.length).toBeGreaterThanOrEqual(2);
    expect(audit.at(-1)!.after.contentVersion).toBe(2);
  });

  it("stores tips wholesale, and the seed returns once they are deleted", async () => {
    const seeded = legalDb.preSignTipsForType("property_rent");
    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded[0]!.id.startsWith("tip-seed-")).toBe(true);

    const res = await POST(
      req(ROUTE, "POST", adminSession, {
        kind: "tip",
        contractType: "property_rent",
        titleFa: "بازبینی سند مالکیت",
        bodyFa: "پیش از امضا، اصالت سند مالکیت و تطابق آن با ملک را بررسی کنید.",
        sourceNameFa: "قانون مدنی",
        order: 1,
        status: "reviewed",
      })
    );
    expect(res.status).toBe(200);
    const saved = await json<{
      data: { tip: { id: string; contentVersion: number; status: string } };
    }>(res);
    expect(saved.data.tip.id).toMatch(/^tip-/);
    expect(saved.data.tip.contentVersion).toBe(1);

    // Stored rows win WHOLESALE — the seed tips are not merged in.
    const after = legalDb.preSignTipsForType("property_rent");
    expect(after).toHaveLength(1);
    expect(after[0]!.id).toBe(saved.data.tip.id);

    // A tip save is audited too (it changes what every contract prints).
    const audit = db
      .readTable<{ action: string }>("admin_audit_log")
      .filter((a) => a.action === "contract.legal_review.tip_saved");
    expect(audit.length).toBe(1);

    const removed = await DELETE(
      req(
        `${ROUTE}?kind=tip&id=${encodeURIComponent(saved.data.tip.id)}&reason=test`,
        "DELETE",
        adminSession
      )
    );
    expect(removed.status).toBe(200);

    // With no stored row left, the seed applies again.
    const restored = legalDb.preSignTipsForType("property_rent");
    expect(restored.length).toBe(seeded.length);
    expect(restored[0]!.id.startsWith("tip-seed-")).toBe(true);
  });

  it("deletes a stored clause record so the seed citation applies again", async () => {
    const records = legalDb.listLegalClauseRecords("property_rent");
    const record = records.find((r) => r.clauseId === SEEDED_CLAUSE);
    expect(record).toBeTruthy();

    const res = await DELETE(
      req(`${ROUTE}?kind=clause&id=${encodeURIComponent(record!.id)}`, "DELETE", adminSession)
    );
    expect(res.status).toBe(200);

    expect(legalDb.listLegalClauseRecords("property_rent")).toHaveLength(0);
    const res2 = await GET(req(`${ROUTE}?type=property_rent`, "GET", adminSession));
    const { data } = await json<{
      data: { types: { report: { clauses: { clauseId: string; overridden: boolean }[] } }[] };
    }>(res2);
    const row = data.types[0]!.report.clauses.find((c) => c.clauseId === SEEDED_CLAUSE);
    expect(row?.overridden).toBe(false);
  });

  it("marks an uncited clause as flagged instead of inventing a source", async () => {
    const def = legalBasis.LEGAL_BASIS_SEED.property_rent ?? {};
    // A clause the seed does NOT cite must be flagged, not silently omitted.
    const uncited = "common.parties";
    expect(def[uncited]).toBeUndefined();

    const report = legalDb.legalReviewTypeSummary("property_rent");
    const row = report.clauses.find((c) => c.clauseId === uncited);
    expect(row).toBeTruthy();
    expect(row!.overridden).toBe(false);
    expect(row!.seeded).toHaveLength(0);
    expect(report.unflaggedCount).toBeGreaterThan(0);
  });
});
