import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageLoadingSkeleton, LoadingText } from "@/lib/loading";

describe("PageLoadingSkeleton", () => {
  it("renders a busy indicator", () => {
    const { container } = render(<PageLoadingSkeleton />);
    const busyEl = container.querySelector('[aria-busy="true"]');
    expect(busyEl).toBeDefined();
    expect(busyEl).not.toBeNull();
  });

  it("has animate-pulse class", () => {
    const { container } = render(<PageLoadingSkeleton />);
    const busyEl = container.querySelector('[aria-busy="true"]');
    expect(busyEl).not.toBeNull();
    if (busyEl) {
      expect(busyEl.className).toContain("animate-pulse");
    }
  });
});

describe("LoadingText", () => {
  it("renders default text", () => {
    render(<LoadingText />);
    expect(screen.getByRole("status").textContent).toContain("در حال بارگذاری");
  });

  it("renders custom text", () => {
    render(<LoadingText text="Loading..." />);
    expect(screen.getByRole("status").textContent).toContain("Loading...");
  });
});
