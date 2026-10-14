import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SnackbarProvider, snackbar } from "@legalir/ui";
import { http, HttpResponse, delay } from "msw";
import { server } from "@/mocks/server";
import {
  fixturePlans,
  fixtureV1SubscriptionGold,
  fixtureV1EntitlementsResponse,
} from "@legalir/testing";
import type {
  PlanCode,
  CheckoutQuote,
  CheckoutOrderView,
  CouponValidationResponse,
  SubscriptionUsageSummary,
  V1Subscription,
  V1SubscriptionHistoryItem,
  V1SubscriptionHistoryResponse,
} from "@legalir/types";
import SubscriptionPage from "@/app/(app)/subscription/page";

const API_BASE = "http://localhost:8000";

// ---------------------------------------------------------------------------
// Usage-engine fixture — today's ENERGY (credit), period quotas, reward points
// ---------------------------------------------------------------------------

const usageSummary: SubscriptionUsageSummary = {
  hasSubscription: true,
  planCode: "gold",
  planNameFa: "طلا",
  expiresAt: "2027-07-01T00:00:00Z",
  daysRemaining: 262,
  subscriptionExpired: false,
  daily: {
    usageDate: "2026-07-05",
    requestLimit: 150,
    requestUsed: 12,
    requestsRemaining: 138,
    pointsTotal: 1000,
    pointsUsed: 250,
    pointsRemaining: 750,
    resetAt: "2026-07-06T20:30:00.000Z",
  },
  period: [
    { quotaType: "AI_MESSAGES", nameFa: "پیام هوش مصنوعی", limit: 4500, used: 127, remaining: 4373, unlimited: false },
    { quotaType: "DOCUMENT_ANALYSIS", nameFa: "تحلیل سند", limit: 15, used: 3, remaining: 12, unlimited: false },
  ],
  rewardPoints: 320,
  allowRewardPointsAfterLimit: true,
};

const noSubscriptionUsage: SubscriptionUsageSummary = {
  ...usageSummary,
  hasSubscription: false,
  planCode: null,
  planNameFa: null,
  expiresAt: null,
  daysRemaining: null,
  subscriptionExpired: false,
  daily: {
    ...usageSummary.daily,
    pointsTotal: 0,
    pointsUsed: 0,
    pointsRemaining: 0,
    requestLimit: 0,
    requestUsed: 0,
    requestsRemaining: 0,
  },
  period: [],
  rewardPoints: 0,
};

// ---------------------------------------------------------------------------
// Purchase history fixture — two real records
// ---------------------------------------------------------------------------

