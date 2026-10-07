// @vitest-environment node
// ============================================================
// LEGALIR — Admin payment receipt (descriptor · PDF · no fabrication)
// ============================================================
// The receipt is the operator's proof for a real payment, so two things must
// be provable: (1) an unpaid order yields NO receipt and says why, never a
// fabricated file; (2) a paid order yields a real descriptor whose every field
// comes from the order row — and a valid, non-empty PDF is rendered from it.
//
// `@/lib/db` is replaced with an in-memory store (same pattern as
// `admin-overview.test.ts`) so `getOrder` reads seeded subscriptions without
// touching the live `.data` directory.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  tables: new Map<string, unknown[]>(),
  users: new Map<string, unknown>(),
}));

vi.mock("@/lib/db", () => ({
  readTable: (name: string) => structuredClone(h.tables.get(name) ?? []),
  writeTable: (name: string, data: unknown[]) => {
    h.tables.set(name, structuredClone(data));
  },
  findUserById: (id: string) => h.users.get(id),
  normalizeStoredMobile: (m: string) => m,
}));

import { buildOrderReceipt, getOrder, maskMobile } from "@/lib/admin/orders";
import { renderOrderReceiptPdf } from "@/lib/admin/receipt-pdf";
import type { AdminOrder, OrderStatus } from "@legalir/types";

const PAID_ORDER: AdminOrder = {
  id: "sub-1",
  referenceId: "sub-1",
  userId: "u1",
  userDisplayName: "زهرا محمدی",
  userMobileMasked: "0912•••0003",
  orgId: null,
  planCode: "gold",
  planNameFa: "اشتراک طلایی",
  listPrice: 500_000,
  salePrice: 450_000,
  discountAmount: 50_000,
  refundedAmount: 0,
  netAmount: 450_000,
  currency: "IRT",
  status: "SUCCESS",
  gateway: "simulated",
  trackingId: null,
  purchasedAt: "2026-03-10T09:30:00.000Z",
  createdAt: "2026-03-10T09:30:00.000Z",
};

function withStatus(status: OrderStatus): AdminOrder {
  return { ...PAID_ORDER, status };
}

describe("buildOrderReceipt — paid order", () => {
  it("exposes a real system receipt built from the order row", () => {
    const r = buildOrderReceipt(withStatus("SUCCESS"));
    expect(r.available).toBe(true);
    expect(r.reason).toBeNull();
    expect(r.kind).toBe("system_receipt");
    expect(r.transactionId).toBe("sub-1");
    expect(r.amount).toBe(450_000); // salePrice, NOT listPrice
    expect(r.currency).toBe("IRT");
    expect(r.paidAt).toBe("2026-03-10T09:30:00.000Z");
    expect(r.statusFa).toBe("موفق");
    expect(r.serviceFa).toBe("اشتراک طلایی");
    expect(r.payerMobileMasked).toBe("0912•••0003");
    expect(r.gatewaySimulated).toBe(true);
    expect(r.hasDocument).toBe(true);
    expect(r.documentMime).toBe("application/pdf");
    expect(r.fileUrl).toContain("/api/v1/admin/orders/sub-1/receipt.pdf");
  });

  it("treats REFUNDED and PARTIALLY_REFUNDED as paid (a receipt still exists)", () => {
    for (const status of ["REFUNDED", "PARTIALLY_REFUNDED"] as OrderStatus[]) {
      const r = buildOrderReceipt(withStatus(status));
      expect(r.available).toBe(true);
      expect(r.paidAt).toBe(PAID_ORDER.purchasedAt);
    }
  });

  it("does not fabricate a tracking code the order does not have", () => {
    expect(buildOrderReceipt(PAID_ORDER).trackingId).toBeNull();
  });

  it("carries a real gateway tracking code when the order has one", () => {
    const r = buildOrderReceipt({ ...PAID_ORDER, trackingId: "GW-9F2A11" });
    expect(r.trackingId).toBe("GW-9F2A11");
  });
});

