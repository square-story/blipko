import { ContentLayout } from "@/components/admin-panel/content-layout";
import { TransactionsTabs } from "@/components/transactions-tabs";
import { ExpenseTable } from "./expense-table";
import { getExpenses } from "@/lib/actions/expenses";
import { getCategories } from "@/lib/actions/categories";

interface PageProps {
    searchParams: Promise<{
        page?: string;
        perPage?: string;
        search?: string;
        sort?: string;
        bucket?: string;
        categoryId?: string;
        from?: string;
        to?: string;
    }>;
}

export default async function Page({ searchParams }: PageProps) {
    const params = await searchParams;
    const page = Number(params.page) || 1;
    const limit = Number(params.perPage) || 10;
    const search = params.search || "";
    const sort = params.sort || "date.desc";
    const bucket = params.bucket || "";
    const categoryId = params.categoryId || "";
    const from = params.from || "";
    const to = params.to || "";

    const [{ data, total, pageCount }, categories] = await Promise.all([
        getExpenses({ page, limit, search, sort, bucket, categoryId, from, to }),
        getCategories(),
    ]);

    const categoryOptions = categories.map((c) => ({
        label: c.name,
        value: c.id,
    }));

    return (
        <ContentLayout title="Transactions">
            <div className="space-y-4">
                <TransactionsTabs />
                <ExpenseTable
                    data={data}
                    pageCount={pageCount}
                    total={total}
                    categoryOptions={categoryOptions}
                    categories={categories}
                />
            </div>
        </ContentLayout>
    );
}
