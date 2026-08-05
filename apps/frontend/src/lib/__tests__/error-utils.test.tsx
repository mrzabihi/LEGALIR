import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorDisplay, EmptyState } from "@/lib/error-utils";

describe("ErrorDisplay", () => {
  it("renders error message", () => {
    render(<ErrorDisplay message="Something went wrong" />);
    expect(screen.getByRole("alert").textContent).toContain("Something went wrong");
  });

  it("shows retry button when onRetry provided", () => {
    const onRetry = vi.fn();
    render(<ErrorDisplay message="Error" onRetry={onRetry} />);
    const btn = screen.getByRole("button", { name: /تلاش مجدد/i });
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not show retry button when onRetry not provided", () => {
    render(<ErrorDisplay message="Error" />);
    expect(screen.queryByRole("button", { name: /تلاش مجدد/i })).toBeNull();
  });
});

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="No items" description="Nothing here yet" />);
    expect(screen.getByText("No items")).toBeDefined();
    expect(screen.getByText("Nothing here yet")).toBeDefined();
  });

  it("shows action button when provided", () => {
    const action = { label: "Add item", onClick: vi.fn() };
    render(<EmptyState title="Empty" description="..." action={action} />);
    expect(screen.getByRole("button", { name: "Add item" })).toBeDefined();
  });
});
