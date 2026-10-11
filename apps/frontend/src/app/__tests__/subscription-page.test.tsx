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
  fixtureV1UsageResponse,
} from "@legalir/testing";
import type {
  PlanCode,
  CheckoutQuote,
  CheckoutOrderView,
  CouponValidationResponse,
} from "@legalir/types";
import SubscriptionPage from "@/app/(app)/subscription/page";

const API_BASE = "http://localhost:8000";

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

// Setup authenticated MSW handlers (no cookie check). The checkout routes are
// parameterised so a test can pin the final amount (free vs gateway path), the
// order status the commit returns, and whether a coupon validates.
function setupAuthHandlers(
  opts: {
    /** Final amount /quote returns; 0 drives the free-activation path. */
    quoteFinalAmount?: number;
    /** Order status the /orders commit returns. */
    orderStatus?: CheckoutOrderView["status"];
    /** Whether the coupon validate route accepts the code. */
    couponValid?: boolean;
  } = {}
) {
  const quoteFinalAmount = opts.quoteFinalAmount ?? 2_500_000;
  const orderStatus =
    opts.orderStatus ?? (quoteFinalAmount === 0 ? "no_payment_required" : "awaiting_payment");

  function quoteFor(couponCode?: string | null): CheckoutQuote {
    if (couponCode) {
      // A valid 100%-off coupon zeroes the total → the free-activation path.
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
      return HttpResponse.json(ok(fixtureV1SubscriptionGold));
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
      return HttpResponse.json(
        ok({ order: makeOrder(orderStatus), messageFa: "سفارش ثبت شد." }),
        { status: 201 }
      );
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
          expect(screen.getAllByText("نقره")[0]).toBeInTheDocument();
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
          expect(screen.getAllByText("نقره")[0]).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Sale prices displayed in Persian digits with "تومان"
      expect(screen.getAllByText(/تومان/).length).toBeGreaterThanOrEqual(3);
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

      // "طلا" appears in both the subscription card heading and plan cards
      const goldElements = screen.getAllByText("طلا");
      expect(goldElements.length).toBeGreaterThanOrEqual(2);
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

      // The current-plan badge lives on the plan card, which resolves on its
      // own (delayed) query — await it rather than racing the skeletons.
      expect(await screen.findByText("اشتراک فعلی")).toBeInTheDocument();
    });
  });

  // ==========================================
  // Plan Selection → Order-review modal
  // ==========================================
  describe("Plan Selection", () => {
    it("opens the order-review modal when selecting a plan", async () => {
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

      // On an active gold subscription the silver plan is a non-upgrade
      // selectable plan, so its CTA label is «خرید اشتراک».
      fireEvent.click(await screen.findByText("خرید اشتراک"));

      await waitFor(() => {
        expect(screen.getByText("بازبینی و تأیید سفارش")).toBeInTheDocument();
      });
    });

    it("closes the modal on cancel", async () => {
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

      fireEvent.click(await screen.findByText("خرید اشتراک"));

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

      fireEvent.click(await screen.findByText("خرید اشتراک"));

      // The breakdown lines and the single deciding figure come straight from
      // the quote response — the modal computes nothing itself.
      expect(await screen.findByText("مبلغ پایه پلن")).toBeInTheDocument();
      expect(screen.getByText("مبلغ نهایی")).toBeInTheDocument();
      expect(screen.getAllByText(/تومان/).length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================
  // Checkout flow — behaviour is decided by the server's final amount
  // ==========================================
  describe("Checkout Flow", () => {
    it("activates a free (zero-total) subscription and shows a tracking number", async () => {
      setupAuthHandlers({ quoteFinalAmount: 0, orderStatus: "no_payment_required" });
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

      fireEvent.click(await screen.findByText("خرید اشتراک"));

      // Wait for the server quote to land (the invoice renders only then) so the
      // confirm button is enabled — clicking a loading quote's button is a no-op.
      await screen.findByText("مبلغ پایه پلن");
      // Zero total → no gateway option, a single free-activation button.
      const confirm = await screen.findByText("تأیید و فعال‌سازی اشتراک");
      fireEvent.click(confirm);

      await waitFor(() => {
        expect(screen.getByText("اشتراک فعال شد")).toBeInTheDocument();
      });
      // The server's order reference is surfaced verbatim.
      expect(screen.getByText("LR-2026-000123")).toBeInTheDocument();
    });

    it("shows a gateway notice for a positive total and never fabricates success", async () => {
      setupAuthHandlers({ quoteFinalAmount: 2_500_000, orderStatus: "awaiting_payment" });
      const showSpy = vi.spyOn(snackbar, "show");
      try {
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

        fireEvent.click(await screen.findByText("خرید اشتراک"));

        // Wait for the quote so the gateway button is enabled (not a loading no-op).
        await screen.findByText("مبلغ پایه پلن");
        const payBtn = await screen.findByText("پرداخت و فعال‌سازی");
        fireEvent.click(payBtn);

        // The gateway is inactive: a notice is shown and NOTHING is activated —
        // no fabricated success, no order, no tracking number.
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

      fireEvent.click(await screen.findByText("خرید اشتراک"));

      const couponInput = await screen.findByLabelText("کد تخفیف");
      fireEvent.change(couponInput, { target: { value: "legal1404" } });
      fireEvent.click(screen.getByText("اعمال"));

      // The server re-derives the whole breakdown once the coupon applies.
      await waitFor(() => {
        expect(screen.getByText("رایگان")).toBeInTheDocument();
      });
      expect(screen.getByText("تأیید و فعال‌سازی اشتراک")).toBeInTheDocument();
    });

    it("shows the server's message and does not apply an invalid coupon", async () => {
      setupAuthHandlers({ quoteFinalAmount: 2_500_000, couponValid: false });
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

      fireEvent.click(await screen.findByText("خرید اشتراک"));

      const couponInput = await screen.findByLabelText("کد تخفیف");
      fireEvent.change(couponInput, { target: { value: "EXPIRED" } });
      fireEvent.click(screen.getByText("اعمال"));

      await waitFor(() => {
        expect(
          screen.getByText("مهلت استفاده از این کد تخفیف به پایان رسیده است.")
        ).toBeInTheDocument();
      });
      // The coupon was not applied → the gateway path is still in force.
      expect(screen.getByText("پرداخت و فعال‌سازی")).toBeInTheDocument();
    });

    it("reverts to the paid total when the applied coupon is removed", async () => {
      setupAuthHandlers({ quoteFinalAmount: 2_500_000, couponValid: true });
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

      fireEvent.click(await screen.findByText("خرید اشتراک"));

      const couponInput = await screen.findByLabelText("کد تخفیف");
      fireEvent.change(couponInput, { target: { value: "legal1404" } });
      fireEvent.click(screen.getByText("اعمال"));
      // Applied → free total.
      await waitFor(() => expect(screen.getByText("رایگان")).toBeInTheDocument());

      // Removing re-keys the quote back to the server's paid total.
      fireEvent.click(screen.getByText("حذف"));
      await waitFor(() => {
        expect(screen.getByText("پرداخت و فعال‌سازی")).toBeInTheDocument();
      });
      expect(screen.queryByText("رایگان")).not.toBeInTheDocument();
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
