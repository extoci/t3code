import { Chart, Host, type ChartDataPoint } from "@expo/ui/swift-ui";
import { frame } from "@expo/ui/swift-ui/modifiers";
import { useMemo } from "react";

import type { UsagePeriodTotals } from "@t3tools/shared/usageMerge";
import type { UsagePeriod } from "@t3tools/shared/usageFormat";

import { buildChartPeriods, type UsageChartMetric } from "./usageChartData";
import { useProviderColors } from "./usageProviders";

export interface UsageDailyChartProps {
  readonly periods: readonly UsagePeriod[];
  readonly totals: readonly UsagePeriodTotals[];
  readonly metric: UsageChartMetric;
  readonly height: number;
}

/**
 * Native Swift Charts period bars. Points sharing an x value stack, so emitting
 * one point per provider per period yields per-provider bands whose stack
 * height is the period's total; changes animate natively.
 *
 * Axes are hidden: 30-90 categorical day labels cannot fit on a phone, so the
 * screen renders its own edge labels under the chart instead.
 */
export function UsageDailyChart({ periods, totals, metric, height }: UsageDailyChartProps) {
  const colors = useProviderColors();

  const data = useMemo((): ChartDataPoint[] => {
    return buildChartPeriods(periods, totals, metric).flatMap((period) =>
      period.values.map((entry) => ({
        x: period.key,
        y: entry.value,
        color: colors[entry.provider],
      })),
    );
  }, [colors, metric, periods, totals]);

  return (
    <Host style={{ height, width: "100%" }}>
      <Chart
        type="bar"
        data={data}
        animate
        showGrid={false}
        barStyle={{ cornerRadius: 2 }}
        modifiers={[frame({ height })]}
      />
    </Host>
  );
}
