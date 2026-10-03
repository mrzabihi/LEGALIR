// ============================================================
// LEGALIR — Review result surface (spec §11)
// ============================================================
// The result surface is the six-tab view of a document review. These
// tests lock the honesty rules that would silently break it:
//
//   • the six tabs are exactly the declared vocabulary;
//   • findings are separated by their real nature, and a finding with a
//     citation is treated as a conflict with law even when the pipeline
//     did not classify it;
//   • citations show the source name, article and status — never a bare
//     number;
//   • no fabricated "health %" is ever rendered;
//   • «درباره این یافته سؤال کنید» hands the finding to the chat.
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { DocumentFinding, RiskReport } from "@legalir/types";

import { ReviewResult } from "@/components/documents/review-result";
import { REVIEW_RESULT_TABS } from "@/lib/contracts/review-flow";

// --- Fixtures ---------------------------------------------------------------

function finding(overrides: Partial<DocumentFinding> = {}): DocumentFinding {
  return {
    id: "f1",
    documentId: "doc-1",
    title: "شرط فسخ یک‌طرفه",
    severity: "high",
    locator: "بند ۷",
    reason: "این شرط به یک طرف اجازه فسخ بدون دلیل می‌دهد.",
    recommendation: "شرط فسخ باید متقابل و مشروط به دلیل موجه شود.",
    citation: null,
    confidence: 82,
    ...overrides,
  };
}

const LAW_CITATION = {
  id: "c1",
  sourceId: "src-1",
  locator: "ماده ۱۰",
  quote: "قراردادهای خصوصی نسبت به کسانی که آن را منعقد نموده‌اند...",
  source: {
    id: "src-1",
    type: "law" as const,
    title: "قانون مدنی",
    authority: "مجلس شورای اسلامی",
    validFrom: "۱۳۰۷/۰۲/۱۸",
    validTo: null,
    status: "valid" as const,
    jurisdiction: "ایران",
    retrievedAt: "2026-10-01T00:00:00.000Z",
  },
};

function report(findings: DocumentFinding[]): RiskReport {
  return {
    documentId: "doc-1",
    summary: "این قرارداد چند نکته پرریسک دارد.",
    findings,
    generatedAt: "2026-10-01T00:00:00.000Z",
    confidence: 78,
  };
}

// ------------------------------------------------------------
// Tabs
// ------------------------------------------------------------

