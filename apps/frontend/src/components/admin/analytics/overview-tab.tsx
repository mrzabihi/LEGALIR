// ============================================================
// LEGALIR — Analytics tab · Executive overview
// ============================================================
// The landing tab: every KPI the overview endpoint returns, each one either a
// real value with a real previous-period comparison or an explicit «ناموجود»
// with its reason. Nothing is grouped away or duplicated — the server decides
// the KPI set and this tab renders it faithfully.
// ============================================================

"use client";

import { Section, StateView } from "@/components/admin/ui";
import { useAnalyticsOverview } from "@/hooks/useAnalytics";
import type { AnalyticsRangeQuery } from "@/lib/api/analytics";
import { AnalyticsKpiView, QualityPanel, WindowCaption } from "./kit";

const KPI_GRID =
  "grid grid-cols-1 gap-3 mobile-l:grid-cols-2 tablet:grid-cols-3 desktop:grid-cols-4";

export function OverviewTab({ range }: { range: AnalyticsRangeQuery }) {
  const query = useAnalyticsOverview(range);

  return (
    <StateView
      query={query}
      loadingRows={6}
      isEmpty={(d) => d.kpis.length === 0}
      emptyMessage="شاخصی برای نمایش وجود ندارد."
    >
      {(data) => (
        <>
          <WindowCaption window={data.window} refreshedAt={data.generatedAt} />

          <Section
            title="شاخص‌های کلیدی"
            subtitle="هر شاخص یا مقدار واقعی دارد یا به‌صراحت «ناموجود» است؛ در حالت ناموجود دلیل و مسیر واقعی‌شدن آمده است."
            infoFa={`منطقه زمانی: ${data.timezone} · واحد پول: ${data.currency} · مقایسه همیشه با بازهٔ هم‌طول قبل انجام می‌شود.`}
          >
            <div className={KPI_GRID}>
              {data.kpis.map((k) => (
                <AnalyticsKpiView key={k.key} kpi={k} />
              ))}
            </div>
          </Section>

          <QualityPanel flags={data.quality} />
        </>
      )}
    </StateView>
  );
}
