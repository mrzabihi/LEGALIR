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

export function ChartFrame({
  title,
  subtitle,
  legend,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  legend?: { label: string; color: string }[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-4 tablet:p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-body-1 font-bold text-onSurface">{title}</h3>
          {subtitle && <p className="mt-0.5 text-caption text-muted">{subtitle}</p>}
        </div>
        {legend && legend.length > 0 && (
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
        )}
      </div>
      {children}
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
const AXIS_FONT = 30; // large in viewBox units so it stays legible when scaled

/** Sanitize a React `useId` value into an id safe for `url(#…)`. */
function useSafeId(prefix: string): string {
  const raw = useId();
  return `${prefix}-${raw.replace(/[:]/g, "")}`;
}

// ---------------------------------------------------------------------------
// Line chart — trend over time
// ---------------------------------------------------------------------------

export function LineChart({
  points,
  ariaLabel,
  seriesName = "مقدار",
  unit = "",
}: {
  points: ChartPoint[];
  ariaLabel: string;
  seriesName?: string;
  unit?: string;
}) {
  const gradientId = useSafeId("line-grad");
  const [hovered, setHovered] = useState<number | null>(null);

  const plotLeft = PAD_L;
  const plotRight = VIEW_W - GUTTER_R;
  const plotW = plotRight - plotLeft;
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const maxValue = Math.max(1, ...points.map((p) => p.value));
  const n = points.length;

  // First index on the RIGHT so the series reads right-to-left.
  const xAt = (i: number) => plotRight - (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const yAt = (v: number) => PAD_TOP + plotH * (1 - v / maxValue);

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.value).toFixed(1)}`)
    .join(" ");
  const areaPath =
    points.length > 1
      ? `${linePath} L ${xAt(n - 1).toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} L ${xAt(
          0
        ).toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} Z`
      : "";

  // Five horizontal gridlines at 25% steps, labelled with their value.
  const gridFractions = [0, 0.25, 0.5, 0.75, 1];
  // Show roughly six axis labels so dense windows stay legible.
  const labelStride = Math.max(1, Math.ceil(n / 6));

  const active = hovered != null ? points[hovered] : undefined;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines + value axis (right gutter) */}
        {gridFractions.map((f) => {
          const y = PAD_TOP + plotH * (1 - f);
          return (
            <g key={f}>
              <line
                x1={plotLeft}
                y1={y}
                x2={plotRight}
                y2={y}
                stroke="var(--color-divider)"
                strokeWidth="1"
                strokeDasharray={f === 0 ? "0" : "6 8"}
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
                {toPersianNumber(Math.round(maxValue * f))}
              </text>
            </g>
          );
        })}

        {/* Series */}
        {points.length > 1 && (
          <>
            <path d={areaPath} fill={`url(#${gradientId})`} />
            <path
              d={linePath}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}

        {/* Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xAt(i)}
            cy={yAt(p.value)}
            r={hovered === i ? 6 : 4}
            fill="var(--color-surface)"
            stroke="var(--color-primary)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Date axis (right → left) */}
        {points.map((p, i) =>
          i % labelStride === 0 || i === n - 1 ? (
            <text
              key={`label-${i}`}
              x={xAt(i)}
              y={VIEW_H - 8}
              textAnchor="middle"
              fontSize={AXIS_FONT}
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
        </div>
      )}

      {/* Screen-reader equivalent of the series */}
      <ul className="sr-only">
        {points.map((p, i) => (
          <li key={i}>
            {p.tooltipLabel}: {toPersianNumber(p.value)}
            {unit ? ` ${unit}` : ""}
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
                className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-container-high"
                role="img"
                aria-label={`${b.label}: ${text}`}
                title={`${b.label}: ${text}`}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-short4 ease-standard"
                  style={{ width: `${Math.max(pct, 2)}%` }}
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
