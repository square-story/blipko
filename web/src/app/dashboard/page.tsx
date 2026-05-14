import { Suspense } from "react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import {
  getDashboardStats,
  getDashboardChartData,
  getDashboardPendingInvoices,
} from "@/lib/actions/dashboard";
import { Stat, StatLabel, StatValue, StatDescription, StatIndicator } from "@/components/ui/stat";
import { IncomeExpenseChart } from "./_components/income-expense-chart";
import { PendingInvoicesList } from "./_components/pending-invoices-list";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { AnimatedNumber } from "@/components/animated-number";
import Onboarding from "@/components/onboarding";
import { Skeleton } from "@/components/ui/skeleton";

async function StatsSection({
  statsPromise,
}: {
  statsPromise: ReturnType<typeof getDashboardStats>;
}) {
  const { totalReceivables, cashFlow, hasOnboarded } = await statsPromise;
  return (
    <>
      {!hasOnboarded && <Onboarding />}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Stat>
          <StatLabel>Total Receivables</StatLabel>
          <StatValue>
            <AnimatedNumber
              value={Math.abs(totalReceivables)}
              format={{ style: "currency", currency: "INR", trailingZeroDisplay: "stripIfInteger" }}
            />
          </StatValue>
          <StatDescription>
            {totalReceivables > 0 ? "People owe you this much" : "No outstanding receivables"}
          </StatDescription>
          <StatIndicator color="error">
            <TrendingDown className="h-4 w-4" />
          </StatIndicator>
        </Stat>

        <Stat>
          <StatLabel>Cash Flow (In)</StatLabel>
          <StatValue>
            <AnimatedNumber
              value={cashFlow.in}
              format={{ style: "currency", currency: "INR", trailingZeroDisplay: "stripIfInteger" }}
            />
          </StatValue>
          <StatDescription>Total income this month</StatDescription>
          <StatIndicator color="success">
            <TrendingUp className="h-4 w-4" />
          </StatIndicator>
        </Stat>

        <Stat>
          <StatLabel>Cash Flow (Out)</StatLabel>
          <StatValue>
            <AnimatedNumber
              value={cashFlow.out}
              format={{ style: "currency", currency: "INR", trailingZeroDisplay: "stripIfInteger" }}
            />
          </StatValue>
          <StatDescription>Total expenses this month</StatDescription>
          <StatIndicator color="warning">
            <Wallet className="h-4 w-4" />
          </StatIndicator>
        </Stat>
      </div>
    </>
  );
}

async function ChartSection({
  chartPromise,
}: {
  chartPromise: ReturnType<typeof getDashboardChartData>;
}) {
  const chartData = await chartPromise;
  return <IncomeExpenseChart data={chartData} />;
}

async function InvoicesSection({
  invoicesPromise,
}: {
  invoicesPromise: ReturnType<typeof getDashboardPendingInvoices>;
}) {
  const pendingInvoices = await invoicesPromise;
  return <PendingInvoicesList contacts={pendingInvoices} />;
}

export default function Page() {
  const statsPromise = getDashboardStats();
  const chartPromise = getDashboardChartData();
  const invoicesPromise = getDashboardPendingInvoices();

  return (
    <ContentLayout title="Dashboard">
      <div className="flex flex-col gap-4 p-4 md:p-8 pt-6">
        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          }
        >
          <StatsSection statsPromise={statsPromise} />
        </Suspense>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
          <div className="col-span-1 lg:col-span-4">
            <Suspense fallback={<Skeleton className="h-[380px] w-full rounded-xl" />}>
              <ChartSection chartPromise={chartPromise} />
            </Suspense>
          </div>
          <div className="col-span-1 lg:col-span-3">
            <Suspense fallback={<Skeleton className="h-[380px] w-full rounded-xl" />}>
              <InvoicesSection invoicesPromise={invoicesPromise} />
            </Suspense>
          </div>
        </div>
      </div>
    </ContentLayout>
  );
}
