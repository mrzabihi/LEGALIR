// ============================================================
// LEGALIR — SubscriptionStatusDetails hydration regression
// ============================================================
// `SubscriptionStatusDetails` branches on `isLoading` from
// `useSubscriptionStatus` → `useCurrentSubscription` (`["v1","subscriptions",
// "current"]`), the SAME query the header's SubscriptionStatusChip reads. The
// chip lives in the app shell (TopBar), which can resolve — and warm the cache
// — before a page nested in its own Suspense boundary (`(app)/loading.tsx`)
// hydrates. The details variant then renders the real plan while the server
// HTML held the pulse skeleton → hydration mismatch.
//
// This test renders the REAL widget on the server with the query pending,
// flips it to "resolved" (the production race), then hydrates.
// ============================================================

import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { act } from "react";

const h = vi.hoisted(() => ({ shellWarm: false }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

// Shell-owned query `["v1","subscriptions","current"]`. Pending on the server;
// resolved once `shellWarm`.
vi.mock("@/hooks/useSubscription", () => ({
  useCurrentSubscription: () =>
    h.shellWarm
      ? {
          isLoading: false,
          isError: false,
          refetch: () => {},
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
      : { isLoading: true, isError: false, data: undefined, refetch: () => {} },
}));

import { SubscriptionStatusDetails } from "@/components/subscription/subscription-status";

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
    const serverHtml = renderToString(<SubscriptionStatusDetails />);
    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    h.shellWarm = true;

    await act(async () => {
      const root = hydrateRoot(container, <SubscriptionStatusDetails />, {
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
});

describe("SubscriptionStatusDetails — shell-warm hydration", () => {
  it("does not warn when the shell query resolves before hydration", async () => {
    // The widget now gates its skeleton branch on `useIsHydrated()`, so the
    // hydration render matches the server regardless of whether the shell's
    // chip already resolved `["v1","subscriptions","current"]`.
    const warnings = await ssrThenHydrate();
    expect(warnings).toEqual([]);
  });
});
