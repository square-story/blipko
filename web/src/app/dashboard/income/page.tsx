import { ContentLayout } from "@/components/admin-panel/content-layout";
import { TransactionsTabs } from "@/components/transactions-tabs";
import { IncomeTable } from "./income-table";
import { getIncome } from "@/lib/actions/income";
import { getCategories } from "@/lib/actions/categories";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    perPage?: string;
    search?: string;
    sort?: string;
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
  const from = params.from || "";
  const to = params.to || "";

  const [{ data, total, pageCount }, categories] = await Promise.all([
    getIncome({
      page,
      limit,
      search,
      sort,
      from,
      to,
    }),
    getCategories(),
  ]);

  return (
    <ContentLayout title="Transactions">
      <div className="space-y-4">
        <TransactionsTabs />
        <IncomeTable
          data={data}
          pageCount={pageCount}
          total={total}
          categories={categories}
        />
      </div>
    </ContentLayout>
  );
}
