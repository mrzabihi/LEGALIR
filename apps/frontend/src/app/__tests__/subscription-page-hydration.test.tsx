// ============================================================
// LEGALIR — /subscription hydration regression
// ============================================================
// Same bug class as the /dashboard, /points and /profile fixes (2026-10-12).
//
// The page reads `useCurrentSubscription()` (`["v1","subscriptions","current"]`)
// — the SAME query the header's SubscriptionStatusChip reads — to derive
// `hasActiveSubscription`, which gates the reward-points cross-link at the
// bottom of the page. That banner sits in the main return, OUTSIDE the status
// tab's `usageQuery.isLoading` mask, so a shell-warmed subscription flips it on
// at hydration while the server (where the chip's fetch is still pending)
// rendered it hidden → mismatch.
//
// This test renders the REAL page with every hook/child stubbed down to that
// banner: `useSubscriptionUsage` (page-owned) stays pending on both sides, so
// `hasActiveSubscription` is the only variable.
// ============================================================

import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { act } from "react";

const h = vi.hoisted(() => ({ shellWarm: false, forceUnguarded: false }));

vi.mock("@/hooks/useIsHydrated", async () => {
  const ReactRuntime = await import("react");
  const noop = () => () => undefined;
  return {
    useIsHydrated: () => {
      // Always call the store hook; only the RESULT is forced in control mode.
      const hydrated = ReactRuntime.useSyncExternalStore(noop, () => true, () => false);
      return h.forceUnguarded ? true : hydrated;
    },
  };
});

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

// Heavy children — irrelevant to the banner; render nothing.
vi.mock("@/components/shared/page-intro-banner", () => ({ PageIntroBanner: () => null }));
vi.mock("@/components/subscription/plan-carousel", () => ({ PlanCarousel: () => null }));
vi.mock("@/components/subscription/checkout-modal", () => ({ CheckoutModal: () => null }));
vi.mock("@/components/subscription/subscription-details-dialog", () => ({
  SubscriptionDetailsDialog: () => null,
}));

// @legalir/ui primitives used by the status-tab skeleton.
vi.mock("@legalir/ui", () => ({
  Button: () => null,
  ProgressLinear: () => null,
  SkeletonCard: () => <div data-skeleton />,
  Tabs: () => null,
}));

// Shell-owned query. Pending on the server; resolved once `shellWarm`.
vi.mock("@/hooks/useSubscription", () => ({
  useCurrentSubscription: () =>
    h.shellWarm
      ? {
          isLoading: false,
          isError: false,
          refetch: () => undefined,
          data: {
            id: "s1",
            userId: "u-1",
            planId: "p-gold",
            planCode: "gold",
            planNameFa: "طلایی",
            startAt: "2026-09-01T00:00:00Z",
            endAt: "2026-12-01T00:00:00Z",
            status: "active",
            autoRenew: false,
            cancelledAt: null,
          },
        }
      : { isLoading: true, isError: false, data: undefined, refetch: () => undefined },
  // Page-owned — stays pending on both server and client, so the status tab
  // renders the same skeleton either way and `hasActiveSubscription` is the
  // only value that changes across the hydration boundary.
  useSubscriptionUsage: () => ({ isLoading: true, isError: false, data: undefined, refetch: () => undefined }),
  useEntitlements: () => ({ isLoading: true, isError: false, data: undefined, refetch: () => undefined }),
  usePlansV1: () => ({ isLoading: true, isError: false, data: undefined, refetch: () => undefined }),
}));

vi.mock("@/hooks/usePhase11", () => ({
  useSubscriptionHistory: () => ({ isLoading: true, isError: false, data: undefined, refetch: () => undefined }),
}));

import SubscriptionPage from "@/app/(app)/subscription/page";

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const HYDRATION_WARNING = /hydrat|did ?not match|didn'?t match/i;

const mounted: Root[] = [];

async function ssrThenHydrate(): Promise<string[]> {
  const warnings: string[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const text = args.map((a) => String(a)).join(" ");
    if (HYDRATION_WARNING.test(text)) warnings.push(text);
  });

  try {
    const serverHtml = renderToString(<SubscriptionPage />);
    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    h.shellWarm = true;

    await act(async () => {
      const root = hydrateRoot(container, <SubscriptionPage />, {
        onRecoverableError: (err) => {
          const text = String(err);
          if (HYDRATION_WARNING.test(text)) warnings.push(text);
        },
      });
      mounted.push(root);
    });

    return warnings;
  } finally {
    spy.mockRestore();
  }
}

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((root) => root.unmount());
  });
  h.shellWarm = false;
  h.forceUnguarded = false;
});

describe("/subscription — shell-warm hydration", () => {
  it("negative control: bypassing the gate DOES warn", async () => {
    h.forceUnguarded = true;
    const warnings = await ssrThenHydrate();
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("does not warn when the shell query resolves before hydration", async () => {
    const warnings = await ssrThenHydrate();
    expect(warnings).toEqual([]);
  });
});
