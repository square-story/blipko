import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCardLoading } from "@/components/analytics/chart-skeleton";

export default function Loading() {
  return (
    <ContentLayout
      title="Box"
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Boxes", href: "/dashboard/boxes" },
        { label: "…" },
      ]}
    >
      <div className="flex flex-col gap-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        {/* Matches the contributions card this stands in for. */}
        <ChartCardLoading
          title="Contributions"
          description="Money added and taken out, per budget cycle"
          variant="bars"
          message="Loading this box's activity…"
        />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </ContentLayout>
  );
}
