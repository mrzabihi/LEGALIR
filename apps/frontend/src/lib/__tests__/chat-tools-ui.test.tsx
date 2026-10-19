// ============================================================
// LEGALIR — Chat tool surfaces (component behaviour)
// ============================================================
// Verifies the states §7, §8, §9 and §14 require, at the component level:
//
//   • an unavailable tool is rendered as unavailable WITH a stated reason,
//     stays focusable (aria-disabled, not `disabled`) and can never fire a
//     selection change;
//   • a selected tool is conveyed by aria-pressed AND a non-colour marker;
//   • a server rejection is announced (role="alert"), not swallowed;
//   • follow-ups accept an answer, a skip («اطلاع ندارم») or nothing, and
//     submit the composed message plus the structured answers;
//   • the documents tab shows only this conversation's attachments, states
//     failures honestly and never invents a document or a finding count.
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import type { ChatAttachmentRef, ChatToolView, FollowUpQuestion } from "@legalir/types";

import { ChatToolsBar } from "@/components/chat/chat-tools-bar";
import { FollowUpPanel } from "@/components/chat/follow-up-panel";
import { ConversationDocumentsTab } from "@/components/chat/conversation-documents-tab";

// ------------------------------------------------------------
// Fixtures — shaped exactly like the server projections
// ------------------------------------------------------------

function tool(overrides: Partial<ChatToolView> & { id: ChatToolView["id"] }): ChatToolView {
  return {
    labelFa: "تحلیل عمیق",
    descriptionFa: "بررسی چندلایهٔ مسئله با منابع بیشتر.",
    effectNoteFa: "تا ۵ منبع بررسی می‌شود.",
    icon: "sparkle",
    order: 1,
    requiresSource: false,
    enabled: true,
    allowedForService: true,
    available: true,
    unavailableReasonFa: null,
    ...overrides,
  };
}

const DEEP = tool({ id: "deep_analysis", order: 1 });
const RESEARCH = tool({
  id: "legal_research",
  labelFa: "پژوهش حقوقی",
  icon: "search",
  order: 2,
  effectNoteFa: "تا ۶ منبع بررسی می‌شود.",
});
const JUDICIAL = tool({
  id: "judicial_opinions",
  labelFa: "آراء قضایی",
  icon: "gavel",
  order: 3,
  requiresSource: true,
  available: false,
  unavailableReasonFa: "پایگاه آراء قضایی در این نصب فعال نیست.",
});

function attachment(overrides: Partial<ChatAttachmentRef>): ChatAttachmentRef {
  return {
    attachmentId: "att-1",
    documentId: "doc-1",
    name: "قرارداد.pdf",
    mime: "application/pdf",
    sizeBytes: 1024,
    status: "ready",
    riskLevel: null,
    findingCount: 0,
    createdAt: "2026-10-18T00:00:00.000Z",
    ...overrides,
  };
}

// ------------------------------------------------------------
// §7 — contextual tools
// ------------------------------------------------------------

