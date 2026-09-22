import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("header is light-only (no theme toggle)", () => {
    render(wrapInRtl(<Header />));
    // Landing is restricted to Light-only per §3/§40 — no theme switch exists.
    expect(screen.queryByLabelText("حالت تیره")).toBeNull();
    expect(screen.queryByLabelText("حالت روشن")).toBeNull();
  });

  it("header renders without error in light theme", () => {
    render(wrapInRtl(<Header />));
    expect(screen.getByText("صفحه اصلی")).toBeInTheDocument();
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

  it("header exposes an accessible home link", () => {
    render(wrapInRtl(<Header />));
    expect(screen.getByText("صفحه اصلی").closest("a")).toHaveAttribute("href", "/");
  });

  it("disclaimer text is present and does not claim guarantee", () => {
    render(wrapInRtl(<Footer />));
    const footerText = document.body.textContent || "";
    expect(footerText).toContain("خدمات تخصصی حقوقی");
    expect(footerText).not.toContain("تضمین نتیجه");
    expect(footerText).not.toContain("صد در صد");
  });
});
