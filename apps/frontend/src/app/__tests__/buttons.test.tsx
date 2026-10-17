// ============================================================
// LEGALIR — Button interaction-state regression suite
// ============================================================
// Locks in the promise of the button redesign:
//   · the shared primitive owns every variant, including the aliases the
//     admin panel and the app already pass (`primary`, `sm`, …)
//   · primary / secondary / danger stay visually distinct
//   · loading announces busy and never fires the action twice
//   · disabled is honest (disabled, no pointer affordance)
//   · icon slots sit on the correct logical side for RTL text flow
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button, IconButton } from "@legalir/ui";

describe("Button", () => {
  it("defaults to type=button so it never submits a parent form by accident", () => {
    render(<Button>ذخیره</Button>);
    expect(screen.getByRole("button", { name: "ذخیره" })).toHaveAttribute("type", "button");
  });

  it("maps the legacy variant aliases onto the canonical set", () => {
    const { rerender } = render(<Button variant="primary">اقدام</Button>);
    expect(screen.getByRole("button").className).toContain("bg-primary ");
    expect(screen.getByRole("button").className).toContain("shadow-elevation-1");

    rerender(<Button variant="secondary">اقدام</Button>);
    expect(screen.getByRole("button").className).toContain("border-divider");

    rerender(<Button variant="ghost">اقدام</Button>);
    expect(screen.getByRole("button").className).not.toContain("bg-primary");
  });

  it("keeps destructive actions visually distinct", () => {
    render(<Button variant="danger">حذف</Button>);
    expect(screen.getByRole("button", { name: "حذف" }).className).toContain("bg-error");
  });

  it("maps the short size aliases onto real heights", () => {
    const { rerender } = render(<Button size="sm">کوتاه</Button>);
    expect(screen.getByRole("button").className).toContain("h-9");

    rerender(<Button size="lg">بلند</Button>);
    expect(screen.getByRole("button").className).toContain("h-12");
  });

  it("blocks the action and announces progress while loading", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        ذخیره
      </Button>
    );
    const btn = screen.getByRole("button", { name: "ذخیره" });
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("stays focusable while loading so keyboard users don't lose their place", () => {
    render(<Button loading>ذخیره</Button>);
    // Native disabled would eject focus; aria-disabled keeps it reachable.
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("is honestly disabled when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        ذخیره
      </Button>
    );
    const btn = screen.getByRole("button", { name: "ذخیره" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("fires once per click", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>تأیید</Button>);
    fireEvent.click(screen.getByRole("button", { name: "تأیید" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps the label in place while loading (no layout jump)", () => {
    render(<Button loading>ثبت درخواست</Button>);
    expect(screen.getByText("ثبت درخواست")).toBeInTheDocument();
  });

  it("renders leading and trailing icons in logical order around the label", () => {
    const { container } = render(
      <Button startIcon={<svg data-icon="start" />} endIcon={<svg data-icon="end" />}>
        مرحله بعد
      </Button>
    );
    const btn = screen.getByRole("button");
    const icons = Array.from(btn.querySelectorAll("svg")).map((n) =>
      n.getAttribute("data-icon")
    );
    expect(icons).toEqual(["start", "end"]);
    // Each slot is tagged with its logical side; the CSS variable those
    // tags resolve to flips under [dir="rtl"], so the lean follows the
    // reading direction without competing translate utilities.
    const startSlot = container.querySelector('[data-icon="start"]')!.parentElement!;
    const endSlot = container.querySelector('[data-icon="end"]')!.parentElement!;
    expect(startSlot.className).toContain("btn-icon-start");
    expect(endSlot.className).toContain("btn-icon-end");
    expect(endSlot.className).toContain(
      "group-hover/btn:translate-x-[var(--btn-icon-shift)]"
    );
  });
});

describe("IconButton", () => {
  it("requires and applies an accessible label", () => {
    render(
      <IconButton label="بستن">
        <svg />
      </IconButton>
    );
    expect(screen.getByRole("button", { name: "بستن" })).toBeInTheDocument();
  });

  it("blocks duplicate activation and announces progress while loading", () => {
    const onClick = vi.fn();
    render(
      <IconButton label="حذف" loading onClick={onClick}>
        <svg />
      </IconButton>
    );
    const btn = screen.getByRole("button", { name: "حذف" });
    expect(btn).toHaveAttribute("aria-busy", "true");
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});