const historyItems: V1SubscriptionHistoryItem[] = [
  {
    id: "sub-silver-1",
    planNameFa: "نقره",
    planCode: "silver",
    amount: 2_500_000,
    currency: "IRT",
    startAt: "2026-05-01T00:00:00Z",
    endAt: "2026-05-31T00:00:00Z",
    status: "expired",
    statusFa: "منقضی‌شده",
    purchasedAt: "2026-05-01T00:00:00Z",
  },
  {
    id: "sub-gold-001",
    planNameFa: "طلا",
    planCode: "gold",
    amount: 3_500_000,
    currency: "IRT",
    startAt: "2026-07-01T00:00:00Z",
    endAt: "2027-07-01T00:00:00Z",
    status: "active",
    statusFa: "فعال",
    purchasedAt: "2026-07-01T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Server-computed checkout fixtures
// ---------------------------------------------------------------------------
// The order-review modal renders ONLY what the server returns, so the tests
// drive behaviour by shaping these responses — never by asserting client math.

/** A silver quote; `finalAmount` decides free-vs-gateway in the modal. */
function makeQuote(finalAmount: number, overrides: Partial<CheckoutQuote> = {}): CheckoutQuote {
  const base = 2_500_000;
  return {
    planCode: "silver" as PlanCode,
    planNameFa: "نقره",
    durationDays: 30,
    currency: "IRT",
    listPrice: 5_000_000,
    basePrice: base,
    coupon: null,
    discountAmount: base - finalAmount,
    discountPercent: 0,
    taxAmount: 0,
    taxRatePercent: 0,
    taxLabelFa: "بدون مالیات",
    otherAmount: 0,
    finalAmount,
    requiresPayment: finalAmount > 0,
    lines: [
      { key: "base", labelFa: "مبلغ پایه پلن", amount: base },
      { key: "discount", labelFa: "تخفیف", amount: -(base - finalAmount) },
      { key: "tax", labelFa: "مالیات", amount: 0, hintFa: "بدون مالیات" },
    ],
    quotedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** The order the server returns after a successful commit. */
function makeOrder(
  status: CheckoutOrderView["status"],
  overrides: Partial<CheckoutOrderView> = {}
): CheckoutOrderView {
  const free = status === "no_payment_required";
  return {
    id: "ord-1",
    referenceId: "LR-2026-000123",
    planCode: "silver",
    planNameFa: "نقره",
    status,
    statusFa: free ? "بدون نیاز به پرداخت" : "در انتظار پرداخت",
    currency: "IRT",
    basePrice: 2_500_000,
    discountAmount: 2_500_000,
    discountPercent: 100,
    couponCode: "LEGAL1404",
    taxAmount: 0,
    finalAmount: free ? 0 : 2_500_000,
    collectedAmount: 0,
    requiresPayment: !free,
    gateway: free ? "none" : "mock",
    subscriptionId: free ? "sub-silver-1" : null,
    startAt: new Date().toISOString(),
    endAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    createdAt: new Date().toISOString(),
    paidAt: free ? new Date().toISOString() : null,
    ...overrides,
  };
}

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
      <SnackbarProvider>
        <div dir="rtl">{children}</div>
      </SnackbarProvider>
    </QueryClientProvider>
  );
}

interface SetupOptions {
  /** Final amount /quote returns; 0 drives the free-activation path. */
  quoteFinalAmount?: number;
  /** Order status the /orders commit returns. */
  orderStatus?: CheckoutOrderView["status"];
  /** Whether the coupon validate route accepts the code. */
  couponValid?: boolean;
  /** The current subscription (null = no active subscription). */
  subscription?: V1Subscription | null;
  /** The history the page lists. */
  history?: V1SubscriptionHistoryItem[];
  /** The usage-engine summary the page renders. */
  usage?: SubscriptionUsageSummary;
}

// Setup authenticated MSW handlers (no cookie check). The checkout routes are
// parameterised so a test can pin the final amount (free vs gateway path), the
// order status the commit returns, and whether a coupon validates.
function setupAuthHandlers(opts: SetupOptions = {}) {
  const quoteFinalAmount = opts.quoteFinalAmount ?? 2_500_000;
  const orderStatus =
    opts.orderStatus ?? (quoteFinalAmount === 0 ? "no_payment_required" : "awaiting_payment");
  const subscription =
    opts.subscription === undefined ? fixtureV1SubscriptionGold : opts.subscription;
  const history = opts.history ?? historyItems;
  const usage = opts.usage ?? usageSummary;

  function quoteFor(couponCode?: string | null): CheckoutQuote {
    if (couponCode) {
      return makeQuote(0, {
        coupon: {
          code: couponCode,
          titleFa: "کمپین نوروز",
          kind: "percent",
          value: 100,
          discountAmount: 2_500_000,
        },
        discountPercent: 100,
      });
    }
    return makeQuote(quoteFinalAmount);
  }

  server.use(
    http.get(`${API_BASE}/api/v1/subscriptions/current`, async () => {
      await delay(50);
      return HttpResponse.json(ok(subscription));
    }),
    http.get(`${API_BASE}/api/v1/entitlements`, async () => {
      await delay(50);
      return HttpResponse.json(
        ok(
          subscription
            ? fixtureV1EntitlementsResponse
            : { entitlements: [], planCode: null, planNameFa: null }
        )
      );
    }),
    http.get(`${API_BASE}/api/v1/subscription/usage`, async () => {
      await delay(50);
      return HttpResponse.json(ok(usage));
    }),
    http.get(`${API_BASE}/api/v1/subscription-history`, async () => {
      await delay(50);
      return HttpResponse.json(
        ok({
          items: history,
          pagination: { page: 1, pageSize: 20, total: history.length, totalPages: 1 },
        } satisfies V1SubscriptionHistoryResponse)
      );
    }),
    http.get(`${API_BASE}/api/v1/plans`, async () => {
      await delay(50);
      return HttpResponse.json(ok(fixturePlans));
    }),
    http.post(`${API_BASE}/api/v1/checkout/quote`, async ({ request }) => {
      await delay(50);
      const body = (await request.json()) as { planCode?: string; couponCode?: string };
      return HttpResponse.json(ok({ quote: quoteFor(body.couponCode), couponError: null }));
    }),
    http.post(`${API_BASE}/api/v1/checkout/coupons/validate`, async ({ request }) => {
      await delay(50);
      const body = (await request.json()) as { planCode?: string; couponCode?: string };
      const valid = opts.couponValid ?? true;
      const res: CouponValidationResponse = valid
        ? {
            valid: true,
            errorCode: null,
            messageFa: "کد تخفیف اعمال شد.",
            coupon: {
              code: body.couponCode ?? "LEGAL1404",
              titleFa: "کمپین نوروز",
              kind: "percent",
              value: 100,
              discountAmount: 2_500_000,
            },
            quote: makeQuote(0),
          }
        : {
            valid: false,
            errorCode: "COUPON_EXPIRED" as CouponValidationResponse["errorCode"],
            messageFa: "مهلت استفاده از این کد تخفیف به پایان رسیده است.",
            coupon: null,
            quote: null,
          };
      return HttpResponse.json(ok(res));
    }),
    http.post(`${API_BASE}/api/v1/checkout/orders`, async () => {
      await delay(80);
      return HttpResponse.json(ok({ order: makeOrder(orderStatus), messageFa: "سفارش ثبت شد." }), {
        status: 201,
      });
    })
  );
}

function renderPage() {
  return render(
    <TestWrapper>
      <SubscriptionPage />
    </TestWrapper>
  );
}

/** Switch to a tab by its visible label. */
function gotoTab(label: "وضعیت اشتراک" | "تاریخچه خرید" | "پلن‌ها") {
  fireEvent.click(screen.getByRole("tab", { name: label }));
}

describe("Subscription Page", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  // ==========================================
  // Tabs
  // ==========================================
  describe("Tabs", () => {
    it("renders the three separated tabs", async () => {
      setupAuthHandlers();
      renderPage();

      const tabs = await screen.findAllByRole("tab");
      expect(tabs.map((t) => t.textContent)).toEqual(
        expect.arrayContaining(["وضعیت اشتراک", "تاریخچه خرید", "پلن‌ها"])
      );
    });
  });

  // ==========================================
  // Status tab — energy + current subscription
  // ==========================================
  describe("Status tab", () => {
    it("shows today's energy (credit) from the usage engine", async () => {
      setupAuthHandlers();
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("انرژی امروز اشتراک")).toBeInTheDocument();
      });
      // 750 remaining of 1000 — the real points figures, Persian-formatted.
      expect(screen.getAllByText(/۷۵۰/).length).toBeGreaterThanOrEqual(1);
    });

    it("shows the active subscription with its real dates", async () => {
      setupAuthHandlers();
      renderPage();

      // The panel heading only exists once the data has loaded (the tab button
      // shares the same text, so query the heading to avoid resolving early).
      await screen.findByRole("heading", { name: "وضعیت اشتراک" }, { timeout: 5000 });

      expect(screen.getAllByText("فعال").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("تاریخ شروع")).toBeInTheDocument();
      expect(screen.getByText("تاریخ پایان")).toBeInTheDocument();
      expect(screen.getByText("تمدید خودکار")).toBeInTheDocument();
    });

    it("shows the period quotas for an active subscription", async () => {
      setupAuthHandlers();
      renderPage();

      await screen.findByRole("heading", { name: "سهمیه‌های دوره" }, { timeout: 5000 });
      expect(screen.getByText("پیام هوش مصنوعی")).toBeInTheDocument();
    });

    it("shows an empty state AND the purchasable plans when there is no active subscription", async () => {
      setupAuthHandlers({ subscription: null, usage: noSubscriptionUsage });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("اشتراک فعالی ندارید")).toBeInTheDocument();
      });

      // The plans are surfaced right here — the user needn't hunt for them.
      expect(screen.getByText("پلن‌های پیشنهادی")).toBeInTheDocument();
      expect(screen.getByText("مشاهده و مقایسهٔ همه")).toBeInTheDocument();
      // The compact plan cards resolve on their own (delayed) query.
      expect(await screen.findByText("نقره")).toBeInTheDocument();
    });
  });

  // ==========================================
  // History tab — records + per-record details
  // ==========================================
  describe("History tab", () => {
    it("lists every purchase with its status and amount", async () => {
      setupAuthHandlers();
      renderPage();

      await screen.findByRole("heading", { name: "وضعیت اشتراک" }, { timeout: 5000 });
      gotoTab("تاریخچه خرید");

      // The history panel heading is unique (the tab is a button, not a heading).
      await screen.findByRole("heading", { name: "تاریخچه خرید" }, { timeout: 5000 });
      // Both records are present (desktop table + mobile card variants).
      expect(screen.getAllByText("نقره").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("طلا").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("منقضی‌شده").length).toBeGreaterThanOrEqual(1);
    });

    it("opens the details of the exact record whose «جزئیات» was clicked", async () => {
      setupAuthHandlers();
      renderPage();

      await screen.findByRole("heading", { name: "وضعیت اشتراک" }, { timeout: 5000 });
      gotoTab("تاریخچه خرید");

      const detailsButtons = await screen.findAllByText("جزئیات");
      // The first record in the fixture is the expired silver purchase.
      fireEvent.click(detailsButtons[0]!);

      await waitFor(() => {
        expect(screen.getByText("جزئیات خرید")).toBeInTheDocument();
      });
      // The record's own id is shown (mono) — proving it is THIS record.
      expect(screen.getByText("sub-silver-1")).toBeInTheDocument();
      expect(screen.getByText("شناسهٔ اشتراک")).toBeInTheDocument();
      expect(screen.getByText("مبلغ پرداختی")).toBeInTheDocument();
    });

    it("shows an empty state when there is no purchase history", async () => {
      setupAuthHandlers({ history: [] });
      renderPage();

      await screen.findByRole("heading", { name: "وضعیت اشتراک" }, { timeout: 5000 });
      gotoTab("تاریخچه خرید");

      await waitFor(() => {
        expect(screen.getByText("تاریخچه‌ای وجود ندارد")).toBeInTheDocument();
      });
      expect(screen.getByText("مشاهده پلن‌ها")).toBeInTheDocument();
    });
  });

  // ==========================================
  // Plans tab — plan cards
  // ==========================================
  describe("Plans tab", () => {
    it("renders all three plans with their real limits", async () => {
      setupAuthHandlers();
      renderPage();

      await screen.findByRole("heading", { name: "وضعیت اشتراک" }, { timeout: 5000 });
      gotoTab("پلن‌ها");

      await waitFor(
        () => {
          const planCards = screen.getAllByText(/درخواست روزانه/);
          expect(planCards.length).toBeGreaterThanOrEqual(3);
        },
        { timeout: 5000 }
      );
      expect(screen.getAllByText("توکن ماهانه").length).toBeGreaterThanOrEqual(1);
    });

    it("shows discounted prices with crossed-out original prices", async () => {
      setupAuthHandlers();
      renderPage();

      await screen.findByRole("heading", { name: "وضعیت اشتراک" }, { timeout: 5000 });
      gotoTab("پلن‌ها");

      await waitFor(
        () => {
          expect(screen.getAllByText("نقره")[0]).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      const struckPrices = document.querySelectorAll(".line-through");
      expect(struckPrices.length).toBeGreaterThanOrEqual(3);
    });

    it("highlights the current plan card", async () => {
      setupAuthHandlers();
      renderPage();

      await screen.findByRole("heading", { name: "وضعیت اشتراک" }, { timeout: 5000 });
      gotoTab("پلن‌ها");

      expect(await screen.findByText("اشتراک فعلی")).toBeInTheDocument();
    });
  });

  // ==========================================
  // Plan Selection → Order-review modal
  // ==========================================
  describe("Plan Selection", () => {
    async function openCheckout() {
      await screen.findByRole("heading", { name: "وضعیت اشتراک" }, { timeout: 5000 });
      gotoTab("پلن‌ها");
      // On an active gold subscription the silver plan is a non-upgrade
      // selectable plan, so its CTA label is «خرید اشتراک».
      fireEvent.click(await screen.findByText("خرید اشتراک"));
    }

    it("opens the order-review modal when selecting a plan", async () => {
      setupAuthHandlers();
      renderPage();

      await openCheckout();

      await waitFor(() => {
        expect(screen.getByText("بازبینی و تأیید سفارش")).toBeInTheDocument();
      });
    });

    it("closes the modal on cancel", async () => {
      setupAuthHandlers();
      renderPage();

      await openCheckout();
      await waitFor(() => {
        expect(screen.getByText("بازبینی و تأیید سفارش")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("انصراف"));

      await waitFor(() => {
        expect(screen.queryByText("بازبینی و تأیید سفارش")).not.toBeInTheDocument();
      });
    });

    it("renders the server-computed invoice breakdown", async () => {
      setupAuthHandlers({ quoteFinalAmount: 2_500_000 });
      renderPage();

      await openCheckout();

      expect(await screen.findByText("مبلغ پایه پلن")).toBeInTheDocument();
      expect(screen.getByText("مبلغ نهایی")).toBeInTheDocument();
    });
  });

  // ==========================================
  // Checkout flow — behaviour is decided by the server's final amount
  // ==========================================
  describe("Checkout Flow", () => {
    async function openCheckout() {
      await screen.findByRole("heading", { name: "وضعیت اشتراک" }, { timeout: 5000 });
      gotoTab("پلن‌ها");
      fireEvent.click(await screen.findByText("خرید اشتراک"));
    }

    it("activates a free (zero-total) subscription and shows a tracking number", async () => {
      setupAuthHandlers({ quoteFinalAmount: 0, orderStatus: "no_payment_required" });
      renderPage();

      await openCheckout();
      await screen.findByText("مبلغ پایه پلن");
      const confirm = await screen.findByText("تأیید و فعال‌سازی اشتراک");
      fireEvent.click(confirm);

      await waitFor(() => {
        expect(screen.getByText("اشتراک فعال شد")).toBeInTheDocument();
      });
      expect(screen.getByText("LR-2026-000123")).toBeInTheDocument();
    });

    it("shows a gateway notice for a positive total and never fabricates success", async () => {
      setupAuthHandlers({ quoteFinalAmount: 2_500_000, orderStatus: "awaiting_payment" });
      const showSpy = vi.spyOn(snackbar, "show");
      try {
        renderPage();

        await openCheckout();
        await screen.findByText("مبلغ پایه پلن");
        const payBtn = await screen.findByText("پرداخت و فعال‌سازی");
        fireEvent.click(payBtn);

        await waitFor(() => {
          expect(showSpy).toHaveBeenCalled();
        });
        const last = showSpy.mock.calls.at(-1)?.[0];
        expect(last?.message).toMatch(/درگاه پرداخت/);
        expect(last?.variant).toBe("info");
        expect(screen.queryByText("اشتراک فعال شد")).not.toBeInTheDocument();
        expect(screen.queryByText("LR-2026-000123")).not.toBeInTheDocument();
      } finally {
        showSpy.mockRestore();
      }
    });

    it("re-quotes to a free total after applying a valid coupon", async () => {
      setupAuthHandlers({ quoteFinalAmount: 2_500_000, couponValid: true });
      renderPage();

      await openCheckout();

      const couponInput = await screen.findByLabelText("کد تخفیف");
      fireEvent.change(couponInput, { target: { value: "legal1404" } });
      fireEvent.click(screen.getByText("اعمال"));

      await waitFor(() => {
        expect(screen.getByText("رایگان")).toBeInTheDocument();
      });
      expect(screen.getByText("تأیید و فعال‌سازی اشتراک")).toBeInTheDocument();
    });

    it("shows the server's message and does not apply an invalid coupon", async () => {
      setupAuthHandlers({ quoteFinalAmount: 2_500_000, couponValid: false });
      renderPage();

      await openCheckout();

      const couponInput = await screen.findByLabelText("کد تخفیف");
      fireEvent.change(couponInput, { target: { value: "EXPIRED" } });
      fireEvent.click(screen.getByText("اعمال"));

      await waitFor(() => {
        expect(
          screen.getByText("مهلت استفاده از این کد تخفیف به پایان رسیده است.")
        ).toBeInTheDocument();
      });
      expect(screen.getByText("پرداخت و فعال‌سازی")).toBeInTheDocument();
    });

    it("reverts to the paid total when the applied coupon is removed", async () => {
      setupAuthHandlers({ quoteFinalAmount: 2_500_000, couponValid: true });
      renderPage();

      await openCheckout();

      const couponInput = await screen.findByLabelText("کد تخفیف");
      fireEvent.change(couponInput, { target: { value: "legal1404" } });
      fireEvent.click(screen.getByText("اعمال"));
      await waitFor(() => expect(screen.getByText("رایگان")).toBeInTheDocument());

      fireEvent.click(screen.getByText("حذف"));
      await waitFor(() => {
        expect(screen.getByText("پرداخت و فعال‌سازی")).toBeInTheDocument();
      });
      expect(screen.queryByText("رایگان")).not.toBeInTheDocument();
    });
  });

  // ==========================================
  // Boolean feature states
  // ==========================================
  describe("Boolean features", () => {
    it("shows boolean features as active or inactive", async () => {
      setupAuthHandlers();
      renderPage();

      await waitFor(() => {
        expect(screen.getByText("قابلیت‌های ویژه")).toBeInTheDocument();
      });

      expect(screen.getAllByText("منابع پیشرفته").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("غیرفعال").length).toBeGreaterThanOrEqual(1);
    });
  });
});
