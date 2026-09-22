// ============================================================
// LEGALIR — One Standard Form Field System
// ============================================================
// Behavioural contract for the shared MD3 outlined fields:
// floating label, error association, password toggle, RTL/LTR
// value direction and the shell-rendered label (single source of
// truth for every field variant).
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  TextField,
  PasswordField,
  NumberField,
  MoneyField,
  Textarea,
  Select,
  Checkbox,
} from "@legalir/ui";

describe("TextField", () => {
  it("associates the label with the input via htmlFor/id", () => {
    render(<TextField label="نام کامل" />);
    const input = screen.getByLabelText("نام کامل");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("renders exactly one visible label (shell is the single source of truth)", () => {
    const { container } = render(<TextField label="ایمیل" />);
    // The notch legend holds an aria-hidden copy; only one real <label>.
    expect(container.querySelectorAll("label")).toHaveLength(1);
  });

  it("marks the field invalid and links the error message", () => {
    render(<TextField label="ایمیل" errorMessage="ایمیل نامعتبر است" />);
    const input = screen.getByLabelText("ایمیل");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("ایمیل نامعتبر است");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
  });

  it("shows helper text when there is no error", () => {
    render(<TextField label="ایمیل" supportingText="مثال: name@site.com" />);
    expect(screen.getByText("مثال: name@site.com")).toBeInTheDocument();
  });

  it("renders the required star", () => {
    render(<TextField label="موبایل" required />);
    expect(screen.getByLabelText(/موبایل/)).toBeRequired();
  });

  it("forces LTR direction for the value while the label stays RTL", () => {
    render(<TextField label="ایمیل" inputDir="ltr" />);
    expect(screen.getByLabelText("ایمیل")).toHaveAttribute("dir", "ltr");
  });
});

describe("PasswordField", () => {
  it("toggles visibility without submitting the form", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordField label="رمز عبور" />
      </form>
    );

    const input = screen.getByLabelText("رمز عبور");
    expect(input).toHaveAttribute("type", "password");

    const toggle = screen.getByRole("button", { name: "نمایش رمز عبور" });
    expect(toggle).toHaveAttribute("type", "button");
    fireEvent.click(toggle);

    expect(screen.getByLabelText("رمز عبور")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "مخفی کردن رمز عبور" })).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("defaults the value direction to LTR", () => {
    render(<PasswordField label="رمز عبور" />);
    expect(screen.getByLabelText("رمز عبور")).toHaveAttribute("dir", "ltr");
  });
});

