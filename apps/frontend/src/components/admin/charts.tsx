// ============================================================
// LEGALIR — Admin chart primitives (dependency-free SVG / CSS)
// ============================================================
// Small, accessible presentational charts for the admin panel. They render
// the real numbers handed to them by the caller — they never compute,
// simulate or interpolate data, and an empty series shows the empty state
// rather than a fabricated line.
//
// Deliberately no charting library: the two shapes the panel needs (a daily
// trend and a category comparison) are a polyline and a set of bars, so we
// keep the bundle small and match the project's design tokens exactly.
//
// RTL: the SVG geometry runs left→right internally, but the first index is
// drawn on the RIGHT so the series reads right-to-left; the value axis sits
// in a right-hand gutter and the date axis runs along the bottom. Every
// visible label is Persian and numeric labels are isolated with `dir="ltr"`
// so digits and units never re-flow. Each chart also exposes a screen-reader
// list of its points and an `aria-label`, so the data is reachable without
// hover.
// ============================================================

"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { toPersianNumber } from "@/lib/persian-utils";
import { Card } from "./ui";
import { IconDatabase } from "@/lib/icons";

// ---------------------------------------------------------------------------
// Frame — the titled card every chart sits in
// ---------------------------------------------------------------------------

/**
 * The categorical palette. Colours are read from the shared design tokens
 * (`--chart-cat-*`) so light/dark are handled centrally and a series keeps a
 * STABLE colour by index — independent of row order or filtering.
 */
export const CAT = [
  "var(--chart-cat-1)",
  "var(--chart-cat-2)",
  "var(--chart-cat-3)",
  "var(--chart-cat-4)",
  "var(--chart-cat-5)",
  "var(--chart-cat-6)",
] as const;

/** Colour for the i-th category, cycling through the fixed palette. */
export function catColor(i: number): string {
  return CAT[i % CAT.length]!;
}

export function ChartFrame({
  title,
  subtitle,
  legend,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  legend?: { label: string; color: string }[];
  /** A control rendered opposite the title (e.g. a series segmented control). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`flex h-full flex-col p-4 tablet:p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-body-1 font-bold text-onSurface">{title}</h3>
          {subtitle && <p className="mt-0.5 text-caption text-muted">{subtitle}</p>}
        </div>
        {action ? (
          <div className="shrink-0">{action}</div>
        ) : (
          legend &&
          legend.length > 0 && (
            <ul className="flex flex-wrap items-center gap-3" aria-hidden="true">
              {legend.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5 text-caption text-muted">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                  {l.label}
                </li>
              ))}
            </ul>
          )
        )}
      </div>
      <div className="flex-1">{children}</div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading / empty placeholders
// ---------------------------------------------------------------------------

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <Card className="p-4 tablet:p-5">
      <div className="h-4 w-40 rounded-small bg-surface-container-high skeleton-shimmer" />
      <div className="mt-1.5 h-3 w-28 rounded-small bg-surface-container-high skeleton-shimmer" />
      <div
        className="mt-4 rounded-large bg-surface-container-high skeleton-shimmer"
        style={{ height }}
        aria-busy="true"
      />
    </Card>
  );
}

export function ChartEmpty({ message, height = 180 }: { message: string; height?: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-large border border-dashed border-divider px-4 text-center"
      style={{ height }}
    >
      <IconDatabase size={26} className="mb-2 text-muted" />
      <p className="text-body-2 text-muted">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared geometry
// ---------------------------------------------------------------------------

export interface ChartPoint {
  /** Short axis label — already Persian-formatted by the caller. */
  label: string;
  /** Full label shown in the tooltip (e.g. the complete Jalali date). */
  tooltipLabel: string;
  value: number;
}

const VIEW_W = 1000;
const VIEW_H = 280;
const GUTTER_R = 92; // right-hand gutter for the value axis (RTL: values on the right)
const PAD_L = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 30;
const AXIS_FONT = 26; // large in viewBox units so it stays legible when scaled

/** Sanitize a React `useId` value into an id safe for `url(#…)`. */
function useSafeId(prefix: string): string {
  const raw = useId();
  return `${prefix}-${raw.replace(/[:]/g, "")}`;
}

// ---------------------------------------------------------------------------
// Trend-chart helpers (smooth geometry · clean scale · compact axis labels)
// ---------------------------------------------------------------------------

/** A "nice" round step (1 · 2 · 2.5 · 5 · 10 × 10ⁿ) at or above `rough`. */
function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const base = Math.pow(10, Math.floor(Math.log10(rough)));
  const f = rough / base;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * base;
}

