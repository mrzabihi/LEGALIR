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

  it("keeps the label resting when no value is chosen", () => {
    render(
      <Select
        label="استان"
        value=""
        onChange={() => undefined}
        options={[{ value: "tehran", label: "تهران" }]}
      />
    );
    const select = screen.getByLabelText("استان");
    const label = document.querySelector("label[for='" + select.id + "']");
    expect(label?.className).toContain("top-1/2");
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
