import { ContentLayout } from "@/components/admin-panel/content-layout";
import { TransactionTable } from "./transaction-table";
import { getTransactions } from "@/lib/actions/transactions";

interface PageProps {
    searchParams: Promise<{
        page?: string;
        search?: string;
        sort?: string;
    }>;
}

export default async function Page({ searchParams }: PageProps) {
    const params = await searchParams;
    const page = Number(params.page) || 1;
    const search = params.search || "";
    const sort = params.sort || "date.desc";

    const { data, total, pageCount } = await getTransactions({
        page,
        search,
        sort,
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