describe("NumberField", () => {
  it("normalises Persian digits to ASCII on change", () => {
    const onChange = vi.fn();
    render(<NumberField label="مبلغ" value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("مبلغ"), { target: { value: "۱۲۳" } });
    expect(onChange).toHaveBeenCalledWith(123);
  });

  it("emits null when cleared", () => {
    const onChange = vi.fn();
    render(<NumberField label="مبلغ" value={5} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("مبلغ"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe("MoneyField", () => {
  it("formats the amount with grouping while typing", () => {
    const onChange = vi.fn();
    render(<MoneyField label="ارزش خواسته" value={null} onChange={onChange} />);
    const input = screen.getByLabelText("ارزش خواسته");
    fireEvent.change(input, { target: { value: "3000000" } });
    expect(onChange).toHaveBeenCalledWith(3_000_000);
    expect(input).toHaveValue("۳٬۰۰۰٬۰۰۰");
  });

  it("accepts Persian digits and pasted separators", () => {
    const onChange = vi.fn();
    render(<MoneyField label="ارزش خواسته" value={null} onChange={onChange} />);
    const input = screen.getByLabelText("ارزش خواسته");
    fireEvent.change(input, { target: { value: "۵۰۰.۰۰۰.۰۰۰" } });
    expect(onChange).toHaveBeenCalledWith(500_000_000);
  });

  it("emits null when cleared", () => {
    const onChange = vi.fn();
    render(<MoneyField label="ارزش خواسته" value={3_000_000} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("ارزش خواسته"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows the amount in words, using the field's own unit", () => {
    const { rerender } = render(
      <MoneyField label="ارزش خواسته" unit="IRT" value={3_000_000} onChange={() => undefined} />
    );
    expect(screen.getByText("سه میلیون تومان")).toBeInTheDocument();

    rerender(
      <MoneyField label="ارزش خواسته" unit="IRR" value={3_000_000} onChange={() => undefined} />
    );
    expect(screen.getByText("سه میلیون ریال")).toBeInTheDocument();
  });

  it("does not show a words line for an empty field", () => {
    render(<MoneyField label="ارزش خواسته" value={null} onChange={() => undefined} />);
    // The unit suffix is always present; the words line is not.
    expect(screen.queryByText(/^سه /)).not.toBeInTheDocument();
    expect(screen.queryByText(/^صفر /)).not.toBeInTheDocument();
  });

  it("renders the unit as a suffix", () => {
    render(<MoneyField label="ارزش خواسته" unit="IRT" value={null} onChange={() => undefined} />);
    expect(screen.getByText("تومان")).toBeInTheDocument();
  });
});

describe("Textarea", () => {
  it("renders a single label and links the error", () => {
    const { container } = render(<Textarea label="توضیحات" errorMessage="الزامی است" />);
    expect(container.querySelectorAll("label")).toHaveLength(1);
    const field = screen.getByLabelText("توضیحات");
    expect(field.tagName).toBe("TEXTAREA");
    expect(field).toHaveAttribute("aria-invalid", "true");
  });
});

describe("Select", () => {
  it("floats the label when a real value is selected", () => {
    render(
      <Select
        label="استان"
        value="tehran"
        onChange={() => undefined}
        options={[
          { value: "tehran", label: "تهران" },
          { value: "isfahan", label: "اصفهان" },
        ]}
      />
    );
    const select = screen.getByLabelText("استان");
    expect(select).toHaveValue("tehran");
    // A floated label is lifted off its resting (vertically centred) spot.
    const label = document.querySelector("label[for='" + select.id + "']");
    expect(label?.className).not.toContain("top-1/2");
  });

  it("keeps the label floated when no value is chosen (never overlaps the placeholder)", () => {
    render(
      <Select
        label="استان"
        value=""
        onChange={() => undefined}
        placeholder="انتخاب کنید"
        options={[{ value: "tehran", label: "تهران" }]}
      />
    );
    const select = screen.getByLabelText("استان");
    const label = document.querySelector("label[for='" + select.id + "']");
    // A resting label would sit on top of the placeholder text, so the
    // label must always be lifted onto the notch.
    expect(label?.className).not.toContain("top-1/2");
    expect(label?.className).toContain("top-0");
  });

  it("mutes the placeholder until a real option is chosen", () => {
    const { rerender } = render(
      <Select
        label="استان"
        value=""
        onChange={() => undefined}
        placeholder="انتخاب کنید"
        options={[{ value: "tehran", label: "تهران" }]}
      />
    );
    expect(screen.getByLabelText("استان").className).toContain("text-onSurfaceVariant");

    rerender(
      <Select
        label="استان"
        value="tehran"
        onChange={() => undefined}
        placeholder="انتخاب کنید"
        options={[{ value: "tehran", label: "تهران" }]}
      />
    );
    expect(screen.getByLabelText("استان").className).toContain("text-onSurface");
  });
});

describe("Checkbox", () => {
  it("is reachable by its label and toggles", () => {
    const onChange = vi.fn();
    render(<Checkbox label="فقط مشاوره آنلاین" onChange={onChange} />);
    const box = screen.getByLabelText("فقط مشاوره آنلاین");
    expect(box).toHaveAttribute("type", "checkbox");
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalled();
  });
});
