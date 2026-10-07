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
import { LineChart, type ChartPoint } from "@/components/admin/charts";

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
