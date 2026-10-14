// ============================================================
// LEGALIR — Admin chart primitives
// ============================================================
// Pins the behaviours that make the trend line readable and honest:
//   • the value axis uses COMPACT labels (۱۵م), never raw grouped numbers;
//   • a flat run draws NO dot per day — just one end-of-series mark;
//   • the line is smoothed with cubic segments that never overshoot the real
//     data envelope (the monotone-cubic guarantee), so a smoothed point can
//     never imply a value that was not recorded.
// Pure, presentational component — no providers required.
// ============================================================

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  LineChart,
  StackedBarChart,
  ProgressRing,
  type ChartPoint,
  type StackRow,
  type StackSegment,
} from "@/components/admin/charts";

function series(values: number[]): ChartPoint[] {
  return values.map((value, i) => ({
    label: `۰${i}`,
    tooltipLabel: `روز ${i}`,
    value,
  }));
}

/** All y coordinates from an SVG path `d` (every 2nd number is a y). */
function pathYs(d: string): number[] {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  return nums.filter((_, i) => i % 2 === 1);
}

describe("LineChart", () => {
  const revenue = series([
    0, 0, 7_360_000, 4_860_000, 0, 14_580_000, 0, 12_000_000, 4_860_000, 4_860_000,
  ]);

  it("labels the value axis with compact Persian numbers, not raw amounts", () => {
    const { container } = render(<LineChart points={revenue} ariaLabel="روند درآمد" />);
    const texts = [...container.querySelectorAll("svg text")].map((t) => t.textContent ?? "");
    // No label carries a thousands separator — that is the "ugly axis" defect.
    expect(texts.some((t) => t.includes("٬"))).toBe(false);
    // The axis is expressed in millions (م) for a million-scale series.
    expect(texts.some((t) => t.endsWith("م"))).toBe(true);
    // A rounded top gridline sits above the peak (۲۰م ≥ ۱۴٫۵۸م).
    expect(texts).toContain("۲۰م");
  });

  it("draws a single end-of-series dot — not one mark per day", () => {
    const { container } = render(<LineChart points={revenue} ariaLabel="روند درآمد" />);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
  });

  it("smooths the series with cubic segments", () => {
    const { container } = render(<LineChart points={revenue} ariaLabel="روند درآمد" />);
    const path = container.querySelector("path[stroke]");
    expect(path?.getAttribute("d")).toContain(" C ");
  });

  it("never overshoots the data envelope (monotone-cubic, no dips below zero)", () => {
    // A spike between flat zeros: y must stay within [top, baseline].
    const spikes = series([0, 0, 0, 0, 10, 0, 0, 0, 0]);
    const { container } = render(<LineChart points={spikes} ariaLabel="روند" />);
    const ys = pathYs(container.querySelector("path[stroke]")?.getAttribute("d") ?? "");
    expect(ys.length).toBeGreaterThan(0);
    // PAD_TOP = 16, baseline = 16 + (280 - 16 - 30) = 250.
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(16 - 0.01);
      expect(y).toBeLessThanOrEqual(250 + 0.01);
    }
  });

  it("keeps a flat run perfectly flat — no phantom bumps", () => {
    const flat = series([0, 0, 0, 0, 0, 0]);
    const { container } = render(<LineChart points={flat} ariaLabel="روند" />);
    const ys = pathYs(container.querySelector("path[stroke]")?.getAttribute("d") ?? "");
    // Every point sits on the baseline; the curve must not rise above it.
    expect(new Set(ys.map((y) => y.toFixed(1)))).toEqual(new Set(["250.0"]));
  });

  it("still exposes a screen-reader list of the real values", () => {
    const { container } = render(<LineChart points={revenue} ariaLabel="روند درآمد" unit="تومان" />);
    const items = container.querySelectorAll("ul.sr-only li");
    expect(items).toHaveLength(revenue.length);
    expect(items[5]!.textContent).toContain("۱۴٬۵۸۰٬۰۰۰");
  });
});

describe("StackedBarChart", () => {
  const segments: StackSegment[] = [
    { key: "paid", label: "پرداخت‌شده" },
    { key: "free", label: "رایگان" },
    { key: "unpaid", label: "بی‌پرداخت" },
  ];

  it("splits each bar into parts proportional to the real values", () => {
    const rows: StackRow[] = [{ label: "سفارش‌ها", values: [4, 1, 1] }];
    const { container } = render(
      <StackedBarChart rows={rows} segments={segments} ariaLabel="ترکیب سفارش‌ها" />
    );
    const parts = [...container.querySelectorAll("li[class*='grid'] div[role='img'] span")];
    const widths = parts.map((p) => (p as HTMLElement).style.width);
    expect(widths).toEqual(["66.66666666666666%", "16.666666666666664%", "16.666666666666664%"]);
  });

  it("skips a zero part rather than drawing a sliver", () => {
    const rows: StackRow[] = [{ label: "سفارش‌ها", values: [3, 0, 1] }];
    const { container } = render(
      <StackedBarChart rows={rows} segments={segments} ariaLabel="ترکیب سفارش‌ها" />
    );
    const parts = [...container.querySelectorAll("li[class*='grid'] div[role='img'] span")];
    expect(parts).toHaveLength(2); // the zero segment is omitted
  });

  it("mirrors the split into a screen-reader list with the real values", () => {
    const rows: StackRow[] = [{ label: "سفارش‌ها", values: [4, 1, 1] }];
    const { container } = render(
      <StackedBarChart rows={rows} segments={segments} ariaLabel="ترکیب سفارش‌ها" />
    );
    const item = container.querySelector("ul.sr-only li");
    expect(item?.textContent).toContain("پرداخت‌شده ۴");
    expect(item?.textContent).toContain("بی‌پرداخت ۱");
  });
});

describe("ProgressRing", () => {
  it("draws a share against the tracked whole (not a full ring)", () => {
    const { container } = render(
      <ProgressRing value={1} total={4} centerLabel="پرداخت‌شده" ariaLabel="سهم" />
    );
    const ring = container.querySelectorAll("circle")[1]!;
    const nums = (ring.getAttribute("stroke-dasharray") ?? "").split(" ").map(Number);
    const shown = nums[0]!;
    const rest = nums[1]!;
    // The arc is a quarter of the circumference — 1 of 4 reads as 1 of 4.
    expect(shown).toBeCloseTo(rest / 3, 3);
  });

  it("shows the share as a Persian percentage with the real counts", () => {
    const { container } = render(
      <ProgressRing value={1} total={4} centerLabel="پرداخت‌شده" ariaLabel="سهم" />
    );
    expect(container.textContent).toContain("۲۵٪");
    expect(container.textContent).toContain("۱ از ۴");
  });

  it("renders nothing when the whole is zero (no meaningless ring)", () => {
    const { container } = render(
      <ProgressRing value={0} total={0} centerLabel="پرداخت‌شده" ariaLabel="سهم" />
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  it("clamps a value that exceeds the whole to a full ring", () => {
    const { container } = render(
      <ProgressRing value={9} total={4} centerLabel="پرداخت‌شده" ariaLabel="سهم" />
    );
    expect(container.textContent).toContain("۱۰۰٪");
  });
});
