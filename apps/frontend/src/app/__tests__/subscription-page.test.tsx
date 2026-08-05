import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse, delay } from "msw";
import { server } from "@/mocks/server";
import {
  fixturePlans,
  fixtureV1SubscriptionPro,
  fixtureV1EntitlementsResponse,
  fixtureV1UsageResponse,
  createCheckoutIntent,
} from "@legalir/testing";
import type { Plan } from "@legalir/types";
import SubscriptionPage from "@/app/(app)/subscription/page";

const API_BASE = "http://localhost:8000";

// Helper to wrap API response in success envelope
function ok<T>(data: T) {
  return { data, meta: { requestId: "test-request-id" } };
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 60_000 },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <div dir="rtl">{children}</div>
    </QueryClientProvider>
  );
}

// Setup authenticated MSW handlers (no cookie check)
function setupAuthHandlers() {
  server.use(
    http.get(`${API_BASE}/api/v1/subscriptions/current`, async () => {
      await delay(50);
      return HttpResponse.json(ok(fixtureV1SubscriptionPro));
    }),
    http.get(`${API_BASE}/api/v1/entitlements`, async () => {
      await delay(50);
      return HttpResponse.json(ok(fixtureV1EntitlementsResponse));
    }),
    http.get(`${API_BASE}/api/v1/usage`, async () => {
      await delay(50);
      return HttpResponse.json(ok(fixtureV1UsageResponse));
    }),
    http.get(`${API_BASE}/api/v1/plans`, async () => {
      await delay(50);
      return HttpResponse.json(ok(fixturePlans));
    }),
    http.post(`${API_BASE}/api/v1/checkout/intents`, async ({ request }) => {
      await delay(100);
      const body = (await request.json()) as { planCode: string };
      const plan = fixturePlans.find((p: Plan) => p.code === body.planCode) ?? fixturePlans[0]!;
      const intent = createCheckoutIntent(plan.code, "pending");
      intent.paymentUrl = "https://mock-payment.legalir.ir/pay?id=mock-123";
      return HttpResponse.json(ok(intent), { status: 201 });
    }),
    http.get(`${API_BASE}/api/v1/checkout/intents/:id`, async () => {
      await delay(50);
      const intent = createCheckoutIntent("ultra", "paid");
      return HttpResponse.json(ok(intent));
    })
  );
}

