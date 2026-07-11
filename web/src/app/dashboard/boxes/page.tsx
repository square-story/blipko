"use client";

import { useEffect, useState } from "react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { PiggyBank } from "lucide-react";
import { getBoxes, type BoxView } from "@/lib/actions/boxes";
import { getCategories, type CategoryStat } from "@/lib/actions/categories";
import { toast } from "@/lib/toast";
import { BoxCard } from "./_components/box-card";
import { BoxFormModal } from "./_components/box-form-modal";

export default function BoxesPage() {
  const [boxes, setBoxes] = useState<BoxView[]>([]);
  const [archivedBoxes, setArchivedBoxes] = useState<BoxView[]>([]);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [fetchedBoxes, fetchedArchived, fetchedCats] = await Promise.all([
        getBoxes(),
        getBoxes(true),
        getCategories(),
      ]);
      setBoxes(fetchedBoxes);
      setArchivedBoxes(fetchedArchived);
      setCategories(fetchedCats);
    } catch {
      toast.error("Failed to load boxes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ContentLayout title="Boxes">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pt-4 sm:pt-0 px-4 sm:px-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Boxes</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Savings goals & shared funds — isolated pots that never reset and
            stay out of your monthly budget.
          </p>
        </div>
        {!loading && <BoxFormModal categories={categories} onSaved={load} />}
      </div>

      <div className="px-4 sm:px-0">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : boxes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/20 rounded-lg border border-dashed">
            <PiggyBank className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground max-w-[260px]">
              No boxes yet. Create a savings goal like &quot;Trip to New
              York&quot; or a fund like &quot;House maintenance&quot;.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {boxes.map((box) => (
              <BoxCard
                key={box.id}
                box={box}
                categories={categories}
                onChanged={load}
              />
            ))}
          </div>
        )}

        {!loading && archivedBoxes.length > 0 && (
          <div className="mt-10">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              Archived ({archivedBoxes.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {archivedBoxes.map((box) => (
                <BoxCard
                  key={box.id}
                  box={box}
                  categories={categories}
                  onChanged={load}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </ContentLayout>
  );
}
