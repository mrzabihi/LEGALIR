// ============================================================
// LEGALIR — PointsSummaryCard: shared source of truth with the header
// ============================================================
// The card and the header badge must read the SAME React Query key
// (["rewards","summary"]). These tests prove they render identical
// balances and that a single cache invalidation updates both — no full
// page reload, no second request path.
// ============================================================

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { PointsSummaryCard } from "../points-summary-card";
import { TopBar } from "@/components/app/top-bar";
import { toPersianNumber } from "@/lib/persian-utils";
import type { RewardsSummary, RewardsHistoryResponse } from "@legalir/types";

const API_BASE = "http://localhost:8000";

function ok<T>(data: T) {
  return { data, meta: { requestId: "test-request-id" } };
}

function summary(balance: number): RewardsSummary {
  return {
    balance,
    today: { visitRewardClaimed: false, pointsAwarded: 0 },
    rules: [],
  };
}

function history(items: { id: string; pointsDelta: number }[]): RewardsHistoryResponse {
  return {
    items: items.map((i) => ({
      id: i.id,
      eventType: "REQUEST_CONSUMED",
      pointsDelta: i.pointsDelta,
      sourceType: "chat",
      sourceId: i.id,
      description: "کسر انرژی",
      createdAt: "2026-09-16T10:00:00Z",
    })),
    pagination: { page: 1, pageSize: 6, total: items.length, totalPages: 1 },
  };
}

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });
}

function renderBoth(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <div dir="rtl">
        <TopBar />
        <PointsSummaryCard />
      </div>
    </QueryClientProvider>
  );
}

describe("PointsSummaryCard — shared rewards source of truth", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it("renders the same balance as the header badge", async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/rewards/summary`, () => HttpResponse.json(ok(summary(1200)))),
      http.get(`${API_BASE}/api/v1/rewards/history`, () =>
        HttpResponse.json(ok(history([{ id: "e1", pointsDelta: -200 }])))
      ),
      http.get(`${API_BASE}/api/v1/me`, () =>
        HttpResponse.json(ok({ user: null, profile: null }))
      )
    );

    renderBoth(makeClient());

    const expected = toPersianNumber(1200);
    // Header badge + dashboard card both show ۱٬۲۰۰.
    await waitFor(() => {
      expect(screen.getAllByText(expected).length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows the last change from the real ledger, not a hard-coded value", async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/rewards/summary`, () => HttpResponse.json(ok(summary(1100)))),
      http.get(`${API_BASE}/api/v1/rewards/history`, () =>
        HttpResponse.json(ok(history([{ id: "e1", pointsDelta: -100 }])))
      ),
      http.get(`${API_BASE}/api/v1/me`, () =>
        HttpResponse.json(ok({ user: null, profile: null }))
      )
    );

    renderBoth(makeClient());

    // −۱۰۰ rendered with the locale minus sign, from the ledger entry.
    await waitFor(() => {
      expect(screen.getByText(toPersianNumber(-100))).toBeInTheDocument();
    });
  });

  it("supports a positive last change (e.g. a subscription reward)", async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/rewards/summary`, () => HttpResponse.json(ok(summary(850)))),
      http.get(`${API_BASE}/api/v1/rewards/history`, () =>
        HttpResponse.json(ok(history([{ id: "e1", pointsDelta: 850 }])))
      ),
      http.get(`${API_BASE}/api/v1/me`, () =>
        HttpResponse.json(ok({ user: null, profile: null }))
      )
    );

    renderBoth(makeClient());

    await waitFor(() => {
      expect(screen.getByText(`+${toPersianNumber(850)}`)).toBeInTheDocument();
    });
  });

  it("updates both header and card after a single cache invalidation", async () => {
    let balance = 1200;
    server.use(
      http.get(`${API_BASE}/api/v1/rewards/summary`, () => HttpResponse.json(ok(summary(balance)))),
      http.get(`${API_BASE}/api/v1/rewards/history`, () =>
        HttpResponse.json(ok(history([{ id: "e1", pointsDelta: -200 }])))
      ),
      http.get(`${API_BASE}/api/v1/me`, () =>
        HttpResponse.json(ok({ user: null, profile: null }))
      )
    );

    const client = makeClient();
    renderBoth(client);

    await waitFor(() => {
      expect(screen.getAllByText(toPersianNumber(1200)).length).toBeGreaterThanOrEqual(2);
    });

    // Simulate a completed action: backend balance drops, one invalidation.
    balance = 1000;
    await client.invalidateQueries({ queryKey: ["rewards", "summary"] });

    await waitFor(() => {
      expect(screen.getAllByText(toPersianNumber(1000)).length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.queryByText(toPersianNumber(1200))).not.toBeInTheDocument();
  });

  it("shows a non-misleading fallback when the API fails (never a fake 0)", async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/rewards/summary`, () =>
        HttpResponse.json({ code: "ERROR", message: "boom" }, { status: 500 })
      ),
      http.get(`${API_BASE}/api/v1/rewards/history`, () =>
        HttpResponse.json({ code: "ERROR", message: "boom" }, { status: 500 })
      ),
      http.get(`${API_BASE}/api/v1/me`, () =>
        HttpResponse.json(ok({ user: null, profile: null }))
      )
    );

    render(
      <QueryClientProvider client={makeClient()}>
        <div dir="rtl">
          <PointsSummaryCard />
        </div>
      </QueryClientProvider>
    );

    // The hook retries once with a ~1s backoff before settling on error.
    await waitFor(
      () => {
        expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 4000 }
    );
    expect(screen.queryByText("۰")).not.toBeInTheDocument();
  });
});