describe("ChatToolsBar", () => {
  it("renders every server-projected tool in one labelled group", () => {
    render(<ChatToolsBar tools={[DEEP, RESEARCH, JUDICIAL]} selected={[]} onChange={vi.fn()} />);
    const group = screen.getByRole("group", { name: "ابزارهای زمینه‌ای" });
    expect(within(group).getByRole("button", { name: /تحلیل عمیق/ })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: /پژوهش حقوقی/ })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: /آراء قضایی/ })).toBeInTheDocument();
  });

  it("marks an unavailable tool as unavailable and states the server's reason", () => {
    render(<ChatToolsBar tools={[JUDICIAL]} selected={[]} onChange={vi.fn()} />);
    const judicial = screen.getByRole("button", { name: /آراء قضایی/ });
    expect(judicial).toHaveAttribute("aria-disabled", "true");
    // Focusable on purpose, so keyboard users can hear the reason (§14).
    expect(judicial).not.toBeDisabled();
    const describedBy = judicial.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)?.textContent).toContain(
      "پایگاه آراء قضایی در این نصب فعال نیست."
    );
  });

  it("refuses a click on an unavailable tool", () => {
    const onChange = vi.fn();
    render(<ChatToolsBar tools={[JUDICIAL]} selected={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /آراء قضایی/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("selects an available tool and reports the full selection", () => {
    const onChange = vi.fn();
    render(<ChatToolsBar tools={[DEEP, RESEARCH]} selected={["deep_analysis"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /پژوهش حقوقی/ }));
    expect(onChange).toHaveBeenCalledWith(["deep_analysis", "legal_research"]);
  });

  it("deselects an already-selected tool", () => {
    const onChange = vi.fn();
    render(<ChatToolsBar tools={[DEEP, RESEARCH]} selected={["deep_analysis"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /تحلیل عمیق/ }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("conveys selection by aria-pressed and a visible marker, not colour alone", () => {
    render(<ChatToolsBar tools={[DEEP]} selected={["deep_analysis"]} onChange={vi.fn()} />);
    const deep = screen.getByRole("button", { name: /تحلیل عمیق/ });
    expect(deep).toHaveAttribute("aria-pressed", "true");
    expect(deep.textContent).toContain("✓");
  });

  it("locks selection while a turn is generating", () => {
    const onChange = vi.fn();
    render(<ChatToolsBar tools={[DEEP]} selected={[]} onChange={onChange} disabled />);
    const deep = screen.getByRole("button", { name: /تحلیل عمیق/ });
    expect(deep).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(deep);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("announces a server rejection instead of silently dropping it", () => {
    render(
      <ChatToolsBar
        tools={[DEEP]}
        selected={[]}
        onChange={vi.fn()}
        rejection={{ id: "deep_analysis", reasonFa: "برای این خدمت مجاز نیست." }}
      />
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("تحلیل عمیق");
    expect(alert.textContent).toContain("برای این خدمت مجاز نیست.");
  });

  it("renders nothing when the server projects no tools", () => {
    const { container } = render(<ChatToolsBar tools={[]} selected={[]} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

// ------------------------------------------------------------
// §8 — follow-up questions
// ------------------------------------------------------------

const QUESTIONS: FollowUpQuestion[] = [
  {
    id: "amount",
    questionFa: "مبلغ مورد اختلاف چقدر است؟",
    whyFa: "مبلغ، صلاحیت مرجع رسیدگی را تعیین می‌کند.",
    required: true,
    quickOptionsFa: [],
  },
  {
    id: "contract_type",
    questionFa: "نوع قرارداد چیست؟",
    whyFa: null,
    required: false,
    quickOptionsFa: [
      { labelFa: "اجاره", value: "اجاره" },
      { labelFa: "کار", value: "کار" },
    ],
  },
];

describe("FollowUpPanel", () => {
  it("asks only the questions it was given, with the reason for required ones", () => {
    render(<FollowUpPanel questions={QUESTIONS} onSubmit={vi.fn()} />);
    expect(screen.getByText("مبلغ مورد اختلاف چقدر است؟")).toBeInTheDocument();
    expect(screen.getByText("مبلغ، صلاحیت مرجع رسیدگی را تعیین می‌کند.")).toBeInTheDocument();
    // The requirement is announced in text, not carried by the asterisk alone.
    expect(screen.getByText("الزامی")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "اجاره" })).toBeInTheDocument();
  });

  it("blocks submission until at least one answer exists", () => {
    render(<FollowUpPanel questions={QUESTIONS} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /ارسال پاسخ‌ها/ })).toBeDisabled();
  });

  it("submits the composed message and the structured answers", async () => {
    const onSubmit = vi.fn();
    render(<FollowUpPanel questions={QUESTIONS} onSubmit={onSubmit} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "اجاره" }));
      fireEvent.change(screen.getByLabelText("پاسخ: مبلغ مورد اختلاف چقدر است؟"), {
        target: { value: "۵۰۰ میلیون" },
      });
      fireEvent.click(screen.getByRole("button", { name: /ارسال پاسخ‌ها/ }));
    });

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [content, answers] = onSubmit.mock.calls[0]!;
    expect(content).toContain("مبلغ مورد اختلاف چقدر است؟");
    expect(content).toContain("۵۰۰ میلیون");
    expect(content).toContain("نوع قرارداد چیست؟");
    expect(answers).toEqual([
      { id: "amount", value: "۵۰۰ میلیون" },
      { id: "contract_type", value: "اجاره" },
    ]);
  });

  it("records an explicit skip as «اطلاع ندارم»", async () => {
    const onSubmit = vi.fn();
    render(<FollowUpPanel questions={QUESTIONS} onSubmit={onSubmit} />);

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "اطلاع ندارم" })[0]!);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /ارسال پاسخ‌ها/ }));
    });

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![1]).toEqual([{ id: "amount", value: "اطلاع ندارم" }]);
  });

  it("can be collapsed with «بعداً» without losing the questions", () => {
    render(<FollowUpPanel questions={QUESTIONS} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "بعداً" }));
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();
    expect(screen.queryByText("مبلغ مورد اختلاف چقدر است؟")).not.toBeInTheDocument();
  });

  it("disables every control while the assistant is generating", () => {
    render(<FollowUpPanel questions={QUESTIONS} onSubmit={vi.fn()} busy />);
    expect(screen.getByRole("button", { name: "اجاره" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /ارسال پاسخ‌ها/ })).toBeDisabled();
  });
});

