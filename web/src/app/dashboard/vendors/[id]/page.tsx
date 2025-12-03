import { getVendor } from "@/lib/actions/vendors";
import { notFound } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { VendorAnalytics } from "../vendor-analytics";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { AnimatedNumber } from "@/components/animated-number";

export default async function VendorDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const result = await getVendor(id);

    if (!result.success || !result.data) {
        notFound();
    }

    const vendor = result.data;
    const transactions = vendor.transactions;
    // @ts-ignore - analytics is added in the action but not in the type definition yet
    const analytics = vendor.analytics || { spendingTrend: [], categoryStats: [] };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
        }).format(amount);
    };

    return (
        <ContentLayout
            title={vendor.name}
            breadcrumbs={[
                { label: "Dashboard", href: "/dashboard" },
                { label: "Vendors", href: "/dashboard/vendors" },
                { label: vendor.name }
            ]}
        >
            <div className="space-y-6">
                <div className="flex gap-2 text-muted-foreground">
                    <span>Current Balance:</span>
                    <span className={Number(vendor.currentBalance) >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        <AnimatedNumber value={Number(vendor.currentBalance)} format={{ style: 'currency', currency: 'INR', trailingZeroDisplay: 'stripIfInteger' }} />
                    </span>
                </div>

                <VendorAnalytics
                    spendingTrend={analytics.spendingTrend}
                    categoryStats={analytics.categoryStats}
                />

                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right text-green-600">Received (Credit)</TableHead>
                                <TableHead className="text-right text-red-600">Spent (Debit)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">
                                        No transactions found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.map((tx) => {
                                    const isCredit = tx.intent === "CREDIT";
                                    const isDebit = tx.intent === "DEBIT";

                                    return (
                                        <TableRow key={tx.id}>
                                            <TableCell className="whitespace-nowrap">
                                                {new Date(tx.date).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">{tx.description || "-"}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{tx.category}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-green-600 whitespace-nowrap">
                                                {isCredit ? formatCurrency(Number(tx.amount)) : "-"}
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-red-600 whitespace-nowrap">
                                                {isDebit ? formatCurrency(Number(tx.amount)) : "-"}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </ContentLayout>
    );
}
