// Nested under /dashboard/categories so the sidebar's startsWith match keeps
// "Categories" active. This shadows the sibling [id] segment — static wins over
// dynamic, and category ids are cuids, so "income" can never collide.
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { CategoriesTabs } from "@/components/categories-tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getIncomeCategoryTotals } from "@/lib/actions/income";
import { formatMoney } from "@/lib/budget";

type Item = { name: string; total: number };

function Group({
  title,
  hint,
  total,
  items,
  money,
}: {
  title: string;
  hint: string;
  total: number;
  items: Item[];
  money: (n: number) => string;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">{title}</h2>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
          <span className="text-sm font-medium tabular-nums">
            {money(total)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Badge
              key={item.name}
              variant="outline"
              className="gap-1.5 font-normal"
            >
              {item.name}
              {item.total > 0 && (
                <span className="text-muted-foreground tabular-nums">
                  {money(item.total)}
                </span>
              )}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Biggest first, so the cycle reads at a glance; ties fall back to name.
const byTotalThenName = (a: Item, b: Item) =>
  b.total - a.total || a.name.localeCompare(b.name);

export default async function Page() {
  const { categories, uncategorised, currency, locale } =
    await getIncomeCategoryTotals();
  const money = (n: number) => formatMoney(n, currency, locale);

  const earning: Item[] = categories
    .filter((c) => c.countsAsEarnings)
    .map((c) => ({ name: c.name, total: c.total }));
  // Uncategorised income counts as earnings — that is what the budget basis
  // encodes — so it belongs in this group, not hidden.
  if (uncategorised > 0) {
    earning.push({ name: "Uncategorised", total: uncategorised });
  }
  earning.sort(byTotalThenName);

  const other: Item[] = categories
    .filter((c) => !c.countsAsEarnings)
    .map((c) => ({ name: c.name, total: c.total }))
    .sort(byTotalThenName);

  const sum = (items: Item[]) => items.reduce((n, i) => n + i.total, 0);

  return (
    <ContentLayout title="Categories">
      <div className="space-y-4">
        <CategoriesTabs />
        <p className="text-sm text-muted-foreground">
          Where your income lands this cycle. Only earnings raise your budget —
          money coming back is still recorded, but it has already been counted
          once as the expense it offsets.
        </p>

        <Group
          title="Counts as income"
          hint="Raises your budget"
          total={sum(earning)}
          items={earning}
          money={money}
        />
        <Group
          title="Doesn't raise your budget"
          hint="Money coming back to you"
          total={sum(other)}
          items={other}
          money={money}
        />

        <p className="text-xs text-muted-foreground">
          These are fixed. To change what an income is filed under, edit the row
          in Transactions → Income.
        </p>
      </div>
    </ContentLayout>
  );
}
