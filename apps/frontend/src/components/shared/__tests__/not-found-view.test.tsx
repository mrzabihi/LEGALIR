// ============================================================
// LEGALIR — 404 view tests
// Covers the exact copy, the two buttons, and the back-navigation
// decision (internal history → back, otherwise → home).
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
const back = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back, replace: vi.fn(), prefetch: vi.fn() }),
}));

import { NotFoundView, hasInternalHistory } from "@/components/shared/not-found-view";

beforeEach(() => {
  push.mockClear();
  back.mockClear();
});

describe("hasInternalHistory", () => {
  const origin = "https://legalir.example";

  it("is false with no prior entry", () => {
    expect(
      hasInternalHistory({
        history: { length: 1 },
        location: { origin },
        document: { referrer: "" },
      })
    ).toBe(false);
  });

  it("is true for a client-side navigation (prior entry, no referrer)", () => {
    expect(
      hasInternalHistory({
        history: { length: 3 },
        location: { origin },
        document: { referrer: "" },
      })
    ).toBe(true);
  });

  it("is true when the referrer is same-origin", () => {
    expect(
      hasInternalHistory({
        history: { length: 2 },
        location: { origin },
        document: { referrer: `${origin}/dashboard` },
      })
    ).toBe(true);
  });

  it("is false when the referrer is external", () => {
    expect(
      hasInternalHistory({
        history: { length: 2 },
        location: { origin },
        document: { referrer: "https://external.example/page" },
      })
    ).toBe(false);
  });

  it("is false for a malformed referrer", () => {
    expect(
      hasInternalHistory({
        history: { length: 2 },
        location: { origin },
        document: { referrer: "not a url" },
      })
    ).toBe(false);
  });

  describe("Navigation API branch", () => {
    // `entries()` is indexed by history position, so the entry at
    // `index - 1` is the one the probe inspects.
    const nav = (index: number, prevUrl: string) => ({
      currentEntry: { index },
      entries: () => [{ url: prevUrl }],
    });

    it("is false at the first entry even when history.length > 1", () => {
      // Fresh tab: about:blank sits behind us, so length is 2, but the
      // Navigation API reports index 0 → no in-app page to return to.
      expect(
        hasInternalHistory({
          history: { length: 2 },
          location: { origin },
          document: { referrer: "" },
          navigation: nav(0, "about:blank"),
        })
      ).toBe(false);
    });

    it("is true when the previous entry is same-origin", () => {
      expect(
        hasInternalHistory({
          history: { length: 2 },
          location: { origin },
          document: { referrer: "" },
          navigation: nav(1, `${origin}/dashboard`),
        })
      ).toBe(true);
    });

    it("is false when the previous entry is cross-origin", () => {
      expect(
        hasInternalHistory({
          history: { length: 2 },
          location: { origin },
          document: { referrer: "" },
          navigation: nav(1, "https://external.example/page"),
        })
      ).toBe(false);
    });
  });
});

describe("NotFoundView", () => {
  it("renders the exact Persian copy and the illustration", () => {
    render(<NotFoundView />);

    expect(
      screen.getByRole("heading", { level: 1, name: "این صفحه یافت نشد" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("تیم حقوقی لیگالیر هم هنوز پیداش نکرده!")
    ).toBeInTheDocument();
    expect(
      screen.getByText("گزینه‌های زیر رو فعلاً باید انتخاب کنی:")
    ).toBeInTheDocument();

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/legalir-404.png");
  });

  it("links «صفحه خانه» to the site home", () => {
    render(<NotFoundView />);
    expect(screen.getByRole("link", { name: "صفحه خانه" })).toHaveAttribute(
      "href",
      "/"
    );
  });

  it("«برگشت» goes back when there is internal history", () => {
    // jsdom: history.length is 1 by default, so stub a prior entry.
    const spy = vi
      .spyOn(window.history, "length", "get")
      .mockReturnValue(2);
    render(<NotFoundView />);

    fireEvent.click(screen.getByRole("button", { name: "برگشت" }));

    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("«برگشت» falls back to home with no internal history", () => {
    const spy = vi
      .spyOn(window.history, "length", "get")
      .mockReturnValue(1);
    render(<NotFoundView />);

    fireEvent.click(screen.getByRole("button", { name: "برگشت" }));

    expect(push).toHaveBeenCalledWith("/");
    expect(back).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
