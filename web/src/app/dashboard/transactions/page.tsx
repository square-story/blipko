import { ContentLayout } from "@/components/admin-panel/content-layout";
import { ComingSoon } from "@/components/coming-soon";

export default function Page() {
    return (
        <ContentLayout title="Transactions">
            <ComingSoon />
        </ContentLayout>
    );
}
