"use client";

// The tab strip. Panels arrive as props rather than being imported, because a
// client component that imports a server component pulls it into the client
// bundle — so every tab body stays on the server and only this strip ships.
//
// `tab` uses shallow: true. Switching tabs is instant and does not hit the
// server, which is the whole reason for tabs over five routes; all five panels
// are already rendered in the server tree. `range` is the opposite: it changes
// what the queries return, so it warrants a round trip (see
// cycle-range-control.tsx), matching the shallow: false convention the
// transaction tables already use.

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryState } from "nuqs";
import {
  ANALYTICS_TABS,
  analyticsParams,
  type AnalyticsTab,
} from "@/lib/analytics/search-params";

const LABELS: Record<AnalyticsTab, string> = {
  overview: "Overview",
  cashflow: "Cashflow",
  categories: "Categories",
  commitments: "Commitments",
  habits: "Habits",
};

export function AnalyticsTabs({
  action,
  panels,
}: {
  action?: React.ReactNode;
  panels: Record<AnalyticsTab, React.ReactNode>;
}) {
  const [tab, setTab] = useQueryState(
    "tab",
    analyticsParams.tab.withOptions({ shallow: true }),
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as AnalyticsTab)}
      className="gap-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <TabsList className="w-full overflow-x-auto sm:w-auto">
          {ANALYTICS_TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>
        {action}
      </div>

      {ANALYTICS_TABS.map((t) => (
        <TabsContent key={t} value={t} className="flex flex-col gap-6">
          {panels[t]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
