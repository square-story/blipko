import { ContentLayout } from "@/components/admin-panel/content-layout";
import { getCategories } from "@/lib/actions/categories";
import { getIncomeCategories } from "@/lib/actions/income";
import { ImportWizard } from "./_components/import-wizard";

export default async function Page() {
  const [categories, incomeCategories] = await Promise.all([
    getCategories(),
    getIncomeCategories(),
  ]);
  return (
    <ContentLayout title="Import">
      <ImportWizard
        categories={categories}
        incomeCategories={incomeCategories}
      />
    </ContentLayout>
  );
}