// ------------------------------------------------------------
// §9 — documents of THIS conversation only
// ------------------------------------------------------------

describe("ConversationDocumentsTab", () => {
  it("says plainly when nothing is attached", () => {
    render(<ConversationDocumentsTab messages={[]} onOpenDocument={vi.fn()} />);
    expect(screen.getByText("در این گفتگو سندی پیوست نشده است")).toBeInTheDocument();
  });

  it("deduplicates a document attached to more than one turn", () => {
    const doc = attachment({});
    render(
      <ConversationDocumentsTab
        messages={[{ attachments: [doc] }, { attachments: [doc] }]}
        onOpenDocument={vi.fn()}
      />
    );
    expect(screen.getAllByText("قرارداد.pdf")).toHaveLength(1);
  });

  it("shows a failed document as failed and never claims its content was used", () => {
    render(
      <ConversationDocumentsTab
        messages={[
          {
            attachments: [
              attachment({ status: "failed", findingCount: 7, riskLevel: "high" }),
            ],
          },
        ]}
        onOpenDocument={vi.fn()}
      />
    );
    expect(screen.getByText("خطا در پردازش")).toBeInTheDocument();
    expect(
      screen.getByText("پردازش این سند کامل نشد؛ محتوای آن در پاسخ‌ها استفاده نمی‌شود.")
    ).toBeInTheDocument();
    // A failed extraction cannot report findings or a risk verdict.
    expect(screen.queryByText(/یافته/)).not.toBeInTheDocument();
    expect(screen.queryByText("ریسک بالا")).not.toBeInTheDocument();
  });

  it("shows a ready document's findings and risk level", () => {
    render(
      <ConversationDocumentsTab
        messages={[
          { attachments: [attachment({ status: "ready", findingCount: 3, riskLevel: "high" })] },
        ]}
        onOpenDocument={vi.fn()}
      />
    );
    expect(screen.getByText("آماده")).toBeInTheDocument();
    expect(screen.getByText("۳ یافته")).toBeInTheDocument();
    expect(screen.getByText("ریسک بالا")).toBeInTheDocument();
  });

  it("opens the document the user actually clicked", () => {
    const onOpen = vi.fn();
    render(
      <ConversationDocumentsTab
        messages={[{ attachments: [attachment({ documentId: "doc-42" })] }]}
        onOpenDocument={onOpen}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "مشاهده سند قرارداد.pdf" }));
    expect(onOpen).toHaveBeenCalledWith("doc-42");
  });

  it("shows a skeleton while loading — no invented documents", () => {
    const { container } = render(
      <ConversationDocumentsTab messages={[]} isLoading onOpenDocument={vi.fn()} />
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByText("در این گفتگو سندی پیوست نشده است")).not.toBeInTheDocument();
  });
});