/**
 * A value axis whose step is rounded up so every gridline label is a whole,
 * human number and the top line sits just above the peak. This is what turns a
 * raw maximum like ۱۴٬۵۸۰٬۰۰۰ into a clean `۰ / ۵م / ۱۰م / ۱۵م` axis.
 */
function niceScale(rawMax: number, intervals = 4): { max: number; step: number } {
  if (!(rawMax > 0)) return { max: 1, step: 1 };
  const step = niceStep(rawMax / intervals);
  return { max: step * intervals, step };
}

/** Compact Persian axis label — ۱۵٬۰۰۰٬۰۰۰ → «۱۵م», ۷٬۵۰۰ → «۸ه». */
function compactFa(v: number): string {
  const abs = Math.abs(v);
  const round = (n: number, unit: number) =>
    toPersianNumber(Number((n / unit).toFixed(abs % unit === 0 ? 0 : 1)));
  if (abs >= 1_000_000_000) return `${round(v, 1_000_000_000)}میلیارد`;
  if (abs >= 1_000_000) return `${round(v, 1_000_000)}م`;
  if (abs >= 1_000) return `${round(v, 1_000)}ه`;
  return toPersianNumber(v);
}

/**
 * A monotone cubic (Fritsch–Carlson) smooth path through `pts` in ascending-x
 * order. Unlike a vanilla Catmull-Rom, tangents are clamped so the curve never
 * overshoots — a flat run stays perfectly flat and the line can never dip below
 * zero between two points. That is the difference between a "fake" interpolated
 * value and a faithful, smoothed read of the real one.
 */
