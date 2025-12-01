import AdminPanelLayout from "@/components/admin-panel/admin-panel-layout";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Layout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await auth();

    if (!session?.user) {
        redirect("/api/auth/signin?callbackUrl=/dashboard");
    }

    return <AdminPanelLayout user={session.user}>{children}</AdminPanelLayout>;
}
