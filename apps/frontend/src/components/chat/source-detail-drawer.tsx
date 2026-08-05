"use client";

import { useSource, useSourceVersions } from "@/hooks/useConversations";
import { IconClose, IconError } from "@/lib/icons";
import { SourceCard } from "./source-card";
import { Skeleton } from "@legalir/ui";

interface SourceDetailDrawerProps {
  sourceId: string | null;
  onClose: () => void;
}

export function SourceDetailDrawer({ sourceId, onClose }: SourceDetailDrawerProps) {
  const { data: source, isLoading, error } = useSource(sourceId ?? undefined);
  const { data: versions } = useSourceVersions(sourceId ?? undefined);

  const isOpen = sourceId !== null;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-scrim animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={[
          "absolute top-0 bottom-0 end-0 bg-surface shadow-elevation-16",
          "flex flex-col overflow-auto animate-slide-in-end",
          "w-full tablet:w-[400px]",
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label="جزئیات منبع"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-divider shrink-0">
          <h2 className="text-titleMedium text-onSurface">جزئیات منبع</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-onSurface/[0.08] transition-colors touch-target"
            aria-label="بستن"
          >
            <IconClose size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}

          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <IconError size={48} className="text-muted mb-3" />
              <h3 className="text-titleSmall text-onSurface mb-1">
                {error.message.includes("دسترسی") ? "دسترسی محدود" : "منبع یافت نشد"}
              </h3>
              <p className="text-bodyMedium text-muted">
                {error.message}
              </p>
            </div>
          )}

          {source && !isLoading && !error && (
            <SourceCard source={source} />
          )}

          {/* Versions */}
          {versions && versions.length > 0 && !isLoading && !error && (
            <div className="mt-6 pt-4 border-t border-divider">
              <h3 className="text-labelLarge text-onSurface mb-3">تاریخچه ویرایش‌ها</h3>
              <div className="space-y-3">
                {versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="rounded-medium bg-surfaceVariant/30 p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-labelMedium text-onSurface">
                        نسخه {ver.versionDate}
                      </span>
                      <span className="text-bodySmall text-muted">
                        اجرا از {ver.effectiveDate}
                      </span>
                    </div>
                    <p className="text-bodySmall text-onSurfaceVariant">
                      {ver.changes}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
