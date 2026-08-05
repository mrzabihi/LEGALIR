import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SplashScreen } from "@/lib/splash";

function mockMatchMedia(matchesReducedMotion = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" ? matchesReducedMotion : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("SplashScreen", () => {
  it("renders the splash screen with progressbar", () => {
    mockMatchMedia(false);
    render(<SplashScreen onFinish={vi.fn()} duration={4000} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders brand text", () => {
    mockMatchMedia(false);
    render(<SplashScreen onFinish={vi.fn()} duration={4000} />);
    expect(screen.getByText("LEGALIR")).toBeInTheDocument();
    expect(screen.getByText(/دستیار هوشمند حقوقی شما/)).toBeInTheDocument();
  });

  it("shows reduced motion message when prefers-reduced-motion is set", () => {
    mockMatchMedia(true);
    render(<SplashScreen onFinish={vi.fn()} duration={4000} />);
    expect(screen.getByText(/در حال بارگذاری/)).toBeInTheDocument();
  });

  it("calls onFinish when duration is 0 (immediate)", async () => {
    mockMatchMedia(false);
    const onFinish = vi.fn();
    render(<SplashScreen onFinish={onFinish} duration={0} />);
    await waitFor(() => {
      expect(onFinish).toHaveBeenCalled();
    });
  });

  it("does not show when phase is done", async () => {
    mockMatchMedia(false);
    const onFinish = vi.fn();
    const { container } = render(<SplashScreen onFinish={onFinish} duration={0} />);
    await waitFor(() => expect(onFinish).toHaveBeenCalled());
    // After finish, nothing renders
    expect(container.innerHTML).toBe("");
  });
});
