// Money in versus money out, and whether any of it is being kept.

import { getCashflowAnalytics } from "@/lib/actions/analytics";
import { ChartCard } from "@/components/analytics/chart-card";
import { IncomeVsSpendChart } from "@/components/analytics/charts/income-vs-spend-chart";
import { CumulativeCashflowChart } from "@/components/analytics/charts/cumulative-cashflow-chart";
import { SavingsRateChart } from "@/components/analytics/charts/savings-rate-chart";
import { InOutBarChart } from "@/components/analytics/charts/in-out-bar-chart";
import { getBudgetSettings } from "@/lib/actions/budget";
import { formatMoney } from "@/lib/budget";
import { expensesHref } from "@/lib/analytics/drilldown";

export async function CashflowTab({ range }: { range: number }) {
  const [data, settings] = await Promise.all([
    getCashflowAnalytics(range),
    getBudgetSettings(),
  ]);
  const { meta, cashflow, savings, boxes, insights, cyclesWithoutIncome } = data;

  const noMoney = cashflow.every((c) => c.income === 0 && c.spend === 0);
  const window = {
    from: meta.cycles[0]?.start,
    to: meta.cycles[meta.cycles.length - 1]?.end,
  };
  const ending = cashflow[cashflow.length - 1]?.cumulative ?? 0;

  return (
    <>
      <ChartCard
        title="Income vs spending"
        description="Money in and money out per budget cycle, with net over the top"
        insight={insights.cashflow}
        isEmpty={noMoney}
        emptyLabel="Log an expense or some income to see this trend."
        drill={{ href: expensesHref(window), label: "See these transactions" }}
      >
        <IncomeVsSpendChart
          data={cashflow}
          currency={meta.currency}
          locale={meta.locale}
        />
      </ChartCard>

      <ChartCard
        title="Running balance"
        description={`Everything logged in, minus everything out, added up across ${meta.cyclesAvailable} ${meta.cyclesAvailable === 1 ? "cycle" : "cycles"}`}
        insight={
          noMoney
            ? null
            : {
                text:
                  ending >= 0
                    ? `You're ${formatMoney(ending, meta.currency, meta.locale)} ahead over this window.`
                    : `You're ${formatMoney(Math.abs(ending), meta.currency, meta.locale)} behind over this window.`,
                tone: ending >= 0 ? "positive" : "negative",
              }
        }
        isEmpty={noMoney}
      >
        <CumulativeCashflowChart
          data={cashflow}
          currency={meta.currency}
          locale={meta.locale}
        />
      </ChartCard>

      <ChartCard
        title="Savings rate"
        description={
          cyclesWithoutIncome > 0
            ? `Share of income kept each cycle. ${cyclesWithoutIncome} of ${meta.cyclesAvailable} cycles have no income logged, so those are left blank.`
            : "Share of income kept each cycle, against your target"
        }
        insight={insights.savings}
        isEmpty={savings.every((s) => s.trueSavingsRatePct === null)}
        emptyLabel="Log some income to see a savings rate."
      >
        <SavingsRateChart data={savings} targetPct={settings.savingsPct} />
      </ChartCard>

      <ChartCard
        title="Savings boxes"
        description="Money added to and taken out of your boxes"
        isEmpty={!boxes.some((b) => b.in > 0 || b.out > 0)}
        emptyLabel="No box activity in this window."
      >
        <InOutBarChart
          data={boxes}
          inLabel="Added"
          outLabel="Taken out"
          currency={meta.currency}
          locale={meta.locale}
        />
      </ChartCard>
    </>
  );
}
