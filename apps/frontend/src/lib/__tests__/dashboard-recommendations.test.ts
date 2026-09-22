import { describe, it, expect } from "vitest";
import { buildRecommendations } from "../dashboard-metrics";
import { LAW_SOURCES } from "../law-catalog";
import type { V1ContractDetail, V1DocumentDetail } from "@legalir/types";

// ============================================================
// Smart Recommendations — provenance grounding
// ============================================================
// These tests lock in the contract that every recommendation is derived
// from a REAL artifact (a curated law source from «iran legal», or one of
// the user's own documents/contracts) and never from a fabricated name.

function doc(overrides: Partial<V1DocumentDetail>): V1DocumentDetail {
  return {
    id: "doc-x",
    userId: "u1",
    name: "سند.pdf",
    mime: "application/pdf",
    sizeBytes: 1,
    status: "ready",
    storageKey: null,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    jobs: [],
    report: null,
    extractedText: null,
    previewUrl: null,
    ...overrides,
  };
}

function contract(overrides: Partial<V1ContractDetail>): V1ContractDetail {
  return {
    id: "cnt-x",
    userId: "u1",
    title: "قرارداد",
    type: "employment",
    typeFa: "استخدام",
    category: "business",
    state: "generated",
    currentVersionId: null,
    currentVersionNumber: 0,
    versions: [],
    analysis: null,
    attachments: [],
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    disclaimer: "",
    ...overrides,
  };
}

const LAW_FILE_NAMES = new Set(LAW_SOURCES.map((l) => l.fileName));

describe("buildRecommendations — provenance", () => {
  it("grounds a labour document in the real قانون کار source", () => {
    const recs = buildRecommendations(
      [
        doc({
          id: "doc-emp",
          name: "قرارداد-کار.pdf",
          extractedText: "این قرارداد مطابق ماده ۷ قانون کار و تعهدات بیمه تأمین اجتماعی تنظیم شده است.",
          report: {
            documentId: "doc-emp",
            summary: "بررسی قرارداد کار",
            findings: [],
            generatedAt: "2026-08-01T00:00:00Z",
            confidence: 0.8,
          },
        }),
      ],
      []
    );

    const grounded = recs.find((r) => r.source?.kind === "law");
    expect(grounded).toBeDefined();
    // The provenance must point at a real curated source + real file name.
    expect(LAW_FILE_NAMES.has(grounded!.source!.fileName!)).toBe(true);
    expect(grounded!.source!.locator).toBeTruthy();
    expect(grounded!.source!.authority).toBeTruthy();
    // And it must name the user's own document.
    expect(grounded!.source!.documentName).toBe("قرارداد-کار.pdf");
  });

  it("never emits a law source file name that is not in the catalog", () => {
    const recs = buildRecommendations(
      [doc({ id: "d1", name: "چک-برگشتی.pdf", extractedText: "چک بلامحل و سامانه صیاد" })],
      [contract({ id: "c1", type: "nda", title: "توافقنامه محرمانگی" })]
    );
    for (const r of recs) {
      if (r.source?.kind === "law") {
        expect(LAW_FILE_NAMES.has(r.source.fileName!)).toBe(true);
      }
    }
  });

  it("prioritises actionable artifact state over corpus suggestions", () => {
    const recs = buildRecommendations(
      [
        doc({ id: "doc-fail", name: "تصویر-چک.jpg", status: "failed" }),
        doc({
          id: "doc-ok",
          name: "قرارداد-کار.pdf",
          extractedText: "بیمه تأمین اجتماعی و اضافه‌کاری",
        }),
      ],
      []
    );
    expect(recs[0]!.id).toBe("rec-failed-doc");
    expect(recs[0]!.urgency).toBe("action");
  });

  it("maps each contract type to a real governing provision", () => {
    const recs = buildRecommendations(
      [],
      [contract({ id: "c-emp", type: "employment", title: "قرارداد استخدام" })]
    );
    const r = recs.find((x) => x.id.startsWith("rec-ctr-law-"));
    expect(r).toBeDefined();
    expect(r!.source!.kind).toBe("law");
    expect(LAW_FILE_NAMES.has(r!.source!.fileName!)).toBe(true);
    expect(r!.source!.documentName).toBe("قرارداد استخدام");
  });

  it("falls back to a real corpus entry when the user has no artifacts", () => {
    const recs = buildRecommendations([], []);
    expect(recs).toHaveLength(1);
    expect(recs[0]!.id).toBe("rec-law-starter");
    expect(LAW_FILE_NAMES.has(recs[0]!.source!.fileName!)).toBe(true);
  });

  it("caps the list at 4 and keeps actionable items first", () => {
    const recs = buildRecommendations(
      [
        doc({ id: "f", name: "خطا.pdf", status: "failed" }),
        doc({ id: "p", name: "درحال-پردازش.pdf", status: "processing" }),
        doc({ id: "a", name: "بیمه.pdf", extractedText: "بیمه تأمین اجتماعی" }),
        doc({ id: "b", name: "چک.pdf", extractedText: "چک بلامحل" }),
        doc({ id: "c", name: "گمرک.pdf", extractedText: "ترخیص کالا از گمرک" }),
      ],
      [contract({ id: "r", state: "under_review", title: "قرارداد در بررسی" })]
    );
    expect(recs.length).toBeLessThanOrEqual(4);
    const rank = { action: 0, warning: 1, info: 2 } as const;
    for (let i = 1; i < recs.length; i++) {
      expect(rank[recs[i]!.urgency]).toBeGreaterThanOrEqual(rank[recs[i - 1]!.urgency]);
    }
  });

  it("does not duplicate a corpus recommendation for the same document", () => {
    const recs = buildRecommendations(
      [doc({ id: "d", name: "همه.pdf", extractedText: "بیمه تأمین اجتماعی چک گمرک طلاق" })],
      []
    );
    const ids = recs.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
