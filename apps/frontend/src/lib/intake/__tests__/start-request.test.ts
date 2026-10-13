// ============================================================
// LEGALIR — «شروع درخواست حقوقی» routing tests
// ============================================================
// The routing logic is deterministic and side-effect-free (except the
// guarded localStorage write helper). These tests pin:
//   • Persian normalisation (ZWNJ, Arabic yeh/kaf),
//   • calculator/category suggestion, and that only real slugs return,
//   • intent ordering (never empty, user hint preserved),
//   • destination resolution (a pointer, never a payload),
//   • the carry-forward contract (chat query + consultation draft),
//   • the honesty rule: quota is flagged only for the chat path.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  normalizeFa,
  suggestCalculatorSlug,
  suggestCategorySlug,
  suggestIntents,
  resolveDestination,
  describeDestination,
  chatQuery,
  calculatorHref,
  deriveTitle,
  buildConsultationDraft,
  needsClarification,
  categoryLabel,
  INTAKE_INTENT_OPTIONS,
  INTAKE_CATEGORY_CHOICES,
} from "../start-request";

describe("normalizeFa", () => {
  it("unifies the Arabic and Persian yeh/kaf and drops the ZWNJ", () => {
    expect(normalizeFa("دعوی")).toBe(normalizeFa("دعوى"));
    expect(normalizeFa("مشاركت")).toContain("مشارکت"); // Arabic kaf → Persian kaf
    expect(normalizeFa("پیش‌نویس")).toBe("پیش نویس");
  });
});

describe("suggestCalculatorSlug", () => {
  it("maps a signal phrase to a real calculator slug", () => {
    expect(suggestCalculatorSlug("می‌خواهم مهریه‌ام را به نرخ روز حساب کنم")).toBe("dowry");
    expect(suggestCalculatorSlug("هزینه دادرسی این دعوا چقدر است")).toBe("court-fee");
    expect(suggestCalculatorSlug("خسارت تاخیر تادیه")).toBe("delayed-payment");
  });

  it("returns null when there is no clear signal", () => {
    expect(suggestCalculatorSlug("با همسایه‌ام اختلاف دارم")).toBeNull();
  });
});

describe("suggestCategorySlug", () => {
  it("detects common categories", () => {
    expect(suggestCategorySlug("مستاجر ودیعه را برنمی‌گرداند")).toBe("real_estate");
    expect(suggestCategorySlug("کارفرما مرا اخراج کرده")).toBe("labor");
    expect(suggestCategorySlug("چک برگشتی دارم")).toBe("checks");
  });

  it("falls back to null for an unknown topic", () => {
    expect(suggestCategorySlug("یک سند می‌خواهم بنویسم")).toBeNull();
  });
});

describe("suggestIntents", () => {
  it("never returns an empty list and always offers the legal question", () => {
    const out = suggestIntents("");
    expect(out).toContain("legal_question");
    expect(out.length).toBeGreaterThan(0);
  });

  it("leads with calculation when the text reads as a calculation", () => {
    expect(suggestIntents("محاسبه مهریه")[0]).toBe("calculation");
  });

  it("nudges toward document review when a file is attached", () => {
    const out = suggestIntents("این سند را ببین", { hasDocument: true });
    expect(out).toContain("document_review");
  });

  it("caps the hint list at three", () => {
    const out = suggestIntents("محاسبه خسارت تاخیر قرارداد اجاره وکیل", {
      hasDocument: true,
    });
    expect(out.length).toBeLessThanOrEqual(3);
  });
});

describe("inventory tables", () => {
  it("offers distinct intent ids with Persian labels", () => {
    const ids = INTAKE_INTENT_OPTIONS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const o of INTAKE_INTENT_OPTIONS) {
      expect(o.titleFa.length).toBeGreaterThan(0);
      expect(o.descriptionFa.length).toBeGreaterThan(0);
    }
  });

  it("asks about categories that have Persian labels", () => {
    for (const slug of INTAKE_CATEGORY_CHOICES) {
      expect(categoryLabel(slug)).not.toBe(slug); // a real label, not the raw slug
    }
  });
});

