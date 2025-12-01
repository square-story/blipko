import { ContentLayout } from "@/components/admin-panel/content-layout";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Page() {
    const session = await auth();

    if (!session?.user) {
        redirect("/api/auth/signin");
    }

    return (
        <ContentLayout title="Dashboard">
            <div>Welcome to your dashboard</div>
        </ContentLayout>
    );
}
