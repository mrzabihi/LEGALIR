"use client";

import type { ReactNode } from "react";

// ============================================================
// MobileTable — Responsive table that shows cards on mobile
// and a regular table on tablet and up.
// ============================================================

interface Column {
  key: string;
  label: string;
  /** Custom render for the cell value */
  render?: (value: unknown, row: Record<string, unknown>) => ReactNode;
}

interface MobileTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
  emptyMessage?: string;
  /** Row key extractor */
  rowKey: (row: Record<string, unknown>, index: number) => string;
  /** Click handler for the entire row (for navigation) */
  onRowClick?: (row: Record<string, unknown>) => void;
}

export function MobileTable({
  columns,
  data,
  emptyMessage = "داده‌ای برای نمایش وجود ندارد",
  rowKey,
  onRowClick,
}: MobileTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-large bg-surface p-8 text-center border border-divider">
        <p className="text-body-2 text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      {/* === Mobile Card View (below tablet) === */}
      <div className="tablet:hidden mobile-card-list">
        {data.map((row, idx) => (
          <MobileTableCard
            key={rowKey(row, idx)}
            columns={columns}
            row={row}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          />
        ))}
      </div>

      {/* === Desktop Table View (tablet and up) === */}
      <div className="hidden tablet:block overflow-x-auto rounded-large border border-divider">
        <table className="w-full text-right">
          <thead className="bg-surfaceVariant">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-caption text-muted font-medium whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {data.map((row, idx) => (
              <tr
                key={rowKey(row, idx)}
                className={[
                  "hover:bg-surfaceVariant/50 transition-colors",
                  onRowClick ? "cursor-pointer" : "",
                ].join(" ")}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                role={onRowClick ? "button" : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-body-2 text-on-surface whitespace-nowrap">
                    {col.render
                      ? col.render(row[col.key], row)
                      : (row[col.key] as ReactNode) ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ============================================================
// MobileTableCard — Individual card for mobile view
// ============================================================

export function MobileTableCard({
  columns,
  row,
  onClick,
}: {
  columns: Column[];
  row: Record<string, unknown>;
  onClick?: () => void;
}) {
  return (
    <div
      className={[
        "rounded-large bg-surface p-4 shadow-elevation-1 border border-divider",
        onClick ? "cursor-pointer active:bg-surfaceVariant transition-colors" : "",
      ].join(" ")}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? "button" : undefined}
    >
      <dl className="space-y-2">
        {columns.map((col) => (
          <div key={col.key} className="flex items-center justify-between gap-2">
            <dt className="text-caption text-muted shrink-0">{col.label}</dt>
            <dd className="text-body-2 text-on-surface text-left">
              {col.render
                ? col.render(row[col.key], row)
                : (row[col.key] as ReactNode) ?? "—"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
