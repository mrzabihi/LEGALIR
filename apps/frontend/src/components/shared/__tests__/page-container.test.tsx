// ============================================================
// LEGALIR — PageContainer tests
// The shared page column must be identical on every surface, so this
// locks the three things that can drift: width, gutter, and the fact
// that caller-supplied classes/attributes survive.
// ============================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageContainer } from "@/components/shared/page-container";

describe("PageContainer", () => {
  it("applies the one shared width and gutter", () => {
    render(<PageContainer data-testid="col">x</PageContainer>);
    const el = screen.getByTestId("col");
    expect(el.className).toContain("max-w-[1120px]");
    expect(el.className).toContain("mx-auto");
    expect(el.className).toContain("w-full");
    expect(el.className).toContain("p-4");
    expect(el.className).toContain("tablet:p-6");
  });

  it("keeps caller classes and div attributes", () => {
    render(
      <PageContainer data-testid="col" className="space-y-6" dir="rtl" aria-label="بارگذاری">
        x
      </PageContainer>
    );
    const el = screen.getByTestId("col");
    expect(el.className).toContain("space-y-6");
    // The shared column is still applied alongside the caller's class.
    expect(el.className).toContain("max-w-[1120px]");
    expect(el.getAttribute("dir")).toBe("rtl");
    expect(el.getAttribute("aria-label")).toBe("بارگذاری");
  });

  it("renders its children", () => {
    render(<PageContainer>محتوای صفحه</PageContainer>);
    expect(screen.getByText("محتوای صفحه")).toBeInTheDocument();
  });
});
