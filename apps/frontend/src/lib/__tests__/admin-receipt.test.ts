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
import type { AdminOrder, OrderStatus, StoredOrder as CheckoutOrder } from "@legalir/types";

const PAID_ORDER: AdminOrder = {
  id: "sub-1",
  referenceId: "sub-1",
  userId: "u1",
  userDisplayName: "زهرا محمدی",
  userMobileMasked: "0912****003",
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
  invoice: {
    basePrice: 500_000,
    listPrice: 500_000,
    couponCode: "NOWRUZ",
    discountAmount: 50_000,
    discountPercent: 10,
    taxAmount: 0,
    taxRatePercent: 0,
    otherAmount: 0,
    finalAmount: 450_000,
    collectedAmount: 450_000,
    durationDays: 30,
  },
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
    expect(r.payerMobileMasked).toBe("0912****003");
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
    expect(r.payerMobileMasked).toBe("0912****003");
  });
});

describe("maskMobile", () => {
  it("hides exactly the four middle digits with the panel-wide rule", () => {
    expect(maskMobile("09120000003")).toBe("0912****003");
  });

  it("masks all but the last two digits for very short numbers", () => {
    expect(maskMobile("123")).toBe("*23");
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

/**
 * A checkout order is the authoritative purchase record: it snapshotted every
 * monetary component at order time, so the invoice CAN be itemized. This is the
 * distinction the receipt has to preserve — a checkout order shows the split, a
 * legacy subscription row must not invent one.
 */
function checkoutOrder(over: Partial<CheckoutOrder> = {}): CheckoutOrder {
  return {
    id: "ord-9",
    referenceId: "ORD-9",
    userId: "u1",
    planCode: "gold",
    planNameFa: "اشتراک طلایی",
    durationDays: 90,
    currency: "IRT",
    basePrice: 1_100_000,
    listPrice: 1_200_000,
    couponId: "cpn-1",
    couponCode: "NOWRUZ",
    couponKind: "percent",
    couponValue: 10,
    discountAmount: 120_000,
    discountPercent: 10,
    taxAmount: 33_000,
    taxRatePercent: 3,
    otherAmount: 0,
    finalAmount: 1_013_000,
    collectedAmount: 1_013_000,
    status: "paid",
    paymentId: "pay-1",
    subscriptionId: "sub-9",
    gateway: "simulated",
    trackingId: "GW-9F2A11",
    idempotencyKey: "idem-9",
    createdAt: "2026-03-10T09:25:00.000Z",
    updatedAt: "2026-03-10T09:30:00.000Z",
    paidAt: "2026-03-10T09:30:00.000Z",
    ...over,
  };
}

describe("getOrder — the checkout ledger is the itemized source", () => {
  beforeEach(() => {
    h.tables.clear();
    h.users.clear();
    h.users.set("u1", {
      id: "u1",
      mobile: "09120000003",
      displayName: "زهرا محمدی",
      orgId: null,
    });
  });

  it("carries the full invoice snapshot from the checkout row", () => {
    h.tables.set("orders", [checkoutOrder()]);
    const order = getOrder("sub-9")!;
    expect(order).toBeDefined();
    expect(order.invoice).toEqual({
      basePrice: 1_100_000,
      listPrice: 1_200_000,
      couponCode: "NOWRUZ",
      discountAmount: 120_000,
      discountPercent: 10,
      taxAmount: 33_000,
      taxRatePercent: 3,
      otherAmount: 0,
      finalAmount: 1_013_000,
      collectedAmount: 1_013_000,
      durationDays: 90,
    });
    expect(order.salePrice).toBe(1_013_000); // the amount actually owed
    expect(order.listPrice).toBe(1_200_000); // the pre-discount figure
    expect(order.status).toBe("SUCCESS");
    expect(order.trackingId).toBe("GW-9F2A11");
  });

  it("hands the same snapshot to the receipt descriptor", () => {
    h.tables.set("orders", [checkoutOrder()]);
    const receipt = buildOrderReceipt(getOrder("sub-9")!);
    expect(receipt.available).toBe(true);
    expect(receipt.invoice).toEqual(getOrder("sub-9")!.invoice);
    expect(receipt.listPrice).toBe(1_200_000);
    expect(receipt.discountAmount).toBe(120_000);
    expect(receipt.refundedAmount).toBe(0);
  });

  it("still reports the real snapshot for an order that has not been paid", () => {
    h.tables.set("orders", [
      checkoutOrder({ status: "awaiting_payment", paidAt: null, collectedAmount: 0 }),
    ]);
    const order = getOrder("sub-9")!;
    expect(order.invoice).not.toBeNull(); // the ledger recorded it
    const receipt = buildOrderReceipt(order);
    expect(receipt.available).toBe(false); // but no receipt is issued
    expect(receipt.reason).toBe("not_paid");
    expect(receipt.invoice!.finalAmount).toBe(1_013_000);
  });

  it("scopes a legacy subscription row to no itemization at all", () => {
    h.tables.set("subscriptions", [
      {
        id: "sub-legacy",
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
        tracking_id: null,
      },
    ]);
    const order = getOrder("sub-legacy")!;
    expect(order.invoice).toBeNull();
    expect(order.listPrice).toBe(order.salePrice); // one settled figure only
    expect(buildOrderReceipt(order).invoice).toBeNull();
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
    expect(text).toContain("تاریخ خرید"); // the purchase-date label
  });

  it("renders without a tracking id or service name (nulls are omitted, not thrown on)", async () => {
    const bytes = await renderOrderReceiptPdf({
      ...buildOrderReceipt(PAID_ORDER),
      serviceFa: null,
      trackingId: null,
    });
    expect(bytes.byteLength).toBeGreaterThan(1_000);
  });

  // NOTE: pdfjs extracts shaped glyphs, so a lam-alef ligature comes back as
  // «ال» and a hamza as a separate mark. Assertions therefore use substrings
  // that survive shaping — never a word containing لا or a diacritic.
  it("prints the four invoice sections", async () => {
    const bytes = await renderOrderReceiptPdf(buildOrderReceipt(PAID_ORDER));
    const text = await extractText(bytes);
    for (const section of ["مشخصات سفارش", "مشخصات خریدار", "مبالغ", "اطالعات پرداخت"]) {
      expect(text).toContain(section);
    }
  });

  it("itemizes discount, tax and the payable total from the snapshot", async () => {
    const order: AdminOrder = {
      ...PAID_ORDER,
      invoice: {
        ...PAID_ORDER.invoice!,
        taxAmount: 45_000,
        taxRatePercent: 10,
        finalAmount: 495_000,
        collectedAmount: 495_000,
      },
      salePrice: 495_000,
      netAmount: 495_000,
    };
    const bytes = await renderOrderReceiptPdf(buildOrderReceipt(order));
    const text = await extractText(bytes);

    expect(text).toContain("مبلغ فهرست");
    expect(text).toContain("NOWRUZ"); // the coupon code is printed, not hidden
    expect(text).toContain("مالیات بر ارزش افزوده");
    expect(text).toContain("مبلغ قابل پرداخت");
  });

  it("omits the itemization for a legacy order instead of inventing zeros", async () => {
    const legacy: AdminOrder = { ...PAID_ORDER, invoice: null };
    const bytes = await renderOrderReceiptPdf(buildOrderReceipt(legacy));
    const text = await extractText(bytes);

    // The honest statement replaces the itemized block.
    expect(text).toContain("قدیمی");
    expect(text).toContain("مبلغ فروش");
    expect(text).not.toContain("NOWRUZ");
    expect(text).not.toContain("مبلغ فهرست");
  });

  it("draws the official seal and its honest caption", async () => {
    const bytes = await renderOrderReceiptPdf(buildOrderReceipt(PAID_ORDER));
    const text = await extractText(bytes);
    // The caption states what the mark certifies, so a printed invoice is
    // never mistaken for a legally reviewed document.
    expect(text).toContain("مهر رسمی");
    expect(text).toContain("بررسی حقوقی");
    // The print-only hologram ink is part of the PDF, never of the screen view.
    expect(text).toContain("Powered By SOYE");
  });
});
