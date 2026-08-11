import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse, delay } from "msw";
import { server } from "@/mocks/server";
import {
  fixtureAllConversations,
  fixtureV1ConversationDetail,
  fixtureV1StructuredMessage,
  fixtureV1References,
} from "@legalir/testing";
import ChatListPage from "@/app/(app)/chat/page";
import ConversationPage from "@/app/(app)/chat/[id]/page";
import NewConversationPage from "@/app/(app)/chat/new/page";

const API_BASE = "http://localhost:8000";

function ok<T>(data: T) {
  return { data, meta: { requestId: "test-request-id" } };
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 60_000 },
      mutations: { retry: false },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <div dir="rtl">{children}</div>
    </QueryClientProvider>
  );
}

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  useParams: () => ({ id: "conv-rent-001" }),
  usePathname: () => "/chat/conv-rent-001",
}));

import { vi } from "vitest";

function setupConversationHandlers() {
  server.use(
    http.get(`${API_BASE}/api/v1/conversations`, async () => {
      await delay(50);
      return HttpResponse.json(ok(fixtureAllConversations));
    }),
    http.get(`${API_BASE}/api/v1/conversations/:id`, async () => {
      await delay(50);
      return HttpResponse.json(ok(fixtureV1ConversationDetail));
    }),
    http.post(`${API_BASE}/api/v1/conversations`, async ({ request }) => {
      await delay(50);
      const body = (await request.json()) as { title: string; category?: string };
      return HttpResponse.json(
        ok({
          id: "conv-new-test",
          userId: "u-pro-001",
          title: body.title,
          category: body.category ?? null,
          status: "active",
          riskLevel: null,
          messageCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        { status: 201 }
      );
    }),
    http.post(`${API_BASE}/api/v1/conversations/:id/messages`, async ({ request }) => {
      await delay(100);
      const body = (await request.json()) as { content: string };
      return HttpResponse.json(
        ok({
          ...fixtureV1StructuredMessage,
          id: `msg-${Date.now()}`,
          conversationId: "conv-rent-001",
          role: "assistant" as const,
          content: `پاسخ به: "${body.content}"`,
          status: "completed" as const,
          sections: fixtureV1StructuredMessage.sections,
          references: fixtureV1References,
        })
      );
    }),
    http.patch(`${API_BASE}/api/v1/conversations/:id`, async () => {
      await delay(50);
      return HttpResponse.json(
        ok({
          ...fixtureV1ConversationDetail,
          status: "archived",
          updatedAt: new Date().toISOString(),
        })
      );
    }),
    http.get(`${API_BASE}/api/v1/conversations/:id/references`, async () => {
      await delay(50);
      return HttpResponse.json(ok(fixtureV1References));
    })
  );
}

describe("Phase 7 — AI Legal Chat Workspace", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  // ==========================================
  // Conversation Creation
  // ==========================================
  describe("Conversation Creation", () => {
    it("renders the new conversation page with category selector", async () => {
      setupConversationHandlers();
      render(
        <TestWrapper>
          <NewConversationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("گفتگوی جدید")).toBeInTheDocument();
      });

      // Categories should be visible
      expect(screen.getByText("پرونده‌ها")).toBeInTheDocument();
      expect(screen.getByText("قراردادها")).toBeInTheDocument();
      expect(screen.getByText("املاک")).toBeInTheDocument();
      expect(screen.getByText("خانواده")).toBeInTheDocument();
      expect(screen.getByText("تجارت")).toBeInTheDocument();
      expect(screen.getByText("سایر")).toBeInTheDocument();
    });

    it("shows error when trying to create conversation without title", async () => {
      setupConversationHandlers();
      render(
        <TestWrapper>
          <NewConversationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("گفتگوی جدید")).toBeInTheDocument();
      });

      // Click create without entering title
      const createButton = screen.getByText("شروع گفتگو");
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText("عنوان گفتگو الزامی است")).toBeInTheDocument();
      });
    });

    it("selects a category and shows selected state", async () => {
      setupConversationHandlers();
      render(
        <TestWrapper>
          <NewConversationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("پرونده‌ها")).toBeInTheDocument();
      });

      const categoryButton = screen.getByText("پرونده‌ها").closest("button")!;
      fireEvent.click(categoryButton);

      await waitFor(() => {
        expect(categoryButton.getAttribute("aria-pressed")).toBe("true");
      });
    });
  });

  // ==========================================
  // Message Submission
  // ==========================================
  describe("Message Submission", () => {
    it("renders conversation workspace with messages", async () => {
      setupConversationHandlers();
      render(
        <TestWrapper>
          <ConversationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        const titles = screen.getAllByText(fixtureV1ConversationDetail.title);
        expect(titles.length).toBeGreaterThan(0);
      });

      // Should show existing messages
      const userMessages = fixtureV1ConversationDetail.messages.filter(
        (m) => m.role === "user"
      );
      for (const msg of userMessages) {
        expect(screen.getByText(msg.content)).toBeInTheDocument();
      }
    });

    it("sends message and shows user bubble", async () => {
      setupConversationHandlers();

      // Track messages in a local array so GET handler returns them after POST
      const localMessages: {
        id: string;
        conversationId: string;
        role: string;
        content: string;
        status: string;
        sections?: typeof fixtureV1StructuredMessage.sections;
        createdAt: string;
      }[] = [];

      server.use(
        http.get(`${API_BASE}/api/v1/conversations/:id`, async () => {
          await delay(50);
          return HttpResponse.json(
            ok({
              id: "conv-empty-test",
              userId: "u-pro-001",
              title: "گفتگوی خالی",
              category: "contract",
              status: "active",
              riskLevel: null,
              messageCount: localMessages.length,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              messages: localMessages,
              aiRuns: [],
              references: [],
            })
          );
        })
      );

      render(
        <TestWrapper>
          <ConversationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("گفتگوی خالی")).toBeInTheDocument();
      });

      // Override POST to also add to localMessages
      server.use(
        http.post(`${API_BASE}/api/v1/conversations/:id/messages`, async ({ request }) => {
          await delay(100);
          const body = (await request.json()) as { content: string };
          const msg = {
            id: `msg-${Date.now()}`,
            conversationId: "conv-empty-test",
            role: "user" as const,
            content: body.content,
            status: "sent" as const,
            createdAt: new Date().toISOString(),
          };
          localMessages.push(msg);
          const asstMsg = {
            id: `msg-asst-${Date.now()}`,
            conversationId: "conv-empty-test",
            role: "assistant" as const,
            content: "پاسخ تحلیلی",
            status: "completed" as const,
            sections: fixtureV1StructuredMessage.sections,
            createdAt: new Date().toISOString(),
          };
          localMessages.push(asstMsg);
          return HttpResponse.json(
            ok({
              ...fixtureV1StructuredMessage,
              id: asstMsg.id,
              conversationId: "conv-empty-test",
              role: "assistant" as const,
              content: asstMsg.content,
              status: "completed" as const,
              sections: fixtureV1StructuredMessage.sections,
              references: fixtureV1References,
            })
          );
        })
      );

      // Type and send a message
      const textarea = screen.getByPlaceholderText("سوال حقوقی خود را بنویسید...");
      fireEvent.change(textarea, { target: { value: "حقوق مستأجر چیست؟" } });

      const sendButton = screen.getByLabelText("ارسال پیام");
      fireEvent.click(sendButton);

      // Wait for the response sections to appear
      await waitFor(
        () => {
          expect(screen.getByText("خلاصه")).toBeInTheDocument();
        },
        { timeout: 6000 }
      );
    });

    it("shows structured response sections after sending", async () => {
      setupConversationHandlers();

      const localMessages: {
        id: string;
        conversationId: string;
        role: string;
        content: string;
        status: string;
        sections?: typeof fixtureV1StructuredMessage.sections;
        createdAt: string;
      }[] = [];

      server.use(
        http.get(`${API_BASE}/api/v1/conversations/:id`, async () => {
          await delay(50);
          return HttpResponse.json(
            ok({
              id: "conv-sections-test",
              userId: "u-pro-001",
              title: "تست بخش‌ها",
              category: "family",
              status: "active",
              riskLevel: null,
              messageCount: localMessages.length,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              messages: localMessages,
              aiRuns: [],
              references: [],
            })
          );
        }),
        http.post(`${API_BASE}/api/v1/conversations/:id/messages`, async ({ request }) => {
          await delay(100);
          const body = (await request.json()) as { content: string };
          const userMsg = {
            id: `msg-${Date.now()}`,
            conversationId: "conv-sections-test",
            role: "user" as const,
            content: body.content,
            status: "sent" as const,
            createdAt: new Date().toISOString(),
          };
          localMessages.push(userMsg);
          const asstMsg = {
            id: `msg-asst-${Date.now()}`,
            conversationId: "conv-sections-test",
            role: "assistant" as const,
            content: "پاسخ تحلیلی",
            status: "completed" as const,
            sections: fixtureV1StructuredMessage.sections,
            createdAt: new Date().toISOString(),
          };
          localMessages.push(asstMsg);
          return HttpResponse.json(
            ok({
              ...fixtureV1StructuredMessage,
              id: asstMsg.id,
              conversationId: "conv-sections-test",
              role: "assistant" as const,
              content: asstMsg.content,
              status: "completed" as const,
              sections: fixtureV1StructuredMessage.sections,
              references: fixtureV1References,
            })
          );
        })
      );

      render(
        <TestWrapper>
          <ConversationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("تست بخش‌ها")).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText("سوال حقوقی خود را بنویسید...");
      fireEvent.change(textarea, { target: { value: "تست تحلیل حقوقی" } });
      fireEvent.click(screen.getByLabelText("ارسال پیام"));

      // All 7 sections should appear
      await waitFor(
        () => {
          expect(screen.getByText("خلاصه")).toBeInTheDocument();
          expect(screen.getByText("اطلاعات و فرض‌ها")).toBeInTheDocument();
          expect(screen.getByText("تحلیل اولیه")).toBeInTheDocument();
          expect(screen.getByText("ریسک‌ها")).toBeInTheDocument();
          expect(screen.getByText("اقدامات پیشنهادی")).toBeInTheDocument();
          const sourcesElements = screen.getAllByText("منابع");
          expect(sourcesElements.length).toBeGreaterThanOrEqual(1);
          expect(screen.getByText("هشدار حقوقی")).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  // ==========================================
  // AI Run States
  // ==========================================
  describe("AI Run States", () => {
    it("shows AI disclaimer on every assistant response", async () => {
      setupConversationHandlers();

      const detailWithCompletedMsg = {
        ...fixtureV1ConversationDetail,
        messages: [
          ...fixtureV1ConversationDetail.messages,
          {
            ...fixtureV1StructuredMessage,
            status: "completed" as const,
          },
        ],
      };

      server.use(
        http.get(`${API_BASE}/api/v1/conversations/:id`, async () => {
          await delay(50);
          return HttpResponse.json(ok(detailWithCompletedMsg));
        })
      );

      render(
        <TestWrapper>
          <ConversationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        const disclaimers = screen.getAllByText(/تحلیل تخصصی حقوقی/);
        expect(disclaimers.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("shows failed message state with retry button", async () => {
      setupConversationHandlers();

      const detailWithFailedMsg = {
        id: "conv-failed-test",
        userId: "u-pro-001",
        title: "گفتگوی با خطا",
        category: "contract",
        status: "active",
        riskLevel: "high",
        messageCount: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: "msg-usr-fail",
            conversationId: "conv-failed-test",
            role: "user" as const,
            content: "پیام کاربر",
            status: "sent",
            createdAt: new Date().toISOString(),
          },
          {
            id: "msg-ast-fail",
            conversationId: "conv-failed-test",
            role: "assistant" as const,
            content: "خطا در پردازش",
            status: "failed",
            createdAt: new Date().toISOString(),
          },
        ],
        aiRuns: [],
        references: [],
      };

      server.use(
        http.get(`${API_BASE}/api/v1/conversations/:id`, async () => {
          await delay(50);
          return HttpResponse.json(ok(detailWithFailedMsg));
        })
      );

      render(
        <TestWrapper>
          <ConversationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("تلاش مجدد")).toBeInTheDocument();
      });
    });
  });

  // ==========================================
  // Archive
  // ==========================================
  describe("Archive", () => {
    it("renders conversation list with archive functionality", async () => {
      setupConversationHandlers();
      render(
        <TestWrapper>
          <ChatListPage />
        </TestWrapper>
      );

      await waitFor(() => {
        const titles = screen.getAllByText("گفتگوها");
        expect(titles.length).toBeGreaterThanOrEqual(1);
      });

      // Should list existing conversations
      const firstConv = fixtureAllConversations[0]!;
      await waitFor(() => {
        const titles = screen.getAllByText(firstConv.title);
        expect(titles.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ==========================================
  // Mobile Layout & Typography
  // ==========================================
  describe("Mobile Layout & Typography", () => {
    it("renders legal disclaimer in chat page", async () => {
      setupConversationHandlers();

      const detailWithCompletedMsg = {
        ...fixtureV1ConversationDetail,
        messages: [
          ...fixtureV1ConversationDetail.messages,
          {
            ...fixtureV1StructuredMessage,
            status: "completed" as const,
          },
        ],
      };

      server.use(
        http.get(`${API_BASE}/api/v1/conversations/:id`, async () => {
          await delay(50);
          return HttpResponse.json(ok(detailWithCompletedMsg));
        })
      );

      render(
        <TestWrapper>
          <ConversationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        // Check disclaimer is visible
        const disclaimers = screen.getAllByText(/تحلیل تخصصی حقوقی/);
        expect(disclaimers.length).toBeGreaterThan(0);
      });
    });

    it("renders escalation CTA placeholder", async () => {
      setupConversationHandlers();

      const detailWithCompletedMsg = {
        ...fixtureV1ConversationDetail,
        messages: [
          ...fixtureV1ConversationDetail.messages,
          {
            ...fixtureV1StructuredMessage,
            status: "completed" as const,
          },
        ],
      };

      server.use(
        http.get(`${API_BASE}/api/v1/conversations/:id`, async () => {
          await delay(50);
          return HttpResponse.json(ok(detailWithCompletedMsg));
        })
      );

      render(
        <TestWrapper>
          <ConversationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText("مشاوره با وکیل")).toBeInTheDocument();
      });

      // CTA button should be disabled (placeholder)
      const ctaButton = screen.getByText("مشاوره با وکیل").closest("button");
      expect(ctaButton).toBeDisabled();
    });

    it("shows usage bar with daily request counter", async () => {
      setupConversationHandlers();
      render(
        <TestWrapper>
          <ChatListPage />
        </TestWrapper>
      );

      await waitFor(() => {
        const elements = screen.getAllByText("درخواست‌های امروز");
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ==========================================
  // Conversation Rename
  // ==========================================
  describe("Conversation Rename", () => {
    it("renders rename button in conversation header", async () => {
      setupConversationHandlers();
      render(
        <TestWrapper>
          <ConversationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText("تغییر نام گفتگو")).toBeInTheDocument();
      });
    });
  });

  // ==========================================
  // Tabs (Chat / References)
  // ==========================================
  describe("Conversation Tabs", () => {
    it("renders chat and references tabs", async () => {
      setupConversationHandlers();
      render(
        <TestWrapper>
          <ConversationPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "گفتگو" })).toBeInTheDocument();
        expect(
          screen.getByRole("tab", { name: /منابع/ })
        ).toBeInTheDocument();
      });
    });
  });
});
