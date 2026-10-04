// ============================================================
// LEGALIR — «راهنمای جامع حقوق مستأجر» tests
// ============================================================
// Covers the second rich legal article and the block kinds it adds:
//   • the content module is well-formed and its anchors are unique
//   • the storyline runs پیش از اجاره → پایان قرارداد → واژه‌نامه
//   • the provisions index renders as a real HTML table
//   • the checklist, FAQ and closing CTAs render as real elements
//   • the resolver returns both rich articles by slug
// ============================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { tenantRightsGuideArticle } from "@/lib/blog/tenant-rights-guide";
import { getLegalArticle } from "@/lib/blog/legal-articles";
import { articleHeadings } from "@/lib/blog/article-types";
import { LegalArticle } from "../legal-article";

const doc = tenantRightsGuideArticle;

// ------------------------------------------------------------
// Content model
// ------------------------------------------------------------

describe("tenant-rights-guide content model", () => {
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

  it("follows the source's storyline: پیش از اجاره → پایان قرارداد → واژه‌نامه", () => {
    const ids = articleHeadings(doc).map((h) => h.id);
    expect(ids.indexOf("before-renting")).toBeLessThan(ids.indexOf("end-of-term"));
    expect(ids.indexOf("end-of-term")).toBeLessThan(ids.indexOf("legal-terms"));
    expect(ids.indexOf("legal-terms")).toBeLessThan(ids.indexOf("faq"));
  });

  it("carries the provisions index as a table with all ten rows", () => {
    const tables = doc.blocks.filter((b) => b.kind === "table");
    expect(tables).toHaveLength(1);
    const table = tables[0];
    expect(table?.kind === "table" && table.columns).toEqual([
      "موضوع",
      "مستند قانونی",
    ]);
    expect(table?.kind === "table" && table.rows).toHaveLength(10);
    expect(
      table?.kind === "table" && table.rows.map((r) => r[1])
    ).toContain("ماده ۴۹۸ قانون مدنی");
  });

  it("carries the FAQ with five questions", () => {
    const faqs = doc.blocks.filter((b) => b.kind === "faq");
    expect(faqs).toHaveLength(1);
    expect(faqs[0]?.kind === "faq" && faqs[0].items).toHaveLength(5);
  });

  it("closes with the two service CTAs from the source", () => {
    const ctas = doc.blocks.filter((b) => b.kind === "cta");
    expect(ctas.map((c) => c.kind === "cta" && c.href)).toEqual([
      "/contracts/new",
      "/contracts/review",
    ]);
  });
});

// ------------------------------------------------------------
// Renderer
// ------------------------------------------------------------

describe("tenant-rights-guide renderer", () => {
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
    expect(screen.getByText("ماده ۴۸۶ قانون مدنی")).toBeInTheDocument();
    expect(
      screen.getByText("مواد ۶ تا ۱۳ قانون روابط موجر و مستأجر ۱۳۷۶")
    ).toBeInTheDocument();
  });

  it("renders the checklist items", () => {
    render(<LegalArticle doc={doc} />);
    expect(screen.getByText("مشخصات طرفین درست است.")).toBeInTheDocument();
    expect(
      screen.getByText("نسخه قرارداد و مدارک پرداخت نزد مستأجر نگهداری می‌شود.")
    ).toBeInTheDocument();
  });

  it("renders the FAQ questions and answers", () => {
    render(<LegalArticle doc={doc} />);
    expect(
      screen.getByText("آیا فروش خانه باعث پایان اجاره می‌شود؟")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/در حالت عادی، فروش ملک به‌خودی‌خود اجاره را از بین نمی‌برد/)
    ).toBeInTheDocument();
  });

  it("renders the closing CTAs as links to the contract services", () => {
    render(<LegalArticle doc={doc} />);
    const draft = screen.getByRole("link", {
      name: /تنظیم پیش‌نویس قرارداد جدید/,
    });
    expect(draft).toHaveAttribute("href", "/contracts/new");
    const review = screen.getByRole("link", { name: /بررسی قرارداد/ });
    expect(review).toHaveAttribute("href", "/contracts/review");
  });

  it("renders the source's warnings as highlights", () => {
    render(<LegalArticle doc={doc} />);
    expect(screen.getByText("توجه")).toBeInTheDocument();
    expect(screen.getByText("نکته مهم")).toBeInTheDocument();
  });
});

// ------------------------------------------------------------
// Resolver
// ------------------------------------------------------------

describe("getLegalArticle", () => {
  it("resolves both rich articles by slug", () => {
    expect(getLegalArticle("contract-penalty-clause")?.slug).toBe(
      "contract-penalty-clause"
    );
    expect(getLegalArticle("tenant-rights-guide")?.slug).toBe(
      "tenant-rights-guide"
    );
  });

  it("returns undefined for a slug without a rich document", () => {
    expect(getLegalArticle("divorce-process-iran")).toBeUndefined();
  });
});
