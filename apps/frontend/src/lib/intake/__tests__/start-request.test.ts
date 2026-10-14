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

import { describe, it, expect, afterEach } from "vitest";
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
  // /Suggest_law hand-off + capability gating
  SUGGEST_LAW_PATH,
  SUGGEST_LAW_DRAFT_KEY,
  INTENT_FLAG_KEY,
  buildSuggestLawDraft,
  writeSuggestLawDraft,
  readSuggestLawDraft,
  clearSuggestLawDraft,
  offeredIntents,
  destinationHref,
  type SuggestLawDraft,
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

// ---------------------------------------------------------------------------
// /Suggest_law — the hand-off from /new and its capability gating
// ---------------------------------------------------------------------------

describe("SUGGEST_LAW hand-off", () => {
  afterEach(() => clearSuggestLawDraft());

  it("targets the /Suggest_law route, not /chat", () => {
    expect(SUGGEST_LAW_PATH).toBe("/Suggest_law");
    expect(SUGGEST_LAW_PATH).not.toContain("/chat");
  });

  it("round-trips a request through the guarded draft store", () => {
    const draft = buildSuggestLawDraft({
      text: "  ودیعه‌ام را برنمی‌گرداند  ",
      intent: "document_review",
      category: "real_estate",
      document: { id: "doc_9", name: "قرارداد.pdf", mime: "application/pdf", sizeBytes: 1234 },
    });
    expect(writeSuggestLawDraft(draft)).toBe(true);

    const read = readSuggestLawDraft();
    expect(read).not.toBeNull();
    expect(read).toMatchObject({
      text: "ودیعه‌ام را برنمی‌گرداند", // trimmed
      intent: "document_review",
      category: "real_estate",
      document: { id: "doc_9", name: "قرارداد.pdf", mime: "application/pdf", sizeBytes: 1234 },
    });
    expect(typeof read?.savedAt).toBe("string");
  });

  it("returns null when there is no hand-off", () => {
    clearSuggestLawDraft();
    expect(readSuggestLawDraft()).toBeNull();
  });

  it("treats a corrupted / foreign value as absent rather than crashing", () => {
    localStorage.setItem(SUGGEST_LAW_DRAFT_KEY, "{ not json");
    expect(readSuggestLawDraft()).toBeNull();
    localStorage.setItem(SUGGEST_LAW_DRAFT_KEY, JSON.stringify({ nope: 1 }));
    expect(readSuggestLawDraft()).toBeNull();
  });
});

describe("offeredIntents (capability gating)", () => {
  it("drops an intent whose capability is switched off", () => {
    // Everything off except the legal question: only that survives.
    const out = offeredIntents(
      "calculation",
      ["calculation", "lawyer"],
      (key) => key === INTENT_FLAG_KEY.legal_question
    );
    expect(out).toEqual(["legal_question"]);
  });

  it("keeps the explicit pick first, then the hints, deduped", () => {
    const out = offeredIntents("lawyer", ["lawyer", "legal_question"], () => true);
    expect(out[0]).toBe("lawyer");
    expect(out.filter((i) => i === "lawyer")).toHaveLength(1);
    expect(out).toContain("legal_question");
  });

  it("fails closed when nothing is enabled", () => {
    expect(offeredIntents(null, ["legal_question"], () => false)).toEqual([]);
  });

  it("maps every intent to a real feature-flag key", () => {
    for (const opt of INTAKE_INTENT_OPTIONS) {
      expect(INTENT_FLAG_KEY[opt.id]).toBeTruthy();
    }
  });
});

describe("destinationHref (carry-forward to the real destination)", () => {
  it("seeds the chat composer with ?ask and the attachment params", () => {
    const href = destinationHref(
      { kind: "chat", serviceType: "legal_consultation" },
      { text: "شرح من", document: { id: "d1", name: "س.pdf", mime: "application/pdf", sizeBytes: 10 } }
    );
    expect(href.startsWith("/chat/new?")).toBe(true);
    const p = new URLSearchParams(href.split("?")[1]);
    expect(p.get("ask")).toBe("شرح من");
    expect(p.get("attachedDocumentId")).toBe("d1");
  });

  it("points at real routes without inventing a payload", () => {
    expect(destinationHref({ kind: "contracts_new" })).toBe("/contracts/new");
    expect(destinationHref({ kind: "calculator", slug: "diyeh" })).toBe("/calculators/diyeh");
    expect(destinationHref({ kind: "calculator", slug: null })).toBe("/calculators");
    expect(destinationHref({ kind: "consultation_wizard", category: "family" })).toBe(
      "/consultations/new"
    );
    expect(destinationHref({ kind: "document", documentId: "doc_1" })).toBe("/documents/doc_1");
  });

  it("never puts the description into a non-chat destination URL", () => {
    const href = destinationHref({ kind: "contracts_new" }, { text: "محرمانه" });
    expect(href).toBe("/contracts/new");
    expect(href).not.toContain("محرمانه");
  });
});

describe("SuggestLawDraft typed shape", () => {
  it("accepts a minimal draft", () => {
    const d: SuggestLawDraft = buildSuggestLawDraft({ text: "سؤال" });
    expect(d.intent).toBeNull();
    expect(d.category).toBeNull();
    expect(d.document).toBeNull();
  });
});
