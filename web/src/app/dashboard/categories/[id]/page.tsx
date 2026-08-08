import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { ExpenseTable } from "@/app/dashboard/expenses/expense-table";
import { getExpenses } from "@/lib/actions/expenses";
import {
  getCategories,
  getCategoryDetail,
  getCategorySpendTrend,
} from "@/lib/actions/categories";
import { cn } from "@/lib/utils";
import { CategoryDetailHeader } from "./_components/category-detail-header";
import { CategoryStats } from "./_components/category-stats";
import { CategorySpendChart } from "./_components/category-spend-chart";
import { CategoryTopNotes } from "./_components/category-top-notes";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string;
    perPage?: string;
    search?: string;
    sort?: string;
    from?: string;
    to?: string;
    all?: string;
  }>;
}

export default async function CategoryDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const detail = await getCategoryDetail(id);
  if (!detail) notFound();

  // The table defaults to the current cycle so it agrees with the header ring.
  // `?all=1` is what makes that default escapable — without an explicit marker,
  // clearing the date filter would just re-apply it.
  const showAll = sp.all === "1";
  const scoped = !showAll && !sp.from && !sp.to;
  const end = detail.periodEnd;
  // buildWhere widens `to` to end-of-day, so `to` is the cycle's last day. Built
  // via the Date constructor rather than end - 86400000: subtracting a fixed day
  // lands on 23:00 of the wrong day across a DST shift, which would drop that
  // hour's expenses.
  const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
  const from = scoped ? String(detail.periodStart.getTime()) : sp.from || "";
  const to = scoped ? String(lastDay.getTime()) : sp.to || "";

  const [expenses, trend, categories] = await Promise.all([
    getExpenses({
      categoryId: id,
      page: Number(sp.page) || 1,
      limit: Number(sp.perPage) || 10,
      search: sp.search || "",
      sort: sp.sort || "date.desc",
      from,
      to,
    }),
    getCategorySpendTrend(id),
    // Only needed so the row-edit modal can offer other categories.
    getCategories(),
  ]);

  const tabClass = (active: boolean) =>
    cn(
      "text-xs px-2 py-1 rounded-md transition-colors",
      active
        ? "bg-muted text-foreground font-medium"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <ContentLayout
      title={detail.name}
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Categories", href: "/dashboard/categories" },
        { label: detail.name },
      ]}
    >
      <div className="flex flex-col gap-6">
        <CategoryDetailHeader detail={detail} />
        <CategoryStats detail={detail} />
        <CategorySpendChart
          data={trend}
          bucket={detail.bucket}
          budget={detail.monthlyBudget}
          currency={detail.currency}
          locale={detail.locale}
        />
        <CategoryTopNotes detail={detail} />

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">
              Transactions
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {scoped ? detail.periodLabel : showAll ? "all time" : "filtered"}
              </span>
            </h3>
            <div className="flex items-center gap-1">
              <Link
                href={`/dashboard/categories/${id}`}
                className={tabClass(scoped)}
              >
                This cycle
              </Link>
              <Link
                href={`/dashboard/categories/${id}?all=1`}
                className={tabClass(showAll)}
              >
                All time
              </Link>
            </div>
          </div>

          <ExpenseTable
            data={expenses.data}
            pageCount={expenses.pageCount}
            total={expenses.total}
            totalAmount={expenses.totalAmount}
            categoryOptions={[]}
            categories={categories}
            lockedCategoryId={id}
          />
        </div>
      </div>
    </ContentLayout>
  );
}
