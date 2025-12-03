import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <ContentLayout title="Vendors">
            <div className="space-y-6">
                {/* Stats Cards Skeleton */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    <Skeleton className="h-4 w-24" />
                                </CardTitle>
                                <Skeleton className="h-4 w-4 rounded-full" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    <Skeleton className="h-8 w-16 mb-1" />
                                </div>
                                <Skeleton className="h-3 w-32" />
                            </CardContent>
                        </Card>
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
