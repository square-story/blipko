import { categoryMatchKey } from "./categoryName";

// The category list the AI reads, for both the parser prompt and the assistant's
// tool schema. Two rules, and both exist because of bugs we hit:
//
// Leaves only. Groups are containers an expense can never attach to, so offering
// "Essentials" or "Savings" to the model just invites a spend that lands
// uncategorized — a hole in the data nobody notices.
//
// One entry per match key. findAllForUser returns the shared system template AND
// the user's own clones, so without this most names appear twice; the model then
// sees "Rent" listed twice and its enum carries duplicates. The user's own row
// wins so per-user budgets and renames are what the model quotes back.
export function uniqueLeafCategories<
  T extends { name: string; isGroup: boolean; userId: string | null },
>(all: T[], userId: string): T[] {
  const byKey = new Map<string, T>();
  for (const c of all) {
    if (c.isGroup) continue;
    const key = categoryMatchKey(c.name);
    const existing = byKey.get(key);
    if (!existing || (existing.userId === null && c.userId === userId)) {
      byKey.set(key, c);
    }
  }
  return [...byKey.values()];
}
