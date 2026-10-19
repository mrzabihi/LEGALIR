// ============================================================
// LEGALIR — Tracked order lane · END-TO-END (temp DB)
// ============================================================
// The two provider services never draft a document; they record a real
// request an operator moves by hand. These tests pin the rules that would
// otherwise produce a request nobody can act on:
//
//   • an order can only target a service whose projection says
//     `request_only` — a drafting service is refused, and so is a service
//     switched off after the draft existed;
//   • submitting re-validates the required intake fields on the SERVER, so
//     hiding the browser check is not a way past it;
//   • the credit check cannot be submitted without the consent declaration;
//   • every access is owner-scoped — a foreign order id is a 404;
//   • cancelling is a withdrawal (`cancelled`), never a row deletion;
//   • the form mapping round-trips what the operator will read.
//
// `db.ts` binds its store from the cwd at import time, so every module is
// imported DYNAMICALLY after chdir into a throwaway directory.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type * as DbNS from "../db";
import type * as FlagsNS from "../admin/flags";

let db: typeof DbNS;
let flags: typeof FlagsNS;
let ordersRoute: {
  GET: (r: NextRequest) => Promise<Response>;
  POST: (r: NextRequest) => Promise<Response>;
};
let orderRoute: {
  GET: (r: NextRequest, c: { params: Promise<{ orderId: string }> }) => Promise<Response>;
  PATCH: (r: NextRequest, c: { params: Promise<{ orderId: string }> }) => Promise<Response>;
  DELETE: (r: NextRequest, c: { params: Promise<{ orderId: string }> }) => Promise<Response>;
};
let submitRoute: {
  POST: (r: NextRequest, c: { params: Promise<{ orderId: string }> }) => Promise<Response>;
};

let ownerSession: string;
let otherSession: string;
let adminId: string;

let tmpDir: string;
let originalCwd: string;

const BASE = "http://localhost/api/v1/judicial/orders";

function params(orderId: string): { params: Promise<{ orderId: string }> } {
  return { params: Promise.resolve({ orderId }) };
}

function req(url: string, session: string, init?: RequestInit): NextRequest {
  return new Request(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: `legalir-session=${session}`,
      ...(init?.headers ?? {}),
    },
  }) as unknown as NextRequest;
}

interface OrderBody {
  code: string;
  message: string;
  fieldErrors: Record<string, string>;
  data: {
    order: {
      id: string;
      status: string;
      serviceId: string;
      titleFa: string;
      answers: { fieldId: string; labelFa: string; value: string }[];
      attachmentIds: string[];
      submittedAt: string | null;
      deliveryDocumentId: string | null;
    };
    replayed: boolean;
  };
}

const CRIMINAL_ANSWERS = [
  { fieldId: "subject_name", labelFa: "نام و نام خانوادگی صاحب گواهی", value: "سارا محمدی" },
  { fieldId: "relation", labelFa: "نسبت شما با صاحب گواهی", value: "خودم" },
  { fieldId: "reason", labelFa: "علت درخواست گواهی", value: "استخدام در شرکت خصوصی" },
];

