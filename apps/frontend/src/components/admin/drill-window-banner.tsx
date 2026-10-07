// ============================================================
// LEGALIR — Admin · drill-window banner
// ============================================================
// Shown on an operational page when it was opened from a BI KPI with a range
// (`?fromIso&toIso`). It states — in Jalali — exactly which window is active
// and offers a one-click way back to the unfiltered list, so the operator is
// never left wondering why the page shows fewer rows than expected.
//
// Renders nothing when no window is present, so the default page is unchanged.
// ============================================================

"use client";

import { usePathname, useRouter } from "next/navigation";
import { Card, Button } from "@/components/admin/ui";
import { toPersianDate } from "@/lib/persian-utils";
import { IconClock } from "@/lib/icons";
import { useDrillWindow } from "@/hooks/useAnalyticsDrill";

export function DrillWindowBanner({ subjectFa }: { subjectFa: string }) {
  const window = useDrillWindow();
  const router = useRouter();
  const pathname = usePathname();

  if (!window) return null;

  return (
    <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-s-2 border-s-brand p-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-medium bg-brand-soft text-brand-700"
        >
          <IconClock size={17} />
        </span>
        <p className="text-body-2 text-on-surface-variant">
          این فهرست {subjectFa} را فقط برای بازهٔ{" "}
          <strong className="font-semibold">
            از {toPersianDate(window.fromIso)} تا {toPersianDate(window.toIso)}
          </strong>{" "}
          نشان می‌دهد؛ همان بازه‌ای که شاخص تحلیل روی آن محاسبه شده است.
        </p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => router.replace(pathname)}
        title="نمایش همهٔ ردیف‌ها بدون محدودیت بازه"
      >
        حذف فیلتر بازه
      </Button>
    </Card>
  );
}
