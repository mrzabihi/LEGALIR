// ============================================================
// LEGALIR — «چک برگشتی؛ اقدامات قانونی و مراحل پیگیری» tests
// ============================================================
// Covers the third rich legal article and the block kinds it adds:
//   • the content module is well-formed and its anchors are unique
//   • the storyline runs نقشه راه → مراحل → مسیرها → واژه‌نامه → پرسش‌ها
//   • the provisions index renders as a real HTML table
//   • the timeline, checklist, FAQ and closing CTA render as real elements
//   • the resolver returns the article by slug
// ============================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { checkBouncedLegalActionArticle } from "@/lib/blog/check-bounced-legal-action";
import { getLegalArticle } from "@/lib/blog/legal-articles";
import { articleHeadings } from "@/lib/blog/article-types";
import { LegalArticle } from "../legal-article";

const doc = checkBouncedLegalActionArticle;

// ------------------------------------------------------------
// Content model
// ------------------------------------------------------------

describe("check-bounced-legal-action content model", () => {
  it("has a hero with the three framing facts", () => {
    expect(doc.hero.meta).toHaveLength(3);
    expect(doc.hero.meta.map((m) => m.label)).toEqual([
      "موضوع اصلی",
      "مستندات قانونی",
      "رویکرد راهنما",
    ]);
  });

  it("gives every heading a unique anchor id", () => {
    const ids = articleHeadings(doc).map((h) => h.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("opens with a lead paragraph", () => {
    const first = doc.blocks[0];
    expect(first?.kind).toBe("paragraph");
    expect(first?.kind === "paragraph" && first.lead).toBe(true);
  });

  it("follows the source's storyline: نقشه راه → مراحل → مسیرها → واژه‌نامه → پرسش‌ها", () => {
    const ids = articleHeadings(doc).map((h) => h.id);
    expect(ids.indexOf("roadmap")).toBeLessThan(ids.indexOf("step-1-bank"));
    expect(ids.indexOf("step-1-bank")).toBeLessThan(ids.indexOf("step-4-choose-route"));
    expect(ids.indexOf("step-4-choose-route")).toBeLessThan(ids.indexOf("glossary"));
    expect(ids.indexOf("glossary")).toBeLessThan(ids.indexOf("faq"));
  });

  it("carries the provisions index as a table with all seven rows", () => {
    const tables = doc.blocks.filter((b) => b.kind === "table");
    expect(tables).toHaveLength(1);
    const table = tables[0];
    expect(table?.kind === "table" && table.columns).toEqual([
      "موضوع",
      "مستند قانونی",
    ]);
    expect(table?.kind === "table" && table.rows).toHaveLength(7);
    expect(
      table?.kind === "table" && table.rows.map((r) => r[1])
    ).toContain("ماده ۲۳");
  });

  it("carries the FAQ with six questions", () => {
    const faqs = doc.blocks.filter((b) => b.kind === "faq");
    expect(faqs).toHaveLength(1);
    expect(faqs[0]?.kind === "faq" && faqs[0].items).toHaveLength(6);
  });

  it("carries the ten-step checklist", () => {
    const checklists = doc.blocks.filter(
      (b) => b.kind === "list" && b.variant === "checklist"
    );
    expect(checklists).toHaveLength(1);
    expect(checklists[0]?.kind === "list" && checklists[0].items).toHaveLength(10);
  });

  it("closes with the chat CTA from the source", () => {
    const ctas = doc.blocks.filter((b) => b.kind === "cta");
    expect(ctas.map((c) => c.kind === "cta" && c.href)).toEqual([
      "/auth/mobile?intent=chat",
    ]);
  });
});

// ------------------------------------------------------------
// Renderer
// ------------------------------------------------------------

describe("check-bounced-legal-action renderer", () => {
  it("renders one H2 per level-2 heading", () => {
    render(<LegalArticle doc={doc} />);
    const level2 = articleHeadings(doc).filter((h) => h.level === 2);
    for (const h of level2) {
      expect(
        screen.getByRole("heading", { level: 2, name: h.text })
      ).toBeInTheDocument();
    }
  });

  it("renders the provisions index as a real table, not an image", () => {
    render(<LegalArticle doc={doc} />);
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "موضوع" })).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "مستند قانونی" })
    ).toBeInTheDocument();
    expect(screen.getByText("ماده ۲ قانون صدور چک")).toBeInTheDocument();
    expect(screen.getByText("ماده ۲۳")).toBeInTheDocument();
  });

  it("renders the checklist items", () => {
    render(<LegalArticle doc={doc} />);
    expect(
      screen.getByText("گواهی عدم پرداخت دریافت کرده‌اید.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("کد رهگیری گواهی را بررسی کرده‌اید.")
    ).toBeInTheDocument();
  });

  it("renders the FAQ questions and answers", () => {
    render(<LegalArticle doc={doc} />);
    expect(
      screen.getByText("اجراییه ماده ۲۳ چیست؟")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/سازوکاری است که به دارنده اجازه می‌دهد/)
    ).toBeInTheDocument();
  });

  it("renders the closing CTA as a link to the chat service", () => {
    render(<LegalArticle doc={doc} />);
    const cta = screen.getByRole("link", {
      name: /شروع پرسش و پاسخ حقوقی/,
    });
    expect(cta).toHaveAttribute("href", "/auth/mobile?intent=chat");
  });

  it("renders the source's warnings as highlights", () => {
    render(<LegalArticle doc={doc} />);
    expect(screen.getByText("توجه")).toBeInTheDocument();
    expect(screen.getByText("مهم‌ترین نکته: مهلت شش‌ماهه")).toBeInTheDocument();
  });
});

// ------------------------------------------------------------
// Resolver
// ------------------------------------------------------------

describe("getLegalArticle", () => {
  it("resolves the bounced-check article by slug", () => {
    expect(getLegalArticle("check-bounced-legal-action")?.slug).toBe(
      "check-bounced-legal-action"
    );
  });
});