async function createOrder(
  session: string,
  over: Record<string, unknown> = {}
): Promise<{ status: number; data: OrderBody }> {
  const body = {
    serviceId: "judicial_criminal_record",
    titleFa: "عدم سوءپیشینه — سارا محمدی",
    answers: CRIMINAL_ANSWERS,
    submit: false,
    idempotencyKey: `ord-${crypto.randomUUID()}`,
    ...over,
  };
  const res = await ordersRoute.POST(
    req(BASE, session, { method: "POST", body: JSON.stringify(body) })
  );
  return { status: res.status, data: await res.json() };
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-judicial-orders-"));
  process.chdir(tmpDir);

  db = await import("../db");
  flags = await import("../admin/flags");

  ordersRoute = await import("@/app/api/v1/judicial/orders/route");
  orderRoute = await import("@/app/api/v1/judicial/orders/[orderId]/route");
  submitRoute = await import("@/app/api/v1/judicial/orders/[orderId]/submit/route");

  const owner = db.createUser({ mobile: "09122000001", passwordHash: "x" });
  ownerSession = db.createSession(owner.id).id;

  const other = db.createUser({ mobile: "09122000002", passwordHash: "x" });
  otherSession = db.createSession(other.id).id;

  const admin = db.createUser({ mobile: "09122000009", passwordHash: "x" });
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminId = admin.id;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// Creation
// ============================================================

describe("order creation", () => {
  it("creates a draft for a request_only service and replays the same key", async () => {
    const key = `ord-${crypto.randomUUID()}`;
    const first = await createOrder(ownerSession, { idempotencyKey: key });
    expect(first.status).toBe(201);
    expect(first.data.data.order.status).toBe("draft");

    const replay = await createOrder(ownerSession, { idempotencyKey: key });
    expect(replay.status).toBe(200);
    expect(replay.data.data.replayed).toBe(true);
    expect(replay.data.data.order.id).toBe(first.data.data.order.id);
  });

  it("refuses an order for a drafting service", async () => {
    const res = await createOrder(ownerSession, {
      serviceId: "judicial_petition",
      answers: [],
    });
    expect(res.status).toBe(409);
    expect(res.data.code).toBe("SERVICE_NOT_ORDER_ONLY");
  });

  it("drops attachment ids the caller does not own", async () => {
    const res = await createOrder(ownerSession, {
      attachmentIds: ["doc-of-someone-else", "also-not-mine"],
    });
    expect(res.status).toBe(201);
    const id = res.data.data.order.id;
    const read = await orderRoute.GET(req(`${BASE}/${id}`, ownerSession), params(id));
    expect(read.status).toBe(200);
    expect((await read.json()).data.order.attachmentIds).toEqual([]);
  });

  it("is not reachable for another user's order", async () => {
    const created = await createOrder(ownerSession);
    const id = created.data.data.order.id;
    const res = await orderRoute.GET(req(`${BASE}/${id}`, otherSession), params(id));
    expect(res.status).toBe(404);
  });
});

// ============================================================
// Server-side submit validation
// ============================================================

describe("submit validation", () => {
  it("refuses a submit with no answers while the draft is still allowed", async () => {
    const created = await createOrder(ownerSession, {
      answers: [],
      submit: true,
    });
    expect(created.status).toBe(400);
    expect(created.data.fieldErrors["subject_name"]).toBeTruthy();
  });

  it("refuses a credit-check submit without the consent declaration", async () => {
    const created = await createOrder(ownerSession, {
      serviceId: "judicial_credit_check",
      titleFa: "استعلام اعتبار — شرکت الف",
      answers: [
        { fieldId: "subject_name", labelFa: "نام صاحب داده", value: "شرکت الف" },
        { fieldId: "subject_kind", labelFa: "نوع شخص", value: "شخص حقوقی" },
        { fieldId: "transaction", labelFa: "موضوع معامله", value: "پیش‌پرداخت" },
      ],
      purposeFa: "ارزیابی اعتبار پیش از معامله",
      submit: false,
    });
    expect(created.status).toBe(201);

    const id = created.data.data.order.id;
    const res = await submitRoute.POST(
      req(`${BASE}/${id}/submit`, ownerSession, { method: "POST", body: "{}" }),
      params(id)
    );
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors["consent"]).toBeTruthy();
  });

  it("submits a complete order exactly once", async () => {
    const created = await createOrder(ownerSession);
    const id = created.data.data.order.id;

    const res = await submitRoute.POST(
      req(`${BASE}/${id}/submit`, ownerSession, { method: "POST", body: "{}" }),
      params(id)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.order.status).toBe("submitted");
    expect(body.data.order.submittedAt).toBeTruthy();

    // A submitted record is not silently re-opened.
    const again = await submitRoute.POST(
      req(`${BASE}/${id}/submit`, ownerSession, { method: "POST", body: "{}" }),
      params(id)
    );
    expect(again.status).toBe(409);
  });

  it("closes both creation and submit when the service flag is switched off", async () => {
    const draft = await createOrder(ownerSession);
    const id = draft.data.data.order.id;

    flags.updateFlag("judicial_criminal_record", { status: "off" }, adminId);
    try {
      const blockedCreate = await createOrder(ownerSession);
      expect(blockedCreate.status).toBe(409);
      expect(blockedCreate.data.code).toBe("SERVICE_UNAVAILABLE");

      const blockedSubmit = await submitRoute.POST(
        req(`${BASE}/${id}/submit`, ownerSession, { method: "POST", body: "{}" }),
        params(id)
      );
      expect(blockedSubmit.status).toBe(409);
      expect((await blockedSubmit.json()).code).toBe("SERVICE_UNAVAILABLE");

      // The existing draft stays readable — previous work is never removed.
      const readable = await orderRoute.GET(
        req(`${BASE}/${id}`, ownerSession),
        params(id)
      );
      expect(readable.status).toBe(200);
      expect((await readable.json()).data.order.status).toBe("draft");
    } finally {
      flags.updateFlag("judicial_criminal_record", { status: "on" }, adminId);
    }
  });
});

