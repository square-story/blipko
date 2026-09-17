import AdminPanelLayout from "@/components/admin-panel/admin-panel-layout";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

// Applies privacy mode before first paint so amounts never flash visible.
// Scoped to the dashboard: the root layout also serves marketing, which has no
// money on it. Keyed to the `privacy-settings` zustand persist blob.
const PRIVACY_PREPAINT = `try{if(JSON.parse(localStorage.getItem("privacy-settings")).state.on)document.documentElement.dataset.privacy="on"}catch(e){}`;

export default async function Layout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await auth();

    if (!session?.user) {
        redirect("/api/auth/signin?callbackUrl=/dashboard");
    }

    return (
        <>
            <script dangerouslySetInnerHTML={{ __html: PRIVACY_PREPAINT }} />
            <AdminPanelLayout user={session.user}>{children}</AdminPanelLayout>
        </>
    );
}
