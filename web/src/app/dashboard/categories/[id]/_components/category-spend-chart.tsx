// Server wrapper: the card chrome, empty state and caption stay here so the
// chart itself is pure composition and the only thing shipped to the client.
// Path and export name are unchanged, so categories/[id]/page.tsx is untouched.

import type { Bucket } from "@prisma/client";
import { ChartCard } from "@/components/analytics/chart-card";
import { CategorySpendBars } from "@/components/analytics/charts/category-spend-bars";
import { deltaInsight } from "@/lib/insights";

interface CategorySpendChartProps {
  data: { label: string; spend: number }[];
  bucket: Bucket;
  budget: number | null;
  currency?: string;
  locale?: string;
}

export function CategorySpendChart({
  data,
  bucket,
  budget,
  currency = "INR",
  locale = "en-IN",
}: CategorySpendChartProps) {
  const hasActivity = data.some((d) => d.spend > 0);
  const hasBudget = budget != null && budget > 0;

  // Compare the two most recent cycles. SAVINGS inverts: spending toward the
  // target is the goal, so more is better.
  const current = data[data.length - 1]?.spend ?? 0;
  const previous = data[data.length - 2]?.spend ?? 0;

  return (
    <ChartCard
      title="Spend over time"
      description={`This category per budget cycle${hasBudget ? " — the shaded band is over the monthly limit" : ""}`}
      isEmpty={!hasActivity}
      emptyLabel="No spend recorded yet in this category."
      insight={deltaInsight({
        label: "This category",
        current,
        previous,
        currency,
        locale,
        higherIsWorse: bucket !== "SAVINGS",
        materialFloor: previous * 0.02,
      })}
    >
      <CategorySpendBars
        data={data}
        bucket={bucket}
        budget={budget}
        currency={currency}
        locale={locale}
      />
    </ChartCard>
  );
}