// ============================================================
// Withdrawal
// ============================================================

describe("withdrawal", () => {
  it("cancels instead of deleting, and a cancelled order stays readable", async () => {
    const created = await createOrder(ownerSession);
    const id = created.data.data.order.id;

    const res = await orderRoute.DELETE(
      req(`${BASE}/${id}`, ownerSession, { method: "DELETE" }),
      params(id)
    );
    expect(res.status).toBe(200);

    const readable = await orderRoute.GET(
      req(`${BASE}/${id}`, ownerSession),
      params(id)
    );
    expect(readable.status).toBe(200);
    expect((await readable.json()).data.order.status).toBe("cancelled");

    // A second cancel has nothing left to do.
    const again = await orderRoute.DELETE(
      req(`${BASE}/${id}`, ownerSession, { method: "DELETE" }),
      params(id)
    );
    expect(again.status).toBe(409);
  });

  it("edits a draft but never a submitted record", async () => {
    const created = await createOrder(ownerSession, { submit: true });
    const id = created.data.data.order.id;
    expect(created.data.data.order.status).toBe("submitted");

    const res = await orderRoute.PATCH(
      req(`${BASE}/${id}`, ownerSession, {
        method: "PATCH",
        body: JSON.stringify({ titleFa: "عنوان تازه" }),
      }),
      params(id)
    );
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ORDER_NOT_EDITABLE");
  });
});

// ============================================================
// The form mapping
// ============================================================

describe("order field mapping", () => {
  it("stores select labels and maps them back to values", async () => {
    const { fromOrderAnswers, judicialOrderConfig, toOrderAnswers } =
      await import("../judicial/order-fields");

    const config = judicialOrderConfig("judicial_credit_check");
    const answers = toOrderAnswers(
      config,
      {
        subject_name: "شرکت الف",
        subject_kind: "company",
        transaction: "پیش‌پرداخت قرارداد",
      },
      true
    );
    expect(answers.find((a) => a.fieldId === "subject_kind")?.value).toBe(
      "شخص حقوقی"
    );
    expect(answers.some((a) => a.fieldId === "consent_confirmed")).toBe(true);

    const back = fromOrderAnswers(config, answers);
    expect(back.values["subject_kind"]).toBe("company");
    expect(back.consent).toBe(true);
  });

  it("rejects an unknown select value instead of storing it", async () => {
    const { judicialOrderConfig, toOrderAnswers } = await import(
      "../judicial/order-fields"
    );
    const answers = toOrderAnswers(
      judicialOrderConfig("judicial_credit_check"),
      { subject_kind: "martian" },
      false
    );
    expect(answers.find((a) => a.fieldId === "subject_kind")).toBeUndefined();
  });

  it("requires a lawful purpose only for the credit check", async () => {
    const { judicialOrderConfig, validateOrderForm } = await import(
      "../judicial/order-fields"
    );
    const criminal = validateOrderForm(
      judicialOrderConfig("judicial_criminal_record"),
      { subject_name: "سارا", relation: "خودم", reason: "استخدام" },
      "",
      false,
      true
    );
    expect(criminal).toEqual({});

    const credit = validateOrderForm(
      judicialOrderConfig("judicial_credit_check"),
      { subject_name: "شرکت الف", subject_kind: "company", transaction: "خرید" },
      "",
      false,
      true
    );
    expect(credit["purpose"]).toBeTruthy();
    expect(credit["consent"]).toBeTruthy();
  });
});
