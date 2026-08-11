/**
 * Shapes merged period totals into the provider stacks both chart
 * implementations (Swift Charts on iOS, plain views elsewhere) render.
 *
 * @module usageChartData
 */
import type { UsageProviderKind } from "@t3tools/contracts";
import type { UsagePeriodTotals } from "@t3tools/shared/usageMerge";
import type { UsagePeriod } from "@t3tools/shared/usageFormat";

import { PROVIDER_ORDER } from "./usageProviderOrder";

export type UsageChartMetric = "cost" | "tokens";

export interface UsageChartPeriod {
  readonly key: string;
  /** In {@link PROVIDER_ORDER}, i.e. bottom of the stack first. */
  readonly values: readonly { readonly provider: UsageProviderKind; readonly value: number }[];
  readonly total: number;
}

/** One entry per period in the window, zero-filled where nothing happened. */
export function buildChartPeriods(
  periods: readonly UsagePeriod[],
  totals: readonly UsagePeriodTotals[],
  metric: UsageChartMetric,
): readonly UsageChartPeriod[] {
  const byPeriod = new Map(totals.map((entry) => [entry.key, entry]));
  return periods.map((period) => {
    const entry = byPeriod.get(period.key);
    const values = PROVIDER_ORDER.map((provider) => {
      const providerTotals = entry?.byProvider.get(provider);
      const value =
        providerTotals === undefined
          ? 0
          : metric === "cost"
            ? providerTotals.costUsd
            : providerTotals.totalTokens;
      return { provider, value };
    });
    return {
      key: period.key,
      values,
      total: values.reduce((sum, entry) => sum + entry.value, 0),
    };
  });
}