describe("ReviewResult — tabs", () => {
  it("renders exactly the six declared tabs", () => {
    render(<ReviewResult report={report([finding()])} />);
    for (const tab of REVIEW_RESULT_TABS) {
      expect(screen.getByRole("tab", { name: new RegExp(tab.labelFa) })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("tab")).toHaveLength(6);
  });

  it("opens on the summary tab by default", () => {
    render(<ReviewResult report={report([finding()])} />);
    expect(screen.getByRole("tab", { name: /خلاصه بررسی/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("switches to the findings tab on click", () => {
    render(<ReviewResult report={report([finding()])} />);
    fireEvent.click(screen.getByRole("tab", { name: /ایرادها و ریسک‌ها/ }));
    expect(screen.getByRole("tab", { name: /ایرادها و ریسک‌ها/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});

// ------------------------------------------------------------
// Honesty — no fabricated health %
// ------------------------------------------------------------

describe("ReviewResult — honesty", () => {
  it("never renders a fabricated health percentage", () => {
    const { container } = render(<ReviewResult report={report([finding()])} />);
    // The only percentage allowed is the pipeline's own confidence, which
    // is labelled «اطمینان». A bare «سلامت» / «health» score must not exist.
    expect(container.textContent).not.toMatch(/سلامت/);
    expect(container.textContent).not.toMatch(/health/i);
  });

  it("shows an empty state when there is no report", () => {
    render(<ReviewResult report={null} />);
    expect(screen.getByText(/خلاصه‌ای برای نمایش نیست/)).toBeInTheDocument();
  });
});

// ------------------------------------------------------------
// Findings — separation by real nature
// ------------------------------------------------------------

describe("ReviewResult — findings by kind", () => {
  it("groups a cited finding under «مغایرت با قانون»", () => {
    render(<ReviewResult report={report([finding({ citation: LAW_CITATION })])} />);
    fireEvent.click(screen.getByRole("tab", { name: /ایرادها و ریسک‌ها/ }));
    expect(screen.getByText(/مغایرت با قانون/)).toBeInTheDocument();
  });

  it("groups an uncited finding under «ریسک قراردادی»", () => {
    render(<ReviewResult report={report([finding({ citation: null })])} />);
    fireEvent.click(screen.getByRole("tab", { name: /ایرادها و ریسک‌ها/ }));
    expect(screen.getByText(/ریسک قراردادی/)).toBeInTheDocument();
  });

  it("honours an explicit kind over the derived one", () => {
    render(
      <ReviewResult
        report={report([finding({ kind: "incomplete_info", citation: LAW_CITATION })])}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: /اطلاعات ناقص/ }));
    expect(screen.getByText(/شرط فسخ یک‌طرفه/)).toBeInTheDocument();
  });
});

// ------------------------------------------------------------
// Sources — real citations, never a bare number
// ------------------------------------------------------------

describe("ReviewResult — sources", () => {
  it("shows the source name, article and status", () => {
    render(<ReviewResult report={report([finding({ citation: LAW_CITATION })])} />);
    fireEvent.click(screen.getByRole("tab", { name: /منابع و مستندات/ }));
    expect(screen.getByText("قانون مدنی")).toBeInTheDocument();
    expect(screen.getByText("ماده ۱۰")).toBeInTheDocument();
    expect(screen.getByText("معتبر")).toBeInTheDocument();
  });

  it("de-duplicates the same source + locator", () => {
    render(
      <ReviewResult
        report={report([
          finding({ id: "f1", citation: LAW_CITATION }),
          finding({ id: "f2", citation: LAW_CITATION }),
        ])}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: /منابع و مستندات/ }));
    expect(screen.getAllByText("قانون مدنی")).toHaveLength(1);
  });

  it("shows an empty state when nothing is cited", () => {
    render(<ReviewResult report={report([finding({ citation: null })])} />);
    fireEvent.click(screen.getByRole("tab", { name: /منابع و مستندات/ }));
    expect(screen.getByText(/منبعی ارجاع نشده است/)).toBeInTheDocument();
  });
});

// ------------------------------------------------------------
// Suggestions + document
// ------------------------------------------------------------

describe("ReviewResult — suggestions", () => {
  it("lists findings that carry a recommendation", () => {
    render(<ReviewResult report={report([finding()])} />);
    fireEvent.click(screen.getByRole("tab", { name: /پیشنهاد اصلاح/ }));
    expect(screen.getByText(/شرط فسخ باید متقابل/)).toBeInTheDocument();
  });
});

describe("ReviewResult — document", () => {
  it("shows the real extracted text and the locators", () => {
    render(
      <ReviewResult
        report={report([finding({ locator: "بند ۷" })])}
        extractedText="متن کامل قرارداد اینجا قرار دارد."
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: /سند و نشانه‌گذاری/ }));
    expect(screen.getByText("متن کامل قرارداد اینجا قرار دارد.")).toBeInTheDocument();
    expect(screen.getByText("بند ۷")).toBeInTheDocument();
  });

  it("says so honestly when no text was extracted", () => {
    render(<ReviewResult report={report([finding()])} extractedText={null} />);
    fireEvent.click(screen.getByRole("tab", { name: /سند و نشانه‌گذاری/ }));
    expect(screen.getByText(/متنی برای این سند استخراج نشده است/)).toBeInTheDocument();
  });
});

// ------------------------------------------------------------
// Chat CTA (spec §12)
// ------------------------------------------------------------

describe("ReviewResult — ask about a finding", () => {
  it("hands the finding to the chat when the CTA is clicked", () => {
    const onAsk = vi.fn();
    render(<ReviewResult report={report([finding()])} onAskAboutFinding={onAsk} />);
    fireEvent.click(screen.getByRole("tab", { name: /ایرادها و ریسک‌ها/ }));
    fireEvent.click(screen.getByRole("button", { name: /درباره این یافته سؤال کنید/ }));
    expect(onAsk).toHaveBeenCalledTimes(1);
    expect(onAsk.mock.calls[0]![0].title).toBe("شرط فسخ یک‌طرفه");
  });

  it("omits the CTA when no handler is provided", () => {
    render(<ReviewResult report={report([finding()])} />);
    fireEvent.click(screen.getByRole("tab", { name: /ایرادها و ریسک‌ها/ }));
    expect(
      screen.queryByRole("button", { name: /درباره این یافته سؤال کنید/ })
    ).not.toBeInTheDocument();
  });
});
