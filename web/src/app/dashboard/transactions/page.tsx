import { ContentLayout } from "@/components/admin-panel/content-layout";
import { TransactionTable } from "./transaction-table";
import { getTransactions } from "@/lib/actions/transactions";

interface PageProps {
    searchParams: Promise<{
        page?: string;
        perPage?: string;
        search?: string;
        sort?: string;
        intent?: string;
        category?: string;
        from?: string;
        to?: string;
    }>;
}

export default async function Page({ searchParams }: PageProps) {
    const params = await searchParams;
    const page = Number(params.page) || 1;
    const limit = Number(params.perPage) || 10;
    const search = (params.search as string) || "";
    const sort = (params.sort as string) || "date.desc";
    const intent = (params.intent as string) || "";
    const category = (params.category as string) || "";
    const from = (params.from as string) || "";
    const to = (params.to as string) || "";

    const { data, total, pageCount } = await getTransactions({
        page,
        limit,
        search,
        sort,
        intent,
        category,
        from,
        to,
    });

    return (
        <ContentLayout title="Transactions">
            <div className="space-y-4">
                <TransactionTable
                    data={data}
                    pageCount={pageCount}
                    total={total}
                />
            </div>
        </ContentLayout>
    );
}
