import { ContentLayout } from "@/components/admin-panel/content-layout";
import { getDashboardData } from "@/lib/actions/dashboard";
import { Stat, StatLabel, StatValue, StatDescription, StatIndicator } from "@/components/ui/stat";
import { IncomeExpenseChart } from "./_components/income-expense-chart";
import { PendingInvoicesList } from "./_components/pending-invoices-list";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { AnimatedNumber } from "@/components/animated-number";
import Onboarding from "@/components/onboarding";

export default async function Page() {
    const { totalReceivables, cashFlow, chartData, pendingInvoices, hasOnboarded } = await getDashboardData();

    return (
        <ContentLayout title="Dashboard">
            {!hasOnboarded && <Onboarding />}
            <div className="flex flex-col gap-4 p-4 md:p-8 pt-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Stat>
                        <StatLabel>Total Receivables</StatLabel>
                        <StatValue>
                            <AnimatedNumber value={Math.abs(totalReceivables)} format={{ style: 'currency', currency: 'INR', trailingZeroDisplay: 'stripIfInteger' }} />
                        </StatValue>
                        <StatDescription>
                            {totalReceivables < 0 ? "You are owed" : "You owe"}
                        </StatDescription>
                        <StatIndicator color="error">
                            <TrendingDown className="h-4 w-4" />
                        </StatIndicator>
                    </Stat>

                    <Stat>
                        <StatLabel>Cash Flow (In)</StatLabel>
                        <StatValue>
                            <AnimatedNumber value={cashFlow.in} format={{ style: 'currency', currency: 'INR', trailingZeroDisplay: 'stripIfInteger' }} />
                        </StatValue>
                        <StatDescription>Total income this month</StatDescription>
                        <StatIndicator color="success">
                            <TrendingUp className="h-4 w-4" />
                        </StatIndicator>
                    </Stat>

                    <Stat>
                        <StatLabel>Cash Flow (Out)</StatLabel>
                        <StatValue>
                            <AnimatedNumber value={cashFlow.out} format={{ style: 'currency', currency: 'INR', trailingZeroDisplay: 'stripIfInteger' }} />
                        </StatValue>
                        <StatDescription>Total expenses this month</StatDescription>
                        <StatIndicator color="warning">
                            <Wallet className="h-4 w-4" />
                        </StatIndicator>
                    </Stat>
                </div>

                <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
                    <div className="col-span-1 lg:col-span-4">
                        <IncomeExpenseChart data={chartData} />
                    </div>
                    <div className="col-span-1 lg:col-span-3">
                        <PendingInvoicesList contacts={pendingInvoices} />
                    </div>
                </div>
            </div>
        </ContentLayout>
    );
}
