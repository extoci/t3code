import { useMemo } from "react";
import { View } from "react-native";

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
 * Stacked period bars drawn with plain views. Android and any platform without
 * Swift Charts land here; iOS resolves `UsageDailyChart.ios.tsx` instead.
 */
export function UsageDailyChart({ periods, totals, metric, height }: UsageDailyChartProps) {
  const colors = useProviderColors();
  const chartPeriods = useMemo(
    () => buildChartPeriods(periods, totals, metric),
    [metric, periods, totals],
  );
  const max = chartPeriods.reduce((peak, period) => Math.max(peak, period.total), 0);

  return (
    <View style={{ height }} className="flex-row items-end gap-px">
      {/* column-reverse stacks the bottom-first provider values upward
          without reversing the array (Hermes lacks Array#toReversed). */}
      {chartPeriods.map((period) => (
        <View
          key={period.key}
          className="h-full flex-1 flex-col-reverse overflow-hidden rounded-sm"
        >
          {period.values.map((entry) => (
            <View
              key={entry.provider}
              style={{
                height: max === 0 ? 0 : (entry.value / max) * height,
                backgroundColor: colors[entry.provider],
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
