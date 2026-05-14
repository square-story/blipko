import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <ContentLayout title="Family">
      <div className="space-y-3 p-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </ContentLayout>
  );
}