describe("buildOrderReceipt — unpaid order yields no receipt", () => {
  it.each<[OrderStatus, string]>([
    ["PENDING", "در انتظار پرداخت"],
    ["FAILED", "ناموفق"],
    ["EXPIRED", "منقضی"],
    ["CREATED", "ایجاد شده"],
  ])("reports not_paid for %s and invents nothing", (status, statusFa) => {
    const r = buildOrderReceipt(withStatus(status));
    expect(r.available).toBe(false);
    expect(r.reason).toBe("not_paid");
    expect(r.kind).toBeNull();
    expect(r.transactionId).toBeNull();
    expect(r.trackingId).toBeNull();
    expect(r.paidAt).toBeNull();
    expect(r.hasDocument).toBe(false);
    expect(r.documentMime).toBeNull();
    expect(r.fileUrl).toBeNull();
    expect(r.statusFa).toBe(statusFa);
    // The informational fields still reflect the real order — only the
    // receipt-specific ones are withheld.
    expect(r.amount).toBe(450_000);
    expect(r.payerMobileMasked).toBe("0912•••0003");
  });
});

describe("maskMobile", () => {
  it("keeps the first four and last four digits", () => {
    expect(maskMobile("09120000003")).toBe("0912•••0003");
  });

  it("falls back to a full mask for very short numbers", () => {
    expect(maskMobile("123")).toBe("••••");
  });
});

describe("getOrder — tracking_id is read from the real subscription row", () => {
  beforeEach(() => {
    h.tables.clear();
    h.users.clear();
  });

  it("surfaces a stored tracking_id and the seeded user", () => {
    h.users.set("u1", {
      id: "u1",
      mobile: "09120000003",
      displayName: "زهرا محمدی",
      orgId: null,
    });
    h.tables.set("subscriptions", [
      {
        id: "sub-7",
        user_id: "u1",
        plan_code: "gold",
        plan_name_fa: "اشتراک طلایی",
        amount: 450_000,
        currency: "IRT",
        status: "active",
        status_fa: "فعال",
        start_at: "2026-03-10T09:30:00.000Z",
        end_at: "2026-04-10T09:30:00.000Z",
        purchased_at: "2026-03-10T09:30:00.000Z",
        auto_renew: 0,
        tracking_id: "GW-ABC123",
      },
    ]);
    const order = getOrder("sub-7");
    expect(order).toBeDefined();
    expect(order!.trackingId).toBe("GW-ABC123");
    expect(order!.status).toBe("SUCCESS");
    expect(buildOrderReceipt(order!).trackingId).toBe("GW-ABC123");
  });

  it("returns undefined for an unknown order id", () => {
    expect(getOrder("nope")).toBeUndefined();
  });
});

/** Extract the text layer of a rendered PDF (logical order, as pdfjs reads it). */
async function extractText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    out += tc.items.map((i) => ("str" in i && typeof i.str === "string" ? i.str : "")).join(" ") + "\n";
  }
  return out;
}

describe("renderOrderReceiptPdf", () => {
  it("renders a non-empty, valid PDF from the descriptor", async () => {
    const bytes = await renderOrderReceiptPdf(buildOrderReceipt(withStatus("SUCCESS")));
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(1_000);
    // Every PDF begins with the %PDF- magic header.
    const header = String.fromCharCode(...bytes.slice(0, 5));
    expect(header).toBe("%PDF-");
  });

  it("formats the full ISO timestamps as real Jalali dates, never the '—' fallback", async () => {
    // Regression: `buildOrderReceipt` sets `paidAt`/`generatedAt` to FULL ISO
    // timestamps, while `formatIsoJalali` accepts `YYYY-MM-DD` only. Passing
    // the timestamp through unmodified printed "—" for every date.
    const bytes = await renderOrderReceiptPdf(buildOrderReceipt(withStatus("SUCCESS")));
    const text = await extractText(bytes);
    expect(text).not.toContain("\u2014"); // em-dash = the "no date" fallback
    expect(text).toMatch(/[\u06F0-\u06F9]{4}/); // a 4-digit Persian year is present
    expect(text).toContain("تاریخ پرداخت"); // the payment-date label
  });

  it("renders without a tracking id or service name (nulls are omitted, not thrown on)", async () => {
    const bytes = await renderOrderReceiptPdf({
      ...buildOrderReceipt(PAID_ORDER),
      serviceFa: null,
      trackingId: null,
    });
    expect(bytes.byteLength).toBeGreaterThan(1_000);
  });
});
