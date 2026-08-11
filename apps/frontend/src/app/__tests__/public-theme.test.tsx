import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "@/components/public/Header";
import { Footer } from "@/components/public/Footer";

function wrapInRtl(children: React.ReactNode) {
  return <div dir="rtl">{children}</div>;
}

describe("Theme Switching", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.setAttribute("data-theme", "light");
  });

  it("header has theme toggle buttons (desktop + mobile)", () => {
    render(wrapInRtl(<Header />));
    // There are two theme toggle buttons: one for desktop, one for mobile
    const themeButtons = screen.getAllByLabelText("حالت تیره");
    expect(themeButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("theme toggle is clickable", () => {
    render(wrapInRtl(<Header />));
    const themeButtons = screen.getAllByLabelText("حالت تیره");
    expect(themeButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(themeButtons[0]!);
    // After click, at least one button should switch to "حالت روشن"
    expect(screen.getAllByLabelText("حالت روشن").length).toBeGreaterThanOrEqual(1);
  });
});

describe("Responsive Layout Elements", () => {
  it("mobile menu button has correct aria attributes", () => {
    render(wrapInRtl(<Header />));
    const menuButton = screen.getByLabelText("باز کردن منو");
    expect(menuButton).toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("footer has link section lists", () => {
    render(wrapInRtl(<Footer />));
    const lists = screen.getAllByRole("list");
    expect(lists.length).toBeGreaterThanOrEqual(3);
  });

  it("footer has copyright with current year", () => {
    render(wrapInRtl(<Footer />));
    const currentYear = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(currentYear))).toBeInTheDocument();
  });

  it("header has accessible logo link", () => {
    render(wrapInRtl(<Header />));
    expect(screen.getByLabelText("LEGALIR — صفحه اصلی")).toBeInTheDocument();
  });

  it("disclaimer text is present and does not claim guarantee", () => {
    render(wrapInRtl(<Footer />));
    const footerText = document.body.textContent || "";
    expect(footerText).toContain("خدمات تخصصی حقوقی");
    expect(footerText).not.toContain("تضمین نتیجه");
    expect(footerText).not.toContain("صد در صد");
  });
});
