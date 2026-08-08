import { notFound } from "next/navigation";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import {
  getBox,
  getBoxEntries,
  getBoxContributionTrend,
} from "@/lib/actions/boxes";
import { BoxDetailHeader } from "./_components/box-detail-header";
import { ChartCard } from "@/components/analytics/chart-card";
import { InOutBarChart } from "@/components/analytics/charts/in-out-bar-chart";
import { getBudgetSettings } from "@/lib/actions/budget";
import { BoxEntriesTable } from "./_components/box-entries-table";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string;
    perPage?: string;
    search?: string;
    sort?: string;
    direction?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function BoxDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const box = await getBox(id);
  if (!box) notFound();

  const [entries, trend, settings] = await Promise.all([
    getBoxEntries({
      boxId: id,
      page: Number(sp.page) || 1,
      limit: Number(sp.perPage) || 10,
      search: sp.search || "",
      sort: sp.sort || "date.desc",
      direction: sp.direction || undefined,
      from: sp.from || undefined,
      to: sp.to || undefined,
    }),
    getBoxContributionTrend(id),
    getBudgetSettings(),
  ]);

  return (
    <ContentLayout
      title={box.name}
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Boxes", href: "/dashboard/boxes" },
        { label: box.name },
      ]}
    >
      <div className="flex flex-col gap-6">
        <BoxDetailHeader box={box} />
        <ChartCard
          title="Contributions"
          description="Money added and taken out, per budget cycle"
          isEmpty={!trend.some((t) => t.in > 0 || t.out > 0)}
          emptyLabel="No contributions recorded yet for this box."
        >
          <InOutBarChart
            data={trend}
            inLabel="Added"
            outLabel="Taken out"
            currency={settings.currency}
            locale={settings.locale}
          />
        </ChartCard>
        <BoxEntriesTable
          boxId={id}
          data={entries.data}
          pageCount={entries.pageCount}
        />
      </div>
    </ContentLayout>
  );
}
