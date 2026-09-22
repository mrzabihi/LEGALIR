// ============================================================
// LEGALIR — Legal article tests
// ============================================================
// Covers the typed block model and the components that render it:
//   • the content module is well-formed and its anchors are unique
//   • the storyline runs ماده ۲۳۰ → مسئله → رأی ۸۰۵ → اثر عملی
//   • each block kind renders its own component, not a generic card
//   • the hero carries the post title as the single H1
//   • the TOC lists every heading and links to its anchor
//   • the timeline and card grids are real lists, not images
// ============================================================

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { contractPenaltyClauseArticle } from "@/lib/blog/contract-penalty-clause";
import { articleHeadings } from "@/lib/blog/article-types";
import { LegalArticle } from "../legal-article";
import { LegalArticleHero } from "../legal-article-hero";
import { ArticleToc } from "@/components/blog/article-toc";

const doc = contractPenaltyClauseArticle;

// ------------------------------------------------------------
// Content model
// ------------------------------------------------------------

describe("article content model", () => {
  it("has a hero with the three framing facts", () => {
    expect(doc.hero.meta).toHaveLength(3);
    expect(doc.hero.meta.map((m) => m.label)).toEqual([
      "موضوع اصلی",
      "مرجع صادرکننده",
      "اهمیت رأی",
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

  it("follows the source's storyline: ۲۳۰ → مسئله → ۸۰۵ → اثر عملی", () => {
    const ids = articleHeadings(doc).map((h) => h.id);
    expect(ids.indexOf("article-230")).toBeLessThan(ids.indexOf("legal-background"));
    expect(ids.indexOf("legal-background")).toBeLessThan(ids.indexOf("ruling-805"));
    expect(ids.indexOf("ruling-805")).toBeLessThan(ids.indexOf("practical-effects"));
  });

  it("cites both provisions and the ruling as first-class blocks", () => {
    const provisions = doc.blocks.filter((b) => b.kind === "provision");
    const cases = doc.blocks.filter((b) => b.kind === "case");
    expect(provisions.map((p) => p.kind === "provision" && p.number)).toEqual([
      "۲۳۰",
      "۵۲۲",
    ]);
    expect(cases).toHaveLength(1);
    expect(cases[0]?.kind === "case" && cases[0].number).toBe("۸۰۵");
  });
});

// ------------------------------------------------------------
// Renderer
// ------------------------------------------------------------

describe("LegalArticle renderer", () => {
  it("renders one H2 per level-2 heading", () => {
    render(<LegalArticle doc={doc} />);
    const level2 = articleHeadings(doc).filter((h) => h.level === 2);
    for (const h of level2) {
      expect(
        screen.getByRole("heading", { level: 2, name: h.text })
      ).toBeInTheDocument();
    }
  });

  it("renders the statute article as a provision card, not a paragraph", () => {
    render(<LegalArticle doc={doc} />);
    expect(screen.getAllByText("ماده ۲۳۰ قانون مدنی").length).toBeGreaterThan(0);
    expect(
      screen.getByText("تعیین وجه‌الالتزام توافقی برای تخلف از تعهد")
    ).toBeInTheDocument();
  });

  it("renders the ruling as a case card with its authority and date", () => {
    render(<LegalArticle doc={doc} />);
    expect(screen.getByText("رأی وحدت رویه ۸۰۵")).toBeInTheDocument();
    expect(screen.getByText("هیئت عمومی دیوان عالی کشور")).toBeInTheDocument();
    expect(screen.getByText("۱۶ دی‌ماه ۱۳۹۹")).toBeInTheDocument();
    expect(screen.getByText("حکم رأی")).toBeInTheDocument();
  });

  it("renders the timeline as an ordered list of three steps", () => {
    render(<LegalArticle doc={doc} />);
    expect(screen.getByText("مسیر تحول رویه قضایی")).toBeInTheDocument();
    expect(screen.getByText("تشتت آرا")).toBeInTheDocument();
    expect(screen.getByText("صدور رأی ۸۰۵")).toBeInTheDocument();
    expect(screen.getByText("یکنواختی حقوقی")).toBeInTheDocument();
  });

  it("renders the practical advice as a highlight, not body text", () => {
    render(<LegalArticle doc={doc} />);
    expect(screen.getByText("توصیه عملی")).toBeInTheDocument();
    expect(screen.getByText("جمع‌بندی رأی")).toBeInTheDocument();
  });

  it("renders the closing points as a takeaway list", () => {
    render(<LegalArticle doc={doc} />);
    expect(screen.getByText("نکات کلیدی")).toBeInTheDocument();
    expect(
      screen.getByText(/وجه‌الالتزام توافق‌شده، حتی مازاد بر نرخ تورم رسمی/)
    ).toBeInTheDocument();
  });

  it("renders the sources as references", () => {
    render(<LegalArticle doc={doc} />);
    expect(screen.getByText("منابع")).toBeInTheDocument();
    expect(
      screen.getByText("رأی وحدت رویه ۸۰۵ هیئت عمومی دیوان عالی کشور")
    ).toBeInTheDocument();
  });

  it("renders the effect and challenge grids as real lists", () => {
    render(<LegalArticle doc={doc} />);
    expect(screen.getByText("تأثیرات عملی رأی")).toBeInTheDocument();
    expect(screen.getByText("چالش‌ها و نقدهای وارد بر رأی")).toBeInTheDocument();
    expect(screen.getByText("اصل انصاف و تناسب")).toBeInTheDocument();
  });
});

// ------------------------------------------------------------
// Hero
// ------------------------------------------------------------

describe("LegalArticleHero", () => {
  it("renders the post title as the single H1 and the deck title as the lead", () => {
    render(
      <LegalArticleHero
        hero={doc.hero}
        title="وجه‌الالتزام در قراردادها — از ماده ۲۳۰ تا رأی وحدت رویه ۸۰۵"
        category="قراردادها"
        author="تحریریه LEGALIR"
        publishedAt="۱۰ مرداد ۱۴۰۵"
        readingTime={12}
      />
    );
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent("وجه‌الالتزام در قراردادها");
    expect(screen.getByText(doc.hero.lead)).toBeInTheDocument();
  });

  it("shows the three framing facts", () => {
    render(
      <LegalArticleHero
        hero={doc.hero}
        title="عنوان"
        category="قراردادها"
        author="تحریریه LEGALIR"
        publishedAt="۱۰ مرداد ۱۴۰۵"
        readingTime={12}
      />
    );
    expect(screen.getByText("موضوع اصلی")).toBeInTheDocument();
    expect(screen.getByText("مرجع صادرکننده")).toBeInTheDocument();
    expect(screen.getByText("اهمیت رأی")).toBeInTheDocument();
  });
});

// ------------------------------------------------------------
// Table of contents
// ------------------------------------------------------------

describe("ArticleToc", () => {
  const headings = articleHeadings(doc);

  it("lists every heading and links to its anchor", () => {
    render(<ArticleToc headings={headings} variant="rail" />);
    for (const h of headings) {
      const link = screen.getByRole("link", { name: h.text });
      expect(link).toHaveAttribute("href", `#${h.id}`);
    }
  });

  it("collapses into a disclosure on mobile", () => {
    render(<ArticleToc headings={headings} variant="disclosure" />);
    const toggle = screen.getByRole("button", { name: /فهرست مطالب/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("link", { name: "ماده ۲۳۰ قانون مدنی" })
    ).toBeInTheDocument();
  });

  it("renders nothing when there are no headings", () => {
    const { container } = render(<ArticleToc headings={[]} variant="rail" />);
    expect(container).toBeEmptyDOMElement();
  });
});
