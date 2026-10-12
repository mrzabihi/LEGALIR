// ============================================================
// LEGALIR — useIsHydrated regression
// ============================================================
// Reproduces the /dashboard hydration mismatch reported 2026-10-12:
//
//   "Hydration failed because the server rendered HTML didn't match the
//    client" — HeroSection skeleton (server) vs real content (client).
//
// Cause: `["me"]` is fetched by the app shell (AppLayout/TopBar/Sidebar).
// Because `(app)/loading.tsx` nests the page in its own Suspense boundary,
// the shell hydrates first and can resolve that shared query *before* the
// page hydrates. React Query feeds the live `getCurrentResult()` to BOTH the
// client snapshot and the server snapshot, so the page's hydration render saw
// resolved data while the server HTML was the loading branch.
//
// Fix: gate the loading branch on `useIsHydrated()` — the hydration render is
// forced to match the server, the live value is read afterwards.
//
//   • the negative control proves the warm-query scenario DOES reproduce the
//     mismatch on an unguarded element, and
//   • the guarded element stays silent and then shows content post-hydration.
// ============================================================

import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { act } from "react";
import { useIsHydrated } from "@/hooks/useIsHydrated";

beforeAll(() => {
  // React only treats `act()` as the test renderer when this flag is set.
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const HYDRATION_WARNING = /hydrat|did ?not match|didn'?t match/i;

// Stand-in for the shared query result. `false` while the server renders
// (query pending); flipped to `true` before hydration to simulate the shell
// having already resolved it — the exact production condition.
let queryResolved = false;

/** Mirrors HeroSection after the fix: the loading branch is hydration-gated. */
function HeroGuarded() {
  const hydrated = useIsHydrated();
  const isLoading = !queryResolved || !hydrated;
  return isLoading
    ? <div data-hero className="animate-pulse" />
    : <div data-hero><h1>محتوا</h1></div>;
}

/** The pre-fix behavior: branch directly on the (possibly warm) query. */
function HeroUnguarded() {
  return queryResolved
    ? <div data-hero><h1>محتوا</h1></div>
    : <div data-hero className="animate-pulse" />;
}

const mounted: Root[] = [];

interface HydrateResult {
  warnings: string[];
  hasContent: boolean;
}

/** SSR `node` with the query pending, resolve it, then hydrate. */
async function ssrThenHydrate(node: React.ReactElement): Promise<HydrateResult> {
  const warnings: string[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const text = args.map((a) => String(a)).join(" ");
    if (HYDRATION_WARNING.test(text)) warnings.push(text);
  });

  try {
    const serverHtml = renderToString(node);
    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    queryResolved = true; // the shell resolved the shared query before hydration

    await act(async () => {
      const root = hydrateRoot(container, node, {
        onRecoverableError: (err) => {
          const text = String(err);
          if (HYDRATION_WARNING.test(text)) warnings.push(text);
        },
      });
      mounted.push(root);
    });

    return { warnings, hasContent: !!container.querySelector("h1") };
  } finally {
    spy.mockRestore();
  }
}

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((root) => root.unmount());
  });
  queryResolved = false;
});

describe("useIsHydrated — dashboard hero hydration", () => {
  it("negative control: an unguarded warm query DOES warn", async () => {
    const { warnings } = await ssrThenHydrate(<HeroUnguarded />);
    // Guards the test itself — if this stops firing, the reproduction is stale
    // and the positive assertion below would pass vacuously.
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("guarded hero does not warn when the shared query resolves before hydration", async () => {
    const { warnings } = await ssrThenHydrate(<HeroGuarded />);
    expect(warnings).toEqual([]);
  });

  it("guarded hero shows the real content once hydration completes", async () => {
    const { hasContent } = await ssrThenHydrate(<HeroGuarded />);
    expect(hasContent).toBe(true);
  });
});

describe("useIsHydrated — value", () => {
  it("reads false on the server snapshot (SSR / hydration render)", () => {
    expect(renderToString(<HydrationProbe />)).toContain("server:false");
  });
});

function HydrationProbe() {
  const hydrated = useIsHydrated();
  // On the server this must render `false`; a post-hydration render flips it.
  return <span>{`server:${String(hydrated)}`}</span>;
}
