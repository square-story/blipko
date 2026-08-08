"use client";

// Where this cycle's money went.
//
// Replaces ui/rounded-pie-chart.tsx, which still carried shadcn's demo field
// names (it renamed categories to `browser` and amounts to `visitors`), set an
// invalid `radius` prop on the Pie, and cycled its own ["#0088FE", …] array —
// so a category was one colour here and a different one in every other chart.
//
// The legend is the shared Meter, driven by the same hover index as the donut,
// rather than bklit's Legend component: that one pulls in a second headless
// primitives library for a list this app can already render.

import { useState } from "react";
import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { PieCenter } from "@/components/charts/pie-center";
import { Meter } from "@/components/ui/meter";
import { seriesColor, seriesClass } from "@/lib/chart-palette";
import { formatMoney } from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { CategorySliceRow } from "@/lib/actions/analytics";
import Link from "next/link";

export function CategoryDonutChart({
  data,
  currency,
  locale,
}: {
  data: CategorySliceRow[];
  currency: string;
  locale: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  // Everything past the fifth slice becomes one "Other" wedge. Beyond that the
  // palette repeats and the slices are too thin to read anyway.
  const top = data.slice(0, 5);
  const rest = data.slice(5);
  const restTotal = rest.reduce((s, c) => s + c.value, 0);
  const slices = [
    ...top,
    ...(restTotal > 0
      ? [
          {
            id: "__other__",
            name: `${rest.length} more`,
            value: restTotal,
            pct: rest.reduce((s, c) => s + c.pct, 0),
            href: null,
          },
        ]
      : []),
  ];

  const total = slices.reduce((s, c) => s + c.value, 0);
  const pieData = slices.map((c, i) => ({
    label: c.name,
    value: c.value,
    color: seriesColor(i),
  }));

  return (
    <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center">
      <PieChart
        data={pieData}
        size={240}
        innerRadius={70}
        padAngle={0.02}
        cornerRadius={6}
        hoveredIndex={hovered}
        onHoverChange={setHovered}
      >
        {pieData.map((_, i) => (
          <PieSlice key={i} index={i} />
        ))}
        <PieCenter>
          {({ value, label, isHovered }) => (
            <div className="text-center">
              <div className="font-mono text-xl font-semibold tabular-nums">
                {formatMoney(isHovered ? value : total, currency, locale)}
              </div>
              <div className="mt-0.5 max-w-[10ch] truncate text-xs text-muted-foreground">
                {isHovered ? label : "this cycle"}
              </div>
            </div>
          )}
        </PieCenter>
      </PieChart>

      <ul className="w-full flex-1 space-y-3">
        {slices.map((c, i) => {
          const row = (
            <>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className={cn("size-2.5 shrink-0 rounded-xs", seriesClass(i))}
                  />
                  <span className="truncate font-medium">{c.name}</span>
                </span>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {formatMoney(c.value, currency, locale)} · {Math.round(c.pct)}%
                </span>
              </div>
              <Meter
                value={c.pct}
                size="sm"
                className="mt-1.5"
                label={`${c.name} share`}
              />
            </>
          );

          return (
            <li
              key={c.id}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                "rounded-md transition-opacity",
                hovered !== null && hovered !== i && "opacity-50",
              )}
            >
              {c.href ? (
                <Link href={c.href} className="block">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
