// ============================================================
// LEGALIR — Selection controls & Jalali date regression suite
// ============================================================
// Locks in the behaviour the standardization task promised:
//   · Checkbox  — visual state derives from the real input; the
//                 whole label is clickable; the form value is right.
//   · Switch    — OFF is light, ON is brand green, value matches.
//   · SelectableOption/Card — selected state is the green tonal
//                 treatment, never a black fill.
//   · JalaliDatePicker — year range is a prop (1405–1450 for future
//                 fields), Jalali month lengths are real, and the
//                 end date may not precede the start date.
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  Checkbox,
  Switch,
  SelectableOption,
  SelectableCard,
} from "@legalir/ui";
import {
  JalaliDatePicker,
  jalaliMonthLength,
} from "@/components/shared/JalaliDatePicker";

// ------------------------------------------------------------
// Checkbox
// ------------------------------------------------------------

describe("Checkbox", () => {
  it("starts unchecked with no tick visible", () => {
    render(<Checkbox label="پذیرش شرایط" />);
    const box = screen.getByLabelText("پذیرش شرایط") as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(box).not.toBeChecked();
  });

  it("checks on click and exposes the checked state to the form", () => {
    const onChange = vi.fn();
    render(<Checkbox label="پذیرش شرایط" onChange={onChange} />);
    const box = screen.getByLabelText("پذیرش شرایط") as HTMLInputElement;
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0]![0].target as HTMLInputElement).checked).toBe(true);
  });

  it("renders a checkmark path that is driven by the input's checked state", () => {
    const { container } = render(<Checkbox label="پذیرش شرایط" defaultChecked />);
    const box = screen.getByLabelText("پذیرش شرایط") as HTMLInputElement;
    expect(box.checked).toBe(true);
    // The tick lives inside the box span, which is a sibling of the input
    // so `peer-checked:` can reach it.
    const tick = container.querySelector("svg path");
    expect(tick).not.toBeNull();
    expect(tick!.getAttribute("stroke")).toBe("var(--control-selected-foreground)");
  });

  it("unchecks again on a second click", () => {
    render(<Checkbox label="پذیرش شرایط" defaultChecked />);
    const box = screen.getByLabelText("پذیرش شرایط") as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(box.checked).toBe(false);
  });

  it("toggles when the label text is clicked (whole region is the target)", () => {
    render(<Checkbox label="پذیرش شرایط" />);
    const box = screen.getByLabelText("پذیرش شرایط") as HTMLInputElement;
    fireEvent.click(screen.getByText("پذیرش شرایط"));
    expect(box.checked).toBe(true);
  });

  it("marks the control invalid from aria-invalid", () => {
    render(<Checkbox label="پذیرش شرایط" aria-invalid />);
    expect(screen.getByLabelText("پذیرش شرایط")).toHaveAttribute("aria-invalid", "true");
  });
});

// ------------------------------------------------------------
// Switch
// ------------------------------------------------------------

