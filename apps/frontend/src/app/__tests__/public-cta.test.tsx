import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CTASection } from "@/components/public/CTASection";
import { AIDisclaimer } from "@/components/public/AIDisclaimer";

function wrapInRtl(children: React.ReactNode) {
  return <div dir="rtl">{children}</div>;
}

describe("CTA Section", () => {
  it("renders all four CTA cards", () => {
    render(wrapInRtl(<CTASection />));

    expect(screen.getByText("مشاوره حقوقی با هوش مصنوعی")).toBeInTheDocument();
    expect(screen.getByText("تحلیل و بررسی اسناد")).toBeInTheDocument();
    expect(screen.getByText("تولید پیش‌نویس قرارداد")).toBeInTheDocument();
    expect(screen.getByText("مشاهده تعرفه‌ها")).toBeInTheDocument();
  });

  it("has a CTA card for each required path", () => {
    render(wrapInRtl(<CTASection />));

    // Check each CTA points to the expected URL with intent parameter
    const consultLink = screen.getByText("شروع مشاوره").closest("a");
    expect(consultLink).toHaveAttribute("href", "/auth/mobile?intent=chat");

    const docLink = screen.getByText("تحلیل سند").closest("a");
    expect(docLink).toHaveAttribute("href", "/auth/mobile?intent=document");

    const contractLink = screen.getByText("ایجاد قرارداد").closest("a");
    expect(contractLink).toHaveAttribute("href", "/auth/mobile?intent=contract");

    const pricingLink = screen.getByText("مشاهده اشتراک‌ها").closest("a");
    expect(pricingLink).toHaveAttribute("href", "/pricing");
  });

  it("has section heading", () => {
    render(wrapInRtl(<CTASection />));
    expect(screen.getByText("از کجا شروع کنیم؟")).toBeInTheDocument();
  });
});

describe("AI Disclaimer", () => {
  it("renders full disclaimer with key points", () => {
    render(wrapInRtl(<AIDisclaimer />));

    expect(screen.getByText("نکته مهم درباره هوش مصنوعی")).toBeInTheDocument();
    expect(screen.getByText(/اطلاعات AI/)).toBeInTheDocument();
    expect(screen.getByText(/کمک حقوقی/)).toBeInTheDocument();
    expect(screen.getByText(/منابع معتبر/)).toBeInTheDocument();
    expect(screen.getByText(/اتصال به وکیل/)).toBeInTheDocument();
  });

  it("disclaimer clearly states AI does not replace lawyer", () => {
    render(wrapInRtl(<AIDisclaimer />));
    expect(
      screen.getByText(/جایگزین وکیل، مشاور حقوقی یا مراجع رسمی قضایی نیست/)
    ).toBeInTheDocument();
  });

  it("compact disclaimer renders a compact badge", () => {
    render(wrapInRtl(<AIDisclaimer compact />));
    expect(
      screen.getByText(/مشاوره حقوقی رسمی نیست/)
    ).toBeInTheDocument();
  });

  it("does NOT claim guaranteed legal outcomes", () => {
    render(wrapInRtl(<AIDisclaimer />));
    const text = document.body.textContent || "";
    // "تضمین" (guarantee) must not appear
    expect(text).not.toContain("تضمین نتیجه");
    // The phrase "نظر حقوقی قطعی" is used in a negation context, OK
    // Ensure we don't say AI replaces lawyer
    expect(text).not.toMatch(/جایگزین.*قطعی/);
  });
});
