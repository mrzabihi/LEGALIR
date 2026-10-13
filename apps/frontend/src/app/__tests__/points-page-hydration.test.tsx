// ============================================================
// LEGALIR — /points hydration regression
// ============================================================
// Same bug class as the /dashboard fix (2026-10-12):
//
//   "Hydration failed because the server rendered HTML didn't match the
//    client" — the server rendered the loading branch while the client
//    rendered real content.
//
// Cause: `["me"]` and `["rewards","summary"]` are fetched by the app shell
// (AppLayout/TopBar/Sidebar). Because `(app)/loading.tsx` nests each page in
// its own Suspense boundary, the shell hydrates first and can resolve those
// shared queries *before* the page hydrates. React Query v5 feeds the same
// live `observer.getCurrentResult()` to both `getSnapshot` and
// `getServerSnapshot`, so the page's hydration render would read *resolved*
// data while the server HTML was the loading branch.
//
// The page now gates those reads on `useIsHydrated()`. This test renders the
// REAL page on the server with the shell queries pending, flips them to
// "resolved" (the production race), then hydrates and asserts silence.
//
//   • the negative control proves the warm-shell scenario DOES reproduce the
//     mismatch when the gate is bypassed, and
//   • the guarded page stays silent and shows its data post-hydration.
// ============================================================

import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { act } from "react";

// Hoisted mutable state shared with the mock factories below. `shellWarm`
// models the shell resolving its queries before the page hydrates;
// `forceUnguarded` simulates the pre-fix page (gate bypassed) for the control.
const h = vi.hoisted(() => ({ shellWarm: false, forceUnguarded: false }));

// The real hook distinguishes SSR from the hydration render via
// `getServerSnapshot`; the mock keeps that behavior — except in control mode,
// where it always reports `true` (the pre-fix read of a warm query).
vi.mock("@/hooks/useIsHydrated", async () => {
  const ReactRuntime = await import("react");
  const noop = () => () => {};
  return {
    useIsHydrated: () =>
      h.forceUnguarded
        ? true
        : ReactRuntime.useSyncExternalStore(noop, () => true, () => false),
  };
});

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

// Shell-owned query #1 — `["me"]` (AppLayout/TopBar). Pending on the server,
// warm at hydration once `shellWarm` flips.
vi.mock("@/hooks/useDashboard", () => ({
  useMe: () =>
    h.shellWarm
      ? { data: { profile: { completionPercent: 100 } }, isPending: false }
      : { data: undefined, isPending: true },
}));

// Shell-owned query #2 — `["rewards","summary"]`. Same warm-on-hydrate shape.
vi.mock("@/hooks/useRewards", () => ({
  useRewardsSummary: () =>
    h.shellWarm
      ? {
          isPending: false,
          data: {
            balance: 1234,
            today: { visitRewardClaimed: true, pointsAwarded: 100 },
            rules: [
              {
                eventType: "DAILY_VISIT",
                points: 100,
                frequency: "once_per_day",
                enabled: true,
                labelFa: "سر زدن روزانه",
                descriptionFa: "هر روز با ورود به محیط کار ثبت می‌شود",
              },
            ],
          },
        }
      : { data: undefined, isPending: true },
  useClaimDailyVisit: () => ({
    mutateAsync: async () => ({ awarded: true, points: 100, balance: 1334 }),
    isPending: false,
  }),
}));

// Page-owned queries — stable across server and client (they resolve *after*
// hydration, so their render is identical on both sides). They contribute no
// divergence, which isolates the shell-warm queries as the sole variable.
vi.mock("@/hooks/useAccount", () => ({
  usePointsAccount: () => ({
    data: { balance: 1234, lifetimeEarned: 1500, lifetimeSpent: 266, transactionCount: 5 },
  }),
  usePointsTransactions: () => ({
    isLoading: false,
    data: {
      items: [
        {
          id: "t1",
          eventType: "DAILY_VISIT",
          pointsDelta: 100,
          sourceType: "system",
          sourceId: "s1",
          description: "امتیاز حضور روزانه",
          createdAt: "2026-10-01T00:00:00Z",
        },
      ],
    },
  }),
}));

import MyPointsPage from "@/app/(app)/points/page";

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const HYDRATION_WARNING = /hydrat|did ?not match|didn'?t match/i;

const mounted: Root[] = [];

interface HydrateResult {
  warnings: string[];
  html: string;
}

/** SSR the page with shell queries pending, warm them, then hydrate. */
async function ssrThenHydrate(): Promise<HydrateResult> {
  const warnings: string[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const text = args.map((a) => String(a)).join(" ");
    if (HYDRATION_WARNING.test(text)) warnings.push(text);
  });

  try {
    const serverHtml = renderToString(<MyPointsPage />);
    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    h.shellWarm = true; // the shell resolved its queries before hydration

    await act(async () => {
      const root = hydrateRoot(container, <MyPointsPage />, {
        onRecoverableError: (err) => {
          const text = String(err);
          if (HYDRATION_WARNING.test(text)) warnings.push(text);
        },
      });
      mounted.push(root);
    });

    return { warnings, html: container.innerHTML };
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

describe("/points — shell-warm hydration", () => {
  it("negative control: bypassing the gate DOES warn", async () => {
    // Pre-fix behavior: the page reads the warm shell queries at hydration.
    h.forceUnguarded = true;
    const { warnings } = await ssrThenHydrate();
    // Guards the test itself — if this stops firing, the reproduction is stale
    // and the positive assertion below would pass vacuously.
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("guarded page does not warn when the shell queries resolve before hydration", async () => {
    const { warnings } = await ssrThenHydrate();
    expect(warnings).toEqual([]);
  });

  it("guarded page swaps the loading branch for real data once hydration completes", async () => {
    const { html } = await ssrThenHydrate();
    // The «امروز دریافت شده» badge renders only when `summaryReady` is true
    // (i.e. post-hydration with the warm summary) — during the loading branch
    // the server rendered the «دریافت امتیاز» button instead. Its presence
    // proves the data branch took over rather than sticking on loading.
    expect(html).toContain("امروز دریافت شده");
  });
});