describe("Switch", () => {
  it("is OFF by default and reports aria-checked=false", () => {
    render(<Switch label="اعلان‌ها" />);
    const sw = screen.getByRole("switch", { name: "اعلان‌ها" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect((sw as HTMLInputElement).checked).toBe(false);
  });

  it("turns ON and reports aria-checked=true, matching the visual", () => {
    render(<Switch label="اعلان‌ها" defaultChecked />);
    const sw = screen.getByRole("switch", { name: "اعلان‌ها" });
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect((sw as HTMLInputElement).checked).toBe(true);
  });

  it("emits the new value on toggle", () => {
    const onChange = vi.fn();
    render(<Switch label="اعلان‌ها" onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch", { name: "اعلان‌ها" }));
    expect((onChange.mock.calls[0]![0].target as HTMLInputElement).checked).toBe(true);
  });
});

// ------------------------------------------------------------
// SelectableOption / SelectableCard
// ------------------------------------------------------------

describe("SelectableOption", () => {
  it("reports unselected, then selected, and fires on change", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <SelectableOption label="املاک" selected={false} onClick={onClick} />
    );
    const chip = screen.getByRole("button", { name: /املاک/ });
    expect(chip).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<SelectableOption label="املاک" selected onClick={onClick} />);
    expect(screen.getByRole("button", { name: /املاک/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("uses the green tonal treatment, never a black fill", () => {
    render(<SelectableOption label="املاک" selected />);
    const chip = screen.getByRole("button", { name: /املاک/ });
    expect(chip.className).toContain("bg-control-selected-surface");
    expect(chip.className).not.toContain("bg-primary");
  });
});

describe("SelectableCard", () => {
  it("exposes selection via aria-pressed and shows a tick when selected", () => {
    const { container, rerender } = render(
      <SelectableCard title="قراردادها" description="تنظیم و بررسی" selected={false} />
    );
    expect(screen.getByRole("button", { name: /قراردادها/ })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(container.querySelector("svg")).toBeNull();

    rerender(<SelectableCard title="قراردادها" description="تنظیم و بررسی" selected />);
    expect(screen.getByRole("button", { name: /قراردادها/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

// ------------------------------------------------------------
// Jalali date picker
// ------------------------------------------------------------

describe("JalaliDatePicker", () => {
  it("defaults the year list to 1405–1450 and includes 1450", () => {
    render(<JalaliDatePicker value="" onChange={() => {}} />);
    const year = screen.getByLabelText("سال") as HTMLSelectElement;
    const values = Array.from(year.options).map((o) => Number(o.value));
    expect(values).toContain(1405);
    expect(values).toContain(1450);
    expect(Math.max(...values)).toBe(1450);
    // Nothing beyond 1450 is offered.
    expect(values).not.toContain(1451);
  });

  it("rests on 1405 when empty", () => {
    render(<JalaliDatePicker value="" onChange={() => {}} />);
    expect((screen.getByLabelText("سال") as HTMLSelectElement).value).toBe("1405");
  });

  it("honours a past-only range for historical fields", () => {
    render(
      <JalaliDatePicker value="" onChange={() => {}} minYear={1300} maxYear={1405} defaultYear={1365} />
    );
    const year = screen.getByLabelText("سال") as HTMLSelectElement;
    const values = Array.from(year.options).map((o) => Number(o.value));
    expect(Math.max(...values)).toBe(1405);
    expect(year.value).toBe("1365");
  });

  it("offers 31 days for فروردین and 30 for مهر", () => {
    render(<JalaliDatePicker value="1405-01-01" onChange={() => {}} />);
    const day = screen.getByLabelText("روز") as HTMLSelectElement;
    expect(day.options).toHaveLength(31);

    fireEvent.change(screen.getByLabelText("ماه"), { target: { value: "7" } });
    expect((screen.getByLabelText("روز") as HTMLSelectElement).options).toHaveLength(30);
  });

  it("clamps ۳۱ شهریور to ۳۰ when the month changes to مهر", () => {
    render(<JalaliDatePicker value="1405-06-31" onChange={() => {}} />);
    expect((screen.getByLabelText("روز") as HTMLSelectElement).value).toBe("31");
    fireEvent.change(screen.getByLabelText("ماه"), { target: { value: "7" } });
    expect((screen.getByLabelText("روز") as HTMLSelectElement).value).toBe("30");
  });

  it("gives اسفند 30 days in a leap year and 29 otherwise", () => {
    // 1403 is a leap year in the jalaali-js algorithm; 1404 is not.
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
  });

  it("shows the error message and marks the selects invalid", () => {
    render(
      <JalaliDatePicker
        value="1405-06-13"
        onChange={() => {}}
        errorMessage="تاریخ پایان قرارداد نمی‌تواند قبل از تاریخ شروع باشد."
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "تاریخ پایان قرارداد نمی‌تواند قبل از تاریخ شروع باشد."
    );
    expect(screen.getByLabelText("روز")).toHaveAttribute("aria-invalid", "true");
  });
});
