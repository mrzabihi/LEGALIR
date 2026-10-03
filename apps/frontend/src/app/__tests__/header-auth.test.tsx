// ============================================================
// LEGALIR — Landing header auth behaviour + post-login destination
// ============================================================
// Covers the two things the header must get right:
//   1. The "شروع کنید" services land on the right route — directly when
//      signed in, via /auth/mobile?intent=… when a guest.
//   2. The auth control reflects the *server-confirmed* session, not a
//      stale localStorage entry.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Header } from "@/components/public/Header";
import { useAuthStore } from "@/stores/auth-store";
import { resolveIntendedRoute, isSafeReturnPath } from "@/lib/auth/use-auth";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
}));

// Drive the authoritative session source (`useMe`) deterministically instead
// of racing MSW's delay + the hook's built-in retry.
const meState = vi.hoisted(() => ({
  value: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    error: null as unknown,
  },
}));

vi.mock("@/hooks/useDashboard", () => ({
  useMe: () => meState.value,
}));

function renderHeader() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <div dir="rtl">
        <Header />
      </div>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  push.mockClear();
  localStorage.clear();
  useAuthStore.setState({ session: null, isLoading: false, intendedRoute: null });
  meState.value = { data: undefined, isLoading: false, isError: false, error: null };
});

// ============================================================
// Intent → route resolution
// ============================================================

describe("resolveIntendedRoute", () => {
  it("maps each landing service intent to its real route", () => {
    expect(resolveIntendedRoute("chat")).toBe("/new");
    expect(resolveIntendedRoute("document")).toBe("/documents");
    expect(resolveIntendedRoute("contract")).toBe("/contracts");
    expect(resolveIntendedRoute("subscribe")).toBe("/pricing");
  });

  it("passes through internal paths and falls back to the dashboard", () => {
    expect(resolveIntendedRoute("/consultations/new?lawyerId=x")).toBe(
      "/consultations/new?lawyerId=x"
    );
    expect(resolveIntendedRoute(null)).toBe("/dashboard");
    expect(resolveIntendedRoute("unknown-token")).toBe("/dashboard");
  });

  it("rejects non-internal return paths (open-redirect guard)", () => {
    expect(isSafeReturnPath("/documents")).toBe(true);
    expect(isSafeReturnPath("//evil.com")).toBe(false);
    expect(isSafeReturnPath("https://evil.com")).toBe(false);
    expect(resolveIntendedRoute("//evil.com")).toBe("/dashboard");
    expect(resolveIntendedRoute("https://evil.com")).toBe("/dashboard");
  });
});

// ============================================================
// Header — guest
// ============================================================

describe("Header (guest)", () => {
  it("shows ورود / ثبت‌نام and no dashboard link", () => {
    renderHeader();
    expect(screen.getByText("ورود")).toBeInTheDocument();
    expect(screen.getByText("ثبت‌نام")).toBeInTheDocument();
    expect(screen.queryByText("داشبورد")).toBeNull();
  });

  it("routes a service click through login with the intent preserved", () => {
    renderHeader();

    fireEvent.click(screen.getByText("شروع کنید"));
    fireEvent.click(screen.getByText("تحلیل سند"));

    expect(push).toHaveBeenCalledWith("/auth/mobile?intent=document");
  });
});

// ============================================================
// Header — authenticated
// ============================================================

describe("Header (authenticated)", () => {
  it("shows داشبورد instead of the login control", () => {
    meState.value = {
      data: { user: { id: "u-1" }, profile: { displayName: "کاربر تست" } },
      isLoading: false,
      isError: false,
      error: null,
    };
    renderHeader();

    expect(screen.getByText("داشبورد")).toBeInTheDocument();
    expect(screen.queryByText("ورود")).toBeNull();
  });

  it("routes a service click straight to the destination", () => {
    meState.value = {
      data: { user: { id: "u-1" }, profile: { displayName: "کاربر تست" } },
      isLoading: false,
      isError: false,
      error: null,
    };
    renderHeader();

    fireEvent.click(screen.getByText("شروع کنید"));
    fireEvent.click(screen.getByText("تولید قرارداد"));

    expect(push).toHaveBeenCalledWith("/contracts");
  });
});

// ============================================================
// Stale session
// ============================================================

describe("Header (stale localStorage session)", () => {
  it("does not treat a persisted session as authenticated when the server says 401", async () => {
    // A leftover session in the store, but the server rejects it.
    useAuthStore.setState({
      session: {
        sessionId: "stale",
        userId: "u-1",
        mobileE164: "+989120000003",
        mobileDisplay: "09120000003",
        isNewUser: false,
        createdAt: Date.now(),
      },
    });
    meState.value = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: { status: 401 },
    };

    renderHeader();

    // The header must fall back to the guest control, not show داشبورد.
    expect(screen.getByText("ورود")).toBeInTheDocument();
    expect(screen.queryByText("داشبورد")).toBeNull();
    // And the stale store entry is cleared.
    await waitFor(() => expect(useAuthStore.getState().session).toBeNull());
  });

  it("holds the auth control back while the session is still resolving", () => {
    meState.value = { data: undefined, isLoading: true, isError: false, error: null };
    renderHeader();

    // Neither control is shown during the initial load — no wrong-button flash.
    expect(screen.queryByText("ورود")).toBeNull();
    expect(screen.queryByText("داشبورد")).toBeNull();
  });
});
