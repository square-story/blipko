import { ContentLayout } from "@/components/admin-panel/content-layout";
import { TelegramCard } from "@/components/telegram-card";
import { getBudgetSettings } from "@/lib/actions/budget";
import {
    AppearanceCard,
    BudgetSettingsCard,
} from "./account-settings";

export default async function Page() {
    const settings = await getBudgetSettings();

    return (
        <ContentLayout title="Account">
            <div className="space-y-6">
                <BudgetSettingsCard initial={settings} />
                <AppearanceCard />
                <TelegramCard />
            </div>
        </ContentLayout>
    );
}
