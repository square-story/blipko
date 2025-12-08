import { AnimatedNumber } from "@/components/animated-number";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import {
    Stat,
    StatDescription,
    StatIndicator,
    StatLabel,
    StatTrend,
    StatValue,
} from "@/components/ui/stat";
import {
    Activity,
    ArrowUp,
    CreditCard,
    MoreHorizontal,
    UserPlus,
    Users,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VendorTable } from "./vendor-table";
import { getContacts, getContactStats } from "@/lib/api/vendors";

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await searchParams;
    const page = Number(params.page) || 1;
    const pageSize = Number(params.perPage) || 10;
    const search = (params.search as string) || "";
    const sort = params.sort as string;

    const status = (params.status as string) || "";
    const category = (params.category as string) || "";

    const { data, pageCount, total } = await getContacts({
        page,
        pageSize,
        search,
        sort,
        status,
        category,
    });

    const stats = await getContactStats();

    return (
        <ContentLayout title="Vendors">
            <div className="space-y-6">
                {/* Stats Cards */}
                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Stat>
                        <StatLabel>Total Vendors</StatLabel>
                        <StatValue>
                            <AnimatedNumber value={stats.totalVendors} />
                        </StatValue>
                        <StatIndicator variant="icon" color="default">
                            <Users />
                        </StatIndicator>
                        <StatTrend trend="neutral" className="text-muted-foreground">
                            Total registered vendors
                        </StatTrend>
                    </Stat>
                    <Stat>
                        <StatLabel>Active Vendors</StatLabel>
                        <StatValue>
                            <AnimatedNumber value={stats.activeVendors} />
                        </StatValue>
                        <StatIndicator variant="icon" color="success">
                            <Activity />
                        </StatIndicator>
                        <StatTrend trend="up">
                            <ArrowUp />
                            Currently active
                        </StatTrend>
                    </Stat>
                    <Stat>
                        <StatLabel>Total Spend</StatLabel>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <StatIndicator variant="action">
                                    <MoreHorizontal />
                                </StatIndicator>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem>View Report</DropdownMenuItem>
                                <DropdownMenuItem>Export CSV</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <StatValue>
                            <AnimatedNumber
                                value={stats.totalSpend}
                                format={{ style: "currency", currency: "INR" }}
                            />
                        </StatValue>
                        <StatTrend trend="neutral" className="text-muted-foreground">
                            Lifetime spend
                        </StatTrend>
                    </Stat>
                    <Stat>
                        <StatLabel>New Vendors</StatLabel>
                        <StatValue>
                            +<AnimatedNumber value={stats.newVendors} />
                        </StatValue>
                        <StatIndicator variant="icon" color="warning">
                            <UserPlus />
                        </StatIndicator>
                        <StatTrend trend="up">
                            <ArrowUp />
                            Last 30 days
                        </StatTrend>
                    </Stat>
                </div>

                <VendorTable data={data} pageCount={pageCount} total={total} />
            </div>
        </ContentLayout>
    );
}
