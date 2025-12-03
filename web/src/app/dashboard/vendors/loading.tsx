import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <ContentLayout title="Vendors">
            <div className="space-y-6">
                {/* Stats Cards Skeleton */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div
                            key={i}
                            className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg border bg-card p-4 shadow-sm"
                        >
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="row-span-2 row-start-1 h-8 w-8 rounded-md" />
                            <Skeleton className="h-8 w-16" />
                            <Skeleton className="col-span-2 h-4 w-32 mt-1" />
                        </div>
                    ))}
                </div>

                {/* Table Skeleton */}
                <div className="rounded-md border">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <Skeleton className="h-10 w-64" /> {/* Search */}
                            <Skeleton className="h-10 w-24" /> {/* Filter/Action */}
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center space-x-4">
                                <Skeleton className="h-4 w-4" />
                                <Skeleton className="h-4 w-full" />
                            </div>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center space-x-4">
                                    <Skeleton className="h-12 w-full" />
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-end space-x-2 py-4">
                            <Skeleton className="h-8 w-24" />
                            <Skeleton className="h-8 w-24" />
                        </div>
                    </div>
                </div>
            </div>
        </ContentLayout>
    );
}
