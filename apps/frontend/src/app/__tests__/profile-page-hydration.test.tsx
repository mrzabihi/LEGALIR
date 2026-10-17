// ============================================================
// LEGALIR — /profile hydration regression
// ============================================================
// Same bug class as the /dashboard and /points fixes (2026-10-12):
//
//   "Hydration failed because the server rendered HTML didn't match the
//    client" — the server rendered the pending fallback while the client
//    rendered the shell-warmed real values.
//
// The /profile page reads `me.data` (and the subscription status) straight
// into rendered text — `{profile?.displayName ?? "کاربر LEGALIR"}`,
// `تکمیل پروفایل {completionPct}٪`, the account-type chip. Those queries are
// owned by the app shell (AppLayout/TopBar/Sidebar), which can resolve — and
// warm the cache — before this page (nested in its own Suspense boundary via
// `(app)/loading.tsx`) hydrates. React Query feeds the same live
// `getCurrentResult()` to both snapshots, so the hydration render reads the
// resolved user while the server HTML held the fallback.
//
// This test renders the REAL page on the server with the shell query pending,
// flips it to "resolved" (the production race), then hydrates and asserts
// silence — with a negative control proving the reproduction is live.
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

// Shell-owned query `["me"]`. Pending on the server; warm once `shellWarm`.
vi.mock("@/hooks/useDashboard", () => ({
  useMe: () =>
    h.shellWarm
      ? {
          isPending: false,
          isLoading: false,
          data: {
            role: "user",
            user: {
              id: "u-1",
              mobileDisplay: "۰۹۱۲۰۰۰۰۰۱۲",
              accountType: "individual",
              platformAccountType: "PERSONAL",
            },
            profile: {
              userId: "u-1",
              displayName: "امیر رضایی",
              city: "تهران",
              occupation: null,
              email: "a@example.com",
              birthDate: null,
              avatarUrl: null,
              completionPercent: 100,
              userType: null,
              province: null,
              legalInterests: null,
              primaryUseCase: null,
            },
          },
        }
      : { data: undefined, isPending: true, isLoading: true },
  useUpdateProfile: () => ({ mutateAsync: async () => ({}), isPending: false }),
  useDailyQuota: () => ({ data: undefined, isPending: false, isLoading: false }),
  useUploadUserAvatar: () => ({ mutateAsync: async () => ({}), isPending: false }),
  useDeleteUserAvatar: () => ({ mutateAsync: async () => ({}), isPending: false }),
}));

// Page-owned queries — stable across server and client (never warm), so they
// contribute no divergence and isolate the shell-owned query as the variable.
vi.mock("@/hooks/usePhase11", () => ({
  useProfileUsage: () => ({ data: undefined, isPending: false, isLoading: false }),
  useSubscriptionHistory: () => ({ data: { items: [] }, isPending: false, isLoading: false }),
  useMemories: () => ({ data: { items: [] }, isPending: false, isLoading: false }),
}));

vi.mock("@/hooks/useAccount", () => ({
  useUpdateAccountType: () => ({ mutate: () => undefined, isPending: false }),
}));

vi.mock("@/hooks/useOnboarding", () => ({
  useOrganizations: () => ({ data: { items: [] }, isPending: false, isLoading: false }),
}));

vi.mock("@/hooks/useDocuments", () => ({
  useDocuments: () => ({ data: { items: [], pagination: { total: 0 } }, isPending: false, isLoading: false }),
}));

vi.mock("@/hooks/useContracts", () => ({
  useContracts: () => ({ data: { items: [], pagination: { total: 0 } }, isPending: false, isLoading: false }),
}));

vi.mock("@/hooks/useConsultations", () => ({
  useConsultations: () => ({ data: [], isPending: false, isLoading: false }),
}));

// The subscription status widget is also shell-owned; stub it to a stable node
// so the test tracks only the `["me"]` race.
vi.mock("@/components/subscription/subscription-status", () => ({
  SubscriptionStatusDetails: () => <div data-sub-status />,
  SubscriptionStatusChip: () => <div data-sub-chip />,
}));

import AccountHubPage from "@/app/(app)/profile/page";

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const HYDRATION_WARNING = /hydrat|did ?not match|didn'?t match/i;

const mounted: Root[] = [];

interface HydrateResult {
  warnings: string[];
  html: string;
}

async function ssrThenHydrate(): Promise<HydrateResult> {
  const warnings: string[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const text = args.map((a) => String(a)).join(" ");
    if (HYDRATION_WARNING.test(text)) warnings.push(text);
  });

  try {
    const serverHtml = renderToString(<AccountHubPage />);
    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    h.shellWarm = true;

    await act(async () => {
      const root = hydrateRoot(container, <AccountHubPage />, {
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

describe("/profile — shell-warm hydration", () => {
  it("negative control: bypassing the gate DOES warn", async () => {
    h.forceUnguarded = true;
    const { warnings } = await ssrThenHydrate();
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("does not warn when the shell query resolves before hydration", async () => {
    const { warnings } = await ssrThenHydrate();
    expect(warnings).toEqual([]);
  });
});
