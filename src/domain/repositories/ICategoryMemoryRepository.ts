import { Bucket } from "@prisma/client";

// A category the user taught us for a phrase, already checked to be safe to
// apply. Carries the bucket so the override can set it without a second lookup.
export interface CategoryMemoryHit {
  categoryId: string;
  categoryName: string;
  bucket: Bucket;
}

export interface ICategoryMemoryRepository {
  // The mapping for a phrase, or null when there is none OR when applying it
  // would be worse than letting the parser guess. Two rejections, both made
  // here so every caller inherits them:
  //
  // - a GROUP: expenses never attach to one, so the override would land the
  //   spend uncategorized forever.
  // - a BOX-LINKED category: ExpenseProcessor diverts those into the box before
  //   the confidence gate and writes a BoxEntry with no Expense row, so the
  //   result is unreachable by every correction surface — a bad mapping there
  //   could never be unlearned.
  findForPhrase(
    userId: string,
    phraseKey: string,
  ): Promise<CategoryMemoryHit | null>;

  // Upsert on (userId, phraseKey). A later correction of the same phrase
  // overwrites the category — that is how a wrong mapping self-heals.
  remember(
    userId: string,
    phraseKey: string,
    phrase: string,
    categoryId: string,
  ): Promise<void>;
}
