import { ContentLayout } from "@/components/admin-panel/content-layout";
import { getAnalyticsData } from "@/lib/actions/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RoundedPieChart } from "@/components/ui/rounded-pie-chart";
import { IncomeExpenseChart } from "../_components/income-expense-chart";
import { TrendingDown, Users, IndianRupee } from "lucide-react";

export default async function Page() {
    const { monthlyTrend, overdueContacts, categoryBreakdown, topContacts } =
        await getAnalyticsData(6);

    // Map monthlyTrend to the shape IncomeExpenseChart expects
    const chartData = monthlyTrend.map((m) => ({
        date: m.month,
        income: m.totalIn,
        expense: m.totalOut,
    }));

    const totalOverdue = overdueContacts.reduce(
        (sum, c) => sum + Math.abs(c.balance),
        0,
    );

    return (
        <ContentLayout title="Analytics">
            <div className="flex flex-col gap-6 p-4 md:p-8 pt-6">
                {/* Summary Stats */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Contacts Overdue</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{overdueContacts.length}</div>
                            <p className="text-xs text-muted-foreground">contacts with pending balances</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Overdue Amount</CardTitle>
                            <TrendingDown className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-destructive">
                                ₹{totalOverdue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                            </div>
                            <p className="text-xs text-muted-foreground">total outstanding receivables</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Top Category (This Month)</CardTitle>
                            <IndianRupee className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {categoryBreakdown[0]?.name ?? "—"}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {categoryBreakdown[0]
                                    ? `₹${categoryBreakdown[0].value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                                    : "No transactions yet"}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Monthly Trend Chart */}
                <IncomeExpenseChart data={chartData} />

                {/* Category + Overdue Row */}
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                    <RoundedPieChart
                        title="Spend by Category"
                        description="Current month breakdown"
                        chartData={categoryBreakdown}
                    />

                    {/* Overdue Contacts Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Overdue Contacts</CardTitle>
                            <CardDescription>Contacts with outstanding balances owed to you</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {overdueContacts.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-8 text-center">
                                    Everyone is settled up!
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {overdueContacts.slice(0, 10).map((contact) => (
                                        <div
                                            key={contact.id}
                                            className="flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm">{contact.name}</span>
                                                <Badge variant="secondary" className="text-xs">
                                                    {contact.category}
                                                </Badge>
                                            </div>
                                            <span className="text-sm font-semibold text-destructive">
                                                ₹{Math.abs(contact.balance).toLocaleString("en-IN", {
                                                    maximumFractionDigits: 0,
                                                })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Top Contacts by Volume */}
                <Card>
                    <CardHeader>
                        <CardTitle>Top Contacts by Transaction Volume</CardTitle>
                        <CardDescription>Contacts with the highest total transaction amounts</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {topContacts.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                                No transactions yet.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {topContacts.map((contact, i) => {
                                    const maxTotal = topContacts[0]?.total ?? 1;
                                    const pct = Math.round((contact.total / maxTotal) * 100);
                                    return (
                                        <div key={i} className="space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium">{contact.name}</span>
                                                <span className="text-muted-foreground">
                                                    ₹{contact.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                                                    {" "}·{" "}
                                                    {contact.count} txn{contact.count !== 1 ? "s" : ""}
                                                </span>
                                            </div>
                                            <div className="h-2 w-full rounded-full bg-muted">
                                                <div
                                                    className="h-2 rounded-full bg-primary"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </ContentLayout>
    );
}