describe("resolveDestination", () => {
  const base = { text: "شرح", documentId: null, category: null } as const;

  it("routes a legal question to a chat conversation", () => {
    const d = resolveDestination({ ...base, intent: "legal_question" });
    expect(d).toEqual({ kind: "chat", serviceType: "legal_consultation" });
  });

  it("opens the attached document for review, or the upload flow when none", () => {
    expect(resolveDestination({ ...base, intent: "document_review", documentId: "doc_1" })).toEqual({
      kind: "document",
      documentId: "doc_1",
    });
    expect(resolveDestination({ ...base, intent: "document_review" })).toEqual({
      kind: "document_upload",
    });
  });

  it("points drafting, next-step and lawyer intents at existing routes", () => {
    expect(resolveDestination({ ...base, intent: "draft_document" }).kind).toBe("contracts_new");
    expect(resolveDestination({ ...base, intent: "next_step" }).kind).toBe("consultations_list");
    expect(resolveDestination({ ...base, intent: "lawyer", category: "family" })).toEqual({
      kind: "consultation_wizard",
      category: "family",
    });
  });

  it("carries a calculator slug when the text names one", () => {
    expect(resolveDestination({ ...base, intent: "calculation", text: "دیه" })).toEqual({
      kind: "calculator",
      slug: "diyeh",
    });
  });
});

describe("describeDestination", () => {
  it("flags daily quota ONLY for the chat path", () => {
    expect(describeDestination({ kind: "chat", serviceType: "legal_consultation" }).usesDailyQuota).toBe(
      true
    );
    expect(describeDestination({ kind: "calculator", slug: null }).usesDailyQuota).toBe(false);
    expect(describeDestination({ kind: "document_upload" }).usesDailyQuota).toBe(false);
    expect(describeDestination({ kind: "consultation_wizard", category: null }).usesDailyQuota).toBe(
      false
    );
  });

  it("always states what will happen", () => {
    for (const dest of [
      { kind: "chat", serviceType: "legal_consultation" } as const,
      { kind: "contracts_new" } as const,
      { kind: "consultations_list" } as const,
    ]) {
      expect(describeDestination(dest).detailFa.length).toBeGreaterThan(0);
    }
  });
});

describe("carry-forward contract", () => {
  it("puts the description in ?ask= and the document in the attachment params", () => {
    const qs = chatQuery({
      serviceType: "legal_consultation",
      text: "ودیعه‌ام را نمی‌دهد",
      document: { id: "doc_9", name: "قرارداد.pdf", mime: "application/pdf", sizeBytes: 1234 },
    });
    const p = new URLSearchParams(qs);
    expect(p.get("service")).toBe("legal_consultation");
    expect(p.get("ask")).toBe("ودیعه‌ام را نمی‌دهد");
    expect(p.get("attachedDocumentId")).toBe("doc_9");
    expect(p.get("attachedDocumentName")).toBe("قرارداد.pdf");
    expect(p.get("attachedDocumentSize")).toBe("1234");
  });

  it("omits the attachment params when there is no document", () => {
    const p = new URLSearchParams(
      chatQuery({ serviceType: "contract_review", text: "بررسی کن" })
    );
    expect(p.get("ask")).toBe("بررسی کن");
    expect(p.has("attachedDocumentId")).toBe(false);
  });

  it("builds a complete consultation draft seed the wizard can merge", () => {
    const seed = buildConsultationDraft({
      text: "اختلاف با مالک درباره ودیعه\nجزئیات بیشتر",
      category: "real_estate",
      attachmentIds: ["doc_1"],
    });
    expect(seed).toMatchObject({
      step: 0,
      category: "real_estate",
      urgency: "normal",
      lawyerId: null,
      attachmentIds: ["doc_1"],
    });
    expect(seed.title).toBe("اختلاف با مالک درباره ودیعه");
    expect(seed.description).toContain("جزئیات بیشتر");
  });

  it("falls back to the calculator LIST when no slug is known", () => {
    expect(calculatorHref(null)).toBe("/calculators");
    expect(calculatorHref("diyeh")).toBe("/calculators/diyeh");
  });
});

describe("helpers", () => {
  it("derives a short title from the first non-empty line", () => {
    expect(deriveTitle("\n\n  اختلاف ملکی با همسایه  ")).toBe("اختلاف ملکی با همسایه");
    expect(deriveTitle("")).toBe("درخواست حقوقی");
    expect(deriveTitle("ا".repeat(100)).endsWith("…")).toBe(true);
  });

  it("asks for clarification only on a very short description", () => {
    expect(needsClarification("کمک")).toBe(true);
    expect(needsClarification("می‌خواهم درباره قرارداد اجاره راهنمایی بگیرم")).toBe(false);
  });
});
