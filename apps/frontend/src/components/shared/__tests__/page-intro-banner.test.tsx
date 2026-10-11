// ============================================================
// LEGALIR — Page Intro Banner tests
// ============================================================
// The banner is the shared identity block at the top of every page.
// These tests pin the contract the eight wired routes rely on:
// exactly one H1, the description, an optional low-emphasis breadcrumb
// with an overridable accessible name, and an optional actions slot —
// all of which may be absent without breaking the layout.
// ============================================================

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { PageIntroBanner } from "@/components/shared/page-intro-banner";

describe("PageIntroBanner", () => {
  it("renders the title as the page's single H1", () => {
    render(<PageIntroBanner title="خدمات لیگالیر" description="توضیح" />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("خدمات لیگالیر");
    expect(screen.getByText("توضیح")).toBeInTheDocument();
  });

  it("omits the description paragraph when none is given", () => {
    const { container } = render(<PageIntroBanner title="تاریخچه" />);
    expect(container.querySelector("p")).toBeNull();
  });

  it("renders an optional eyebrow above the title", () => {
    render(<PageIntroBanner title="خدمات" eyebrow={<span>۱۲ خدمت حقوقی</span>} />);
    expect(screen.getByText("۱۲ خدمت حقوقی")).toBeInTheDocument();
  });

  it("renders a breadcrumb with its default accessible name", () => {
    render(
      <PageIntroBanner
        title="تحلیل اسناد"
        breadcrumb={[{ label: "داشبورد", href: "/dashboard" }, { label: "تحلیل اسناد" }]}
      />
    );

    const nav = screen.getByRole("navigation", { name: "مسیر صفحه" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "داشبورد" })).toHaveAttribute("href", "/dashboard");
  });

  it("honours an overridden breadcrumb accessible name", () => {
    render(
      <PageIntroBanner
        title="تنظیم قرارداد"
        breadcrumbAriaLabel="breadcrumb"
        breadcrumb={[{ label: "داشبورد", href: "/dashboard" }, { label: "تنظیم قرارداد" }]}
      />
    );
    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toBeInTheDocument();
  });

  it("renders no breadcrumb nav when the trail is empty", () => {
    render(<PageIntroBanner title="بایگانی" breadcrumb={[]} />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("renders the actions slot when provided", () => {
    render(
      <PageIntroBanner
        title="پرونده‌های من"
        actions={<button type="button">پرونده جدید</button>}
      />
    );
    expect(screen.getByRole("button", { name: "پرونده جدید" })).toBeInTheDocument();
  });

  it("still renders correctly with none of the optional slots", () => {
    const { container } = render(<PageIntroBanner title="مشاوره‌های من" />);
    expect(screen.getByRole("heading", { level: 1, name: "مشاوره‌های من" })).toBeInTheDocument();
    // No stray form/button/nav injected when slots are omitted.
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("nav")).toBeNull();
  });
});
