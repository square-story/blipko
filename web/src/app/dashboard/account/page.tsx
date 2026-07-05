import { ContentLayout } from "@/components/admin-panel/content-layout";
import { TelegramCard } from "@/components/telegram-card";
import { getBudgetSettings } from "@/lib/actions/budget";
import { AccountSettings, AppearanceCard } from "./account-settings";

export default async function Page() {
    const settings = await getBudgetSettings();

    return (
        <ContentLayout title="Account">
            <div className="mx-auto max-w-3xl space-y-6">
                <div className="space-y-1">
                    <h2 className="text-lg font-semibold tracking-tight">
                        Settings
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Manage your budget, appearance, and Telegram connection.
                    </p>
                </div>
                <AccountSettings initial={settings} />
                <AppearanceCard />
                <TelegramCard />
            </div>
        </ContentLayout>
    );
}