describe("Subscription Page", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  // ==========================================
  // Plan Display
  // ==========================================
  describe("Plan Display", () => {
    it("renders all three plans from MSW", async () => {
      setupAuthHandlers();
      render(
        <TestWrapper>
          <SubscriptionPage />
        </TestWrapper>
      );

      await waitFor(
        () => {
          const planCards = screen.getAllByText(/درخواست روزانه/);
          expect(planCards.length).toBeGreaterThanOrEqual(3);
        },
        { timeout: 5000 }
      );
    });

    it("displays discounted prices with crossed-out original prices", async () => {
      setupAuthHandlers();
      render(
        <TestWrapper>
          <SubscriptionPage />
        </TestWrapper>
      );

      await waitFor(
        () => {
          expect(screen.getAllByText("الترا")[0]).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      const struckPrices = document.querySelectorAll(".line-through");
      expect(struckPrices.length).toBeGreaterThanOrEqual(3);
    });

    it("shows Persian-formatted currency", async () => {
      setupAuthHandlers();
      render(
        <TestWrapper>
          <SubscriptionPage />
        </TestWrapper>
      );

      await waitFor(
        () => {
          expect(screen.getAllByText("الترا")[0]).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Sale prices in Persian digits
      expect(screen.getAllByText(/۹۰۰/)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/۲٬۰۰۰/)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/۳٬۰۰۰/)[0]).toBeInTheDocument();
    });

    it("shows duration on each plan card", async () => {
      setupAuthHandlers();
      render(
        <TestWrapper>
          <SubscriptionPage />
        </TestWrapper>
      );

      await waitFor(
        () => {
          const planCards = screen.getAllByText(/درخواست روزانه/);
          expect(planCards.length).toBeGreaterThanOrEqual(3);
        },
        { timeout: 5000 }
      );

      // "۳۰ روز" appears in both plan cards AND in the subscription card
      // (it's the same text for duration). Since the fixture duration is 30 days,
      // we should find at least 3 occurrences
      const durationElements = screen.getAllByText(/۳۰ روز/);
      expect(durationElements.length).toBeGreaterThanOrEqual(3);
    });

    it("exposes usage limits on each plan card", async () => {
      setupAuthHandlers();
      render(
        <TestWrapper>
          <SubscriptionPage />
        </TestWrapper>
      );

      await waitFor(
        () => {
          const dailyReq = screen.getAllByText("درخواست روزانه");
          expect(dailyReq.length).toBeGreaterThanOrEqual(3);
        },
        { timeout: 5000 }
      );

      expect(screen.getAllByText("توکن ماهانه").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("پیام هوش مصنوعی")[0]).toBeInTheDocument();
      expect(screen.getAllByText("تحلیل سند")[0]).toBeInTheDocument();
    });
  });

  // ==========================================
  // Usage Limits & Remaining Quota
  // ==========================================
  describe("Usage Limits", () => {
    it("renders usage summary with progress bars", async () => {
      setupAuthHandlers();
      render(
        <TestWrapper>
          <SubscriptionPage />
        </TestWrapper>
      );

      await waitFor(
        () => {
          expect(screen.getByText("مصرف")).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      const progressBars = screen.getAllByRole("progressbar");
      expect(progressBars.length).toBeGreaterThanOrEqual(3);
    });

    it("shows remaining quota in Persian", async () => {
      setupAuthHandlers();
      render(
        <TestWrapper>
          <SubscriptionPage />
        </TestWrapper>
      );

      await waitFor(
        () => {
          expect(screen.getByText("مصرف")).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      const remainingLabels = screen.getAllByText(/باقی‌مانده/);
      expect(remainingLabels.length).toBeGreaterThanOrEqual(1);
    });

    it("shows days remaining until reset", async () => {
      setupAuthHandlers();
      render(
        <TestWrapper>
          <SubscriptionPage />
        </TestWrapper>
      );

      await waitFor(
        () => {
          expect(screen.getByText(/روز تا بازنشانی/)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  // ==========================================
  // Current Subscription Card
  // ==========================================
  describe("Current Subscription Card", () => {
    it("shows active subscription status", async () => {
      setupAuthHandlers();
      render(
        <TestWrapper>
          <SubscriptionPage />
        </TestWrapper>
      );

      await waitFor(
        () => {
          expect(screen.getByText("وضعیت اشتراک")).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // "پرو" appears in both the subscription card heading and plan cards
      const proElements = screen.getAllByText("پرو");
      expect(proElements.length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("فعال").length).toBeGreaterThanOrEqual(1);
    });

    it("shows auto-renewal status", async () => {
      setupAuthHandlers();
      render(
        <TestWrapper>
          <SubscriptionPage />
        </TestWrapper>
      );

      await waitFor(
        () => {
          expect(screen.getByText("تمدید خودکار:")).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it("highlights current plan card", async () => {
      setupAuthHandlers();
      render(
        <TestWrapper>
          <SubscriptionPage />
        </TestWrapper>
      );

      await waitFor(
        () => {
          expect(screen.getByText("وضعیت اشتراک")).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      expect(screen.getByText("پلن فعلی")).toBeInTheDocument();
    });
  });

  // ==========================================
  // Plan Selection & Confirmation Dialog
  // ==========================================
  describe("Plan Selection", () => {
    it("opens confirmation dialog when selecting a plan", async () => {
      setupAuthHandlers();
      render(
        <TestWrapper>
          <SubscriptionPage />
        </TestWrapper>
      );

      await waitFor(
        () => {
          expect(screen.getByText("وضعیت اشتراک")).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      const ultraSelectBtn = screen.getByText("انتخاب الترا");
      fireEvent.click(ultraSelectBtn);

      await waitFor(() => {
        expect(screen.getByText("انتخاب پلن الترا")).toBeInTheDocument();
      });
    });

    it("closes dialog on cancel", async () => {
      setupAuthHandlers();
      render(
        <TestWrapper>
          <SubscriptionPage />
        </TestWrapper>
      );

      await waitFor(
        () => {
          expect(screen.getByText("وضعیت اشتراک")).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      fireEvent.click(screen.getByText("انتخاب الترا"));

      await waitFor(() => {
        expect(screen.getByText("انتخاب پلن الترا")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("انصراف"));

      await waitFor(() => {
        expect(screen.queryByText("انتخاب پلن الترا")).not.toBeInTheDocument();
      });
    });

    it("shows confirm and cancel buttons in dialog", async () => {
      setupAuthHandlers();
      render(
        <TestWrapper>
          <SubscriptionPage />
        </TestWrapper>
      );

      await waitFor(
        () => {
          expect(screen.getByText("وضعیت اشتراک")).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // The pro_max button text is "ارتقا به پرو مکس" since user is on pro
      fireEvent.click(screen.getByText("ارتقا به پرو مکس"));

      await waitFor(() => {
        expect(screen.getByText("تأیید و پرداخت")).toBeInTheDocument();
        expect(screen.getByText("انصراف")).toBeInTheDocument();
      });
    });
  });

  // ==========================================
  // Checkout States
  // ==========================================
  describe("Checkout Flow", () => {
    it("shows paid payment status after confirming checkout", async () => {
      setupAuthHandlers();
      render(
        <TestWrapper>
          <SubscriptionPage />
        </TestWrapper>
      );

      await waitFor(
        () => {
          expect(screen.getByText("وضعیت اشتراک")).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      fireEvent.click(screen.getByText("انتخاب الترا"));

      await waitFor(() => {
        expect(screen.getByText("تأیید و پرداخت")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("تأیید و پرداخت"));

      // After checkout, the GET intent mock resolves to "paid" status,
      // so we see "پرداخت شده" (the polling changes from pending→paid immediately)
      await waitFor(
        () => {
          expect(screen.getByText(/پرداخت شده/)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  // ==========================================
  // Locked / Upgrade Feature States
  // ==========================================
  describe("Locked Features", () => {
    it("shows boolean features as active or inactive", async () => {
      setupAuthHandlers();
      render(
        <TestWrapper>
          <SubscriptionPage />
        </TestWrapper>
      );

      await waitFor(
        () => {
          expect(screen.getByText("قابلیت‌های ویژه")).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      const advRef = screen.getAllByText("منابع پیشرفته");
      expect(advRef.length).toBeGreaterThanOrEqual(1);

      const priProc = screen.getAllByText("اولویت پردازش");
      expect(priProc.length).toBeGreaterThanOrEqual(1);
    });

    it("shows inactive label for disabled boolean features", async () => {
      setupAuthHandlers();
      render(
        <TestWrapper>
          <SubscriptionPage />
        </TestWrapper>
      );

      await waitFor(
        () => {
          expect(screen.getByText("قابلیت‌های ویژه")).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // "PRIORITY_PROCESSING" is disabled in pro plan → shows "غیرفعال"
      const inactiveLabels = screen.getAllByText("غیرفعال");
      expect(inactiveLabels.length).toBeGreaterThanOrEqual(1);
    });
  });
});