function smoothPath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  const first = pts[0]!;
  if (n === 1) return `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const h = b.x - a.x;
    dx[i] = h;
    slope[i] = h === 0 ? 0 : (b.y - a.y) / h;
  }

  const tan: number[] = new Array<number>(n).fill(0);
  tan[0] = slope[0] ?? 0;
  tan[n - 1] = slope[n - 2] ?? 0;
  for (let i = 1; i < n - 1; i++) {
    const m0 = slope[i - 1] ?? 0;
    const m1 = slope[i] ?? 0;
    if (m0 * m1 <= 0) {
      tan[i] = 0;
    } else {
      const w1 = 2 * dx[i]! + dx[i - 1]!;
      const w2 = dx[i]! + 2 * dx[i - 1]!;
      tan[i] = (w1 + w2) / (w1 / m0 + w2 / m1);
    }
  }

  let d = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const h = dx[i]!;
    const c1x = a.x + h / 3;
    const c1y = a.y + (tan[i]! * h) / 3;
    const c2x = b.x - h / 3;
    const c2y = b.y - (tan[i + 1]! * h) / 3;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  return d;
}

// ---------------------------------------------------------------------------
// Line chart — trend over time
// ---------------------------------------------------------------------------

export interface LineOverlay {
  /** Series name shown in the tooltip (e.g. «دورهٔ قبل»). */
  label: string;
  /** One value per point, aligned to `points` BY INDEX. */
  values: number[];
  /** Line colour; defaults to a muted tone so it reads as secondary. */
  color?: string;
}

export function LineChart({
  points,
  ariaLabel,
  seriesName = "مقدار",
  unit = "",
  color = "var(--chart-cat-1)",
  overlay,
  axisFont = AXIS_FONT,
}: {
  points: ChartPoint[];
  ariaLabel: string;
  seriesName?: string;
  unit?: string;
  /** Series colour; defaults to the primary categorical token. */
  color?: string;
  /**
   * Font size (in viewBox units) for the x and y axis labels. Defaults to the
   * shared `AXIS_FONT`; a caller with a dense window may shrink it so the
   * labels stay legible. Purely presentational.
   */
  axisFont?: number;
  /**
   * An optional second series drawn as a dashed line on the SAME value scale —
   * e.g. the equal-length previous period, index-aligned to `points`. It shares
   * the axis with the primary series (never its own scale) so the two are
   * directly comparable. Purely presentational: the caller supplies the real
   * numbers, and a non-comparable overlay is simply not passed.
   */
  overlay?: LineOverlay;
}) {
  const gradientId = useSafeId("line-grad");
  const [hovered, setHovered] = useState<number | null>(null);

  const plotLeft = PAD_L;
  const plotRight = VIEW_W - GUTTER_R;
  const plotW = plotRight - plotLeft;
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const baseline = PAD_TOP + plotH;
  const n = points.length;

  // The overlay shares the axis, so its values must be inside the scale too.
  const overlayValues = overlay ? overlay.values.slice(0, n) : [];
  const hasOverlay = overlay != null && overlayValues.length === n && n > 0;

  // A clean, rounded axis so gridline labels are whole numbers.
  const { max: axisMax, step } = niceScale(
    Math.max(0, ...points.map((p) => p.value), ...overlayValues)
  );

  // First index on the RIGHT so the series reads right-to-left.
  const xAt = (i: number) => plotRight - (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const yAt = (v: number) => PAD_TOP + plotH * (1 - v / axisMax);

  const geom = points.map((p, i) => ({ x: xAt(i), y: yAt(p.value) }));
  const linePath = smoothPath(geom);
  const areaPath =
    geom.length > 1
      ? `${linePath} L ${geom[geom.length - 1]!.x.toFixed(1)} ${baseline.toFixed(1)} L ${geom[0]!.x.toFixed(
          1
        )} ${baseline.toFixed(1)} Z`
      : "";

  const overlayColor = overlay?.color ?? "var(--color-outline)";
  const overlayPath = hasOverlay
    ? smoothPath(overlayValues.map((v, i) => ({ x: xAt(i), y: yAt(v) })))
    : "";

  // One gridline per rounded step, labelled in the right-hand gutter.
  const ticks = Array.from({ length: Math.round(axisMax / step) + 1 }, (_, k) => k * step);

  // Show roughly six axis labels so dense windows stay legible.
  const labelStride = Math.max(1, Math.ceil(n / 6));
  const endIdx = n - 1;
  const active = hovered != null ? points[hovered] : undefined;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block h-auto w-full"
        // The geometry is placed right-to-left by hand (index 0 on the right),
        // so the canvas itself is LTR. Without this the SVG inherits the RTL
        // page direction, which flips `text-anchor="end"` to the left and
        // pushes the value-axis labels out past the viewBox.
        style={{ direction: "ltr" }}
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines + value axis (right gutter) */}
        {ticks.map((v) => {
          const y = yAt(v);
          return (
            <g key={v}>
              <line
                x1={plotLeft}
                y1={y}
                x2={plotRight}
                y2={y}
                stroke="var(--color-divider)"
                strokeWidth="1"
                strokeDasharray={v === 0 ? "0" : "6 8"}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={VIEW_W - 6}
                y={y + axisFont * 0.34}
                textAnchor="end"
                fontSize={axisFont}
                fill="var(--color-muted)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {compactFa(v)}
              </text>
            </g>
          );
        })}

        {/* Hover guide — a vertical rule at the active index */}
        {hovered != null && (
          <line
            x1={xAt(hovered)}
            y1={PAD_TOP}
            x2={xAt(hovered)}
            y2={baseline}
            stroke="var(--color-divider)"
            strokeWidth="1"
            strokeDasharray="4 6"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Series */}
        {n > 1 && (
          <>
            <path d={areaPath} fill={`url(#${gradientId})`} />
            {/* Previous-period overlay — dashed, so it reads as the comparison
                series and never as the primary trend. */}
            {hasOverlay && (
              <path
                d={overlayPath}
                fill="none"
                stroke={overlayColor}
                strokeWidth="2"
                strokeDasharray="7 6"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}

        {/* Marks: a single end-of-series dot, plus the hovered point — no dot
            per day, so a flat run reads as a clean line instead of a bead row. */}
        {n > 0 && (
          <circle
            cx={xAt(endIdx)}
            cy={yAt(points[endIdx]!.value)}
            r="4"
            fill="var(--color-surface)"
            stroke={color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {hovered != null && (
          <>
            {hasOverlay && (
              <circle
                cx={xAt(hovered)}
                cy={yAt(overlayValues[hovered] ?? 0)}
                r="4.5"
                fill="var(--color-surface)"
                stroke={overlayColor}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <circle
              cx={xAt(hovered)}
              cy={yAt(points[hovered]!.value)}
              r="5.5"
              fill={color}
              stroke="var(--color-surface)"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}

        {/* Date axis (right → left) */}
        {points.map((p, i) =>
          i % labelStride === 0 || i === endIdx ? (
            <text
              key={`label-${i}`}
              x={xAt(i)}
              y={VIEW_H - 8}
              textAnchor="middle"
              fontSize={axisFont}
              fill="var(--color-muted)"
            >
              {p.label}
            </text>
          ) : null
        )}

        {/* Hover hit areas (drawn last so they capture the pointer) */}
        {points.map((p, i) => {
          const half = n <= 1 ? plotW / 2 : plotW / (n - 1) / 2;
          const cx = xAt(i);
          return (
            <rect
              key={`hit-${i}`}
              x={cx - half}
              y={PAD_TOP}
              width={half * 2}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </svg>

      {/* Tooltip */}
      {active && hovered != null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-medium border border-divider bg-surface px-2.5 py-1.5 shadow-elevation-3"
          style={{
            left: `${Math.min(88, Math.max(12, (xAt(hovered) / VIEW_W) * 100))}%`,
            top: 4,
          }}
        >
          <p className="whitespace-nowrap text-caption text-muted">{active.tooltipLabel}</p>
          <p className="whitespace-nowrap text-body-2 font-bold text-onSurface">
            {seriesName}:{" "}
            <span dir="ltr" className="tabular-nums">
              {toPersianNumber(active.value)}
            </span>
            {unit ? ` ${unit}` : ""}
          </p>
          {hasOverlay && overlay && (
            <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-body-2 text-on-surface-variant">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-small"
                style={{ backgroundColor: overlayColor }}
              />
              {overlay.label}:{" "}
              <span dir="ltr" className="font-bold tabular-nums text-onSurface">
                {toPersianNumber(overlayValues[hovered] ?? 0)}
              </span>
              {unit ? ` ${unit}` : ""}
            </p>
          )}
        </div>
      )}

      {/* Screen-reader equivalent of the series (both lines when overlaid) */}
      <ul className="sr-only">
        {points.map((p, i) => (
          <li key={i}>
            {p.tooltipLabel}: {seriesName} {toPersianNumber(p.value)}
            {unit ? ` ${unit}` : ""}
            {hasOverlay && overlay
              ? `؛ ${overlay.label} ${toPersianNumber(overlayValues[i] ?? 0)}${unit ? ` ${unit}` : ""}`
              : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bar chart — comparison across categories
// ---------------------------------------------------------------------------

export interface BarDatum {
  label: string;
  value: number;
  /** Pre-formatted value text (e.g. a currency string); defaults to the count. */
  display?: string;
  /** Bar fill; defaults to the primary series colour. */
  color?: string;
}

export function BarChart({
  bars,
  ariaLabel,
  unit = "",
}: {
  bars: BarDatum[];
  ariaLabel: string;
  /** Suffix appended after the numeric value (e.g. «تومان»). */
  unit?: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <ul className="space-y-3" aria-label={ariaLabel}>
      {bars.map((b) => {
        const pct = Math.round((b.value / max) * 100);
        const text = b.display ?? `${toPersianNumber(b.value)}${unit ? ` ${unit}` : ""}`;
        return (
          <li key={b.label} className="grid grid-cols-[minmax(0,6.5rem)_1fr] items-center gap-3">
            <span className="truncate text-body-2 text-on-surface-variant" title={b.label}>
              {b.label}
            </span>
            <div className="flex items-center gap-3">
              <div
                className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--chart-track)]"
                role="img"
                aria-label={`${b.label}: ${text}`}
                title={`${b.label}: ${text}`}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-short4 ease-standard"
                  style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: b.color ?? "var(--chart-cat-1)" }}
                />
              </div>
              <span
                dir="ltr"
                className="w-24 shrink-0 text-end text-body-2 tabular-nums text-onSurface"
              >
                {text}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Grouped bar chart — compare N series across the SAME categories (per day)
// ---------------------------------------------------------------------------

export interface GroupedSeries {
  /** Series name (e.g. «نقره‌ای»), shown in the tooltip. */
  name: string;
  /** One value per category, aligned to `categories` by index. */
  values: number[];
  /** Fill; defaults to a stable palette colour by series index. */
  color?: string;
}

/**
 * A dependency-free grouped-bar chart: for each category (a day) it draws one
 * bar per series side by side, so plan-vs-plan volume is directly comparable
 * without stacking. Everything is real input — a category with all-zero
 * values renders an empty slot (no bar), never an interpolated height.
 *
 * RTL: the first category is drawn on the RIGHT, matching every other chart
 * here; the value axis sits in the right-hand gutter. A screen-reader table
 * mirrors every number so the comparison is reachable without colour/hover.
 */
export function GroupedBarChart({
  categories,
  series,
  ariaLabel,
  unit = "",
  valueFormat,
}: {
  /** Category axis labels (already Persian-formatted by the caller). */
  categories: string[];
  series: GroupedSeries[];
  ariaLabel: string;
  /** Suffix appended after the numeric value in the tooltip. */
  unit?: string;
  /** Optional per-value text formatter (e.g. a Toman string). */
  valueFormat?: (n: number) => string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const fmt = valueFormat ?? ((n: number) => toPersianNumber(n));

  const plotLeft = PAD_L;
  const plotRight = VIEW_W - GUTTER_R;
  const plotW = plotRight - plotLeft;
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const baseline = PAD_TOP + plotH;
  const n = categories.length;
  const s = Math.max(1, series.length);

  const rawMax = Math.max(0, ...series.flatMap((g) => g.values));
  const { max: axisMax, step } = niceScale(rawMax);
  const ticks = Array.from({ length: Math.round(axisMax / step) + 1 }, (_, k) => k * step);

  // Cluster geometry: category i occupies column i; columns run right→left.
  const colW = n > 0 ? plotW / n : plotW;
  const clusterW = colW * 0.74;
  const barW = clusterW / s;
  const colCenter = (i: number) => plotRight - (i + 0.5) * colW;
  const clusterLeft = (i: number) => colCenter(i) - clusterW / 2;
  const barX = (i: number, j: number) => clusterLeft(i) + j * barW;
  const yAt = (v: number) => PAD_TOP + plotH * (1 - v / axisMax);

  const labelStride = Math.max(1, Math.ceil(n / 6));
  const endIdx = n - 1;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block h-auto w-full"
        style={{ direction: "ltr" }}
        role="img"
        aria-label={ariaLabel}
      >
        {/* Gridlines + value axis (right gutter) */}
        {ticks.map((v) => {
          const y = yAt(v);
          return (
            <g key={v}>
              <line
                x1={plotLeft}
                y1={y}
                x2={plotRight}
                y2={y}
                stroke="var(--color-divider)"
                strokeWidth="1"
                strokeDasharray={v === 0 ? "0" : "6 8"}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={VIEW_W - 6}
                y={y + AXIS_FONT * 0.34}
                textAnchor="end"
                fontSize={AXIS_FONT}
                fill="var(--color-muted)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {compactFa(v)}
              </text>
            </g>
          );
        })}

        {/* Bars (one cluster per category) */}
        {categories.map((_, i) => (
          <g key={`cluster-${i}`} opacity={hovered == null || hovered === i ? 1 : 0.55}>
            {series.map((g, j) => {
              const value = g.values[i] ?? 0;
              if (value <= 0) return null;
              const y = yAt(value);
              const h = baseline - y;
              return (
                <rect
                  key={`bar-${i}-${j}`}
                  x={barX(i, j)}
                  y={y}
                  width={Math.max(1, barW - 2)}
                  height={h}
                  rx={3}
                  fill={g.color ?? catColor(j)}
                />
              );
            })}
          </g>
        ))}

        {/* Category axis (right → left) */}
        {categories.map((label, i) =>
          i % labelStride === 0 || i === endIdx ? (
            <text
              key={`label-${i}`}
              x={colCenter(i)}
              y={VIEW_H - 8}
              textAnchor="middle"
              fontSize={AXIS_FONT}
              fill="var(--color-muted)"
            >
              {label}
            </text>
          ) : null
        )}

        {/* Hover hit areas (drawn last) */}
        {categories.map((_, i) => (
          <rect
            key={`hit-${i}`}
            x={clusterLeft(i) - (colW - clusterW) / 2}
            y={PAD_TOP}
            width={colW}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>

      {/* Tooltip — every series in the hovered category */}
      {hovered != null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-medium border border-divider bg-surface px-2.5 py-1.5 shadow-elevation-3"
          style={{
            left: `${Math.min(88, Math.max(12, (colCenter(hovered) / VIEW_W) * 100))}%`,
            top: 4,
          }}
        >
          <p className="whitespace-nowrap text-caption text-muted">
            {categories[hovered]}
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {series.map((g, j) => (
              <li key={g.name} className="flex items-center gap-2 whitespace-nowrap text-body-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-small"
                  style={{ backgroundColor: g.color ?? catColor(j) }}
                />
                <span className="text-on-surface-variant">{g.name}:</span>
                <span dir="ltr" className="font-bold tabular-nums text-onSurface">
                  {fmt(g.values[hovered] ?? 0)}
                  {unit ? ` ${unit}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Screen-reader equivalent */}
      <ul className="sr-only">
        {categories.map((c, i) => (
          <li key={i}>
            {c}:{" "}
            {series
              .map((g) => `${g.name} ${fmt(g.values[i] ?? 0)}${unit ? ` ${unit}` : ""}`)
              .join("، ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline — a compact trend glyph for KPI cards
// ---------------------------------------------------------------------------

const SPARK_W = 100;
const SPARK_H = 32;
const SPARK_PAD = 5;

/**
 * One smoothed line over the real values handed in — no axis, no labels, no
 * tooltip — so it stays legible inside a small KPI card and never competes with
 * the number above it. Returns `null` for fewer than two points (a single value
 * has no trend to draw). A flat series (every value identical) draws a level
 * mid-line rather than collapsing onto an edge.
 *
 * RTL: matches every other chart here — the first (oldest) index is drawn on the
 * RIGHT so the series reads right-to-left; the SVG is consequently LTR so the
 * geometry is not mirrored by the RTL page.
 */
export function Sparkline({
  values,
  ariaLabel,
  color = "var(--chart-cat-1)",
  height = 40,
  className = "",
}: {
  values: number[];
  ariaLabel: string;
  color?: string;
  /** Rendered pixel height of the glyph. */
  height?: number;
  className?: string;
}) {
  const gradientId = useSafeId("spark-grad");
  if (values.length < 2) return null;

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const flat = hi === lo;
  const span = hi - lo || 1;
  const n = values.length;
  const xAt = (i: number) => (n <= 1 ? SPARK_W / 2 : SPARK_W - (i * SPARK_W) / (n - 1));
  const yAt = (v: number) =>
    flat ? SPARK_H / 2 : SPARK_H - SPARK_PAD - ((v - lo) / span) * (SPARK_H - 2 * SPARK_PAD);

  const geom = values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  const linePath = smoothPath(geom);
  const areaPath = `${linePath} L ${geom[geom.length - 1]!.x.toFixed(1)} ${SPARK_H} L ${geom[0]!.x.toFixed(1)} ${SPARK_H} Z`;

  return (
    <svg
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className={`block w-full ${className}`}
      style={{ height, direction: "ltr" }}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Donut chart — composition of a few categories
// ---------------------------------------------------------------------------

export interface DonutSlice {
  label: string;
  value: number;
}

/**
 * A dependency-free donut. Segments are laid out in the given order and each
 * keeps a STABLE colour (index → `CAT`), so re-ordering or filtering never
 * repaints a category. The hole carries the total; a legend lists every slice
 * with its count and share, and the whole composition is mirrored into an
 * `sr-only` list so it is reachable without colour.
 *
 * Returns `null` when every slice is zero — the caller renders its own empty
 * state instead of a blank ring.
 */
export function DonutChart({
  slices,
  ariaLabel,
  centerLabel,
  size = 168,
  thickness = 22,
  layout = "auto",
}: {
  slices: DonutSlice[];
  ariaLabel: string;
  /** Caption under the total in the hole (e.g. «درخواست باز»). */
  centerLabel: string;
  size?: number;
  thickness?: number;
  /**
   * `auto` (default) lays the ring and legend side-by-side from tablet up.
   * `stack` keeps them in one column — for a narrow container (e.g. a KPI grid
   * cell) where a side-by-side legend would not fit.
   */
  layout?: "auto" | "stack";
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = slices.length > 1 ? 2 : 0; // small visual separation, in %, of the ring

  let offset = 0;
  const arcs = slices.map((s, i) => {
    const frac = s.value / total;
    const dash = Math.max(0, frac * circumference - gap);
    const arc = { s, i, dash, offset, color: catColor(i) };
    offset += frac * circumference;
    return arc;
  });

  return (
    <div
      className={`flex flex-col items-center ${
        layout === "stack" ? "gap-3" : "gap-4 tablet:flex-row tablet:items-center tablet:justify-center"
      }`}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          role="img"
          aria-label={ariaLabel}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--chart-track)"
            strokeWidth={thickness}
          />
          {arcs.map((a) => (
            <circle
              key={a.s.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={a.color}
              strokeWidth={thickness}
              strokeDasharray={`${a.dash} ${circumference - a.dash}`}
              strokeDashoffset={-a.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-h2 font-bold tabular-nums text-onSurface">
            {toPersianNumber(total)}
          </span>
          <span className="text-caption text-muted">{centerLabel}</span>
        </div>
      </div>

      <ul className="w-full max-w-xs space-y-2">
        {arcs.map((a) => {
          const pct = Math.round((a.s.value / total) * 100);
          return (
            <li key={a.s.label} className="flex items-center gap-2 text-body-2">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 shrink-0 rounded-small"
                style={{ backgroundColor: a.color }}
              />
              <span className="min-w-0 flex-1 truncate text-on-surface-variant" title={a.s.label}>
                {a.s.label}
              </span>
              <span className="shrink-0 tabular-nums text-onSurface">
                {toPersianNumber(a.s.value)}
              </span>
              <span dir="ltr" className="w-10 shrink-0 text-end tabular-nums text-muted">
                {toPersianNumber(pct)}٪
              </span>
            </li>
          );
        })}
      </ul>

      <ul className="sr-only">
        {slices.map((s) => (
          <li key={s.label}>
            {s.label}: {toPersianNumber(s.value)}
          </li>
        ))}
      </ul>
    </div>
  );
}
