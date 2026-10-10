import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Header } from "@/components/public/Header";
import { Footer } from "@/components/public/Footer";

// The Header uses the App Router hooks; jsdom has no router mounted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
}));

// The Header reads session state through React Query (`useMe`), so every
// render needs a provider. `retry: false` keeps the guest case deterministic.
function wrapInRtl(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });
  return (
    <QueryClientProvider client={client}>
      <div dir="rtl">{children}</div>
    </QueryClientProvider>
  );
}

describe("Public Header Navigation", () => {
  it("renders all navigation links", () => {
    render(wrapInRtl(<Header />));
    expect(screen.getByText("صفحه اصلی")).toBeInTheDocument();
    expect(screen.getByText("قابلیت‌ها")).toBeInTheDocument();
    expect(screen.getByText("تعرفه‌ها")).toBeInTheDocument();
    expect(screen.getByText("درباره ما")).toBeInTheDocument();
    expect(screen.getByText("تماس با ما")).toBeInTheDocument();
  });

  it("nav links point to correct hrefs", () => {
    render(wrapInRtl(<Header />));
    expect(screen.getByText("صفحه اصلی").closest("a")).toHaveAttribute("href", "/");
    expect(screen.getByText("قابلیت‌ها").closest("a")).toHaveAttribute("href", "/features");
    expect(screen.getByText("تعرفه‌ها").closest("a")).toHaveAttribute("href", "/pricing");
    expect(screen.getByText("درباره ما").closest("a")).toHaveAttribute("href", "/about");
    expect(screen.getByText("تماس با ما").closest("a")).toHaveAttribute("href", "/contact");
  });

  it("has login CTA", () => {
    render(wrapInRtl(<Header />));
    // Desktop button says "شروع کنید" (visible), mobile drawer says "ورود / ثبت‌نام"
    expect(screen.getByText("شروع کنید")).toBeInTheDocument();
  });

  it("has quick service links in CTA dropdown", () => {
    render(wrapInRtl(<Header />));
    expect(screen.getByText("مشاوره حقوقی")).toBeInTheDocument();
    expect(screen.getByText("تحلیل سند")).toBeInTheDocument();
    expect(screen.getByText("تولید قرارداد")).toBeInTheDocument();
    expect(screen.getByText("مشاهده اشتراک‌ها")).toBeInTheDocument();
  });

  it("is light-only with no theme toggle (landing restriction)", () => {
    render(wrapInRtl(<Header />));
    const buttons = screen.getAllByRole("button");
    const themeButton = buttons.find(
      (b) =>
        b.getAttribute("aria-label") === "حالت تیره" ||
        b.getAttribute("aria-label") === "حالت روشن"
    );
    expect(themeButton).toBeUndefined();
  });

  it("has mobile menu toggle button", () => {
    render(wrapInRtl(<Header />));
    expect(screen.getByLabelText("باز کردن منو")).toBeInTheDocument();
  });
});

describe("Public Footer", () => {
  it("renders service links", () => {
    render(wrapInRtl(<Footer />));
    expect(screen.getByText("مشاوره حقوقی با هوش مصنوعی")).toBeInTheDocument();
    expect(screen.getByText("تحلیل و بررسی اسناد")).toBeInTheDocument();
    expect(screen.getByText("تولید پیش‌نویس قرارداد")).toBeInTheDocument();
  });

  it("renders platform links", () => {
    render(wrapInRtl(<Footer />));
    expect(screen.getByText("قابلیت‌ها")).toBeInTheDocument();
    expect(screen.getByText("درباره لیگالیر")).toBeInTheDocument();
  });

  it("renders legal links", () => {
    render(wrapInRtl(<Footer />));
    expect(screen.getByText("قوانین استفاده")).toBeInTheDocument();
    expect(screen.getByText("حریم خصوصی")).toBeInTheDocument();
  });

  it("renders tagline", () => {
    render(wrapInRtl(<Footer />));
    expect(screen.getByText(/دسترسی‌پذیر کردن اطلاعات و خدمات حقوقی/)).toBeInTheDocument();
  });

  it("contains disclaimer about AI", () => {
    render(wrapInRtl(<Footer />));
    expect(
      screen.getByText(/خدمات تخصصی حقوقی/)
    ).toBeInTheDocument();
  });
});
