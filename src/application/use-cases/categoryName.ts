// Category names coming off the AI parser are unvalidated free text — the model
// can return whitespace, or a whole sentence, and it lands straight in the DB.
// The web path already constrains this (nameSchema in
// web/src/lib/actions/categories.ts); this is the same rule for the bot path.
//
// One deliberate difference: the length check runs AFTER trimming. Zod's
// `.trim()` is a transform that runs after `.max(50)`, so the web path measures
// the untrimmed string.
//
// Returning undefined means "no usable category" — resolveExpenseCategory
// already treats a missing name that way, so the expense still lands in the
// right bucket, just uncategorized.

const MAX_NAME_CHARS = 50;

export function normalizeCategoryName(raw?: string): string | undefined {
  if (!raw) return undefined;
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name || name.length > MAX_NAME_CHARS) return undefined;
  return name;
}

// Lookup key only — never stored, never shown to the user. Collapses the ways a
// model spells the same category: case, punctuation, "&"/"and", simple plurals.
// So "Eating-Out", "eating out" and "Eating  Out" all reuse one row instead of
// minting three.
//
// The -ies branch matters: without it Groceries/Utilities/Hobbies (three of the
// 28 template leaves) key to grocerie/utilitie/hobbie and still miss
// Grocery/Utility/Hobby. The ss/us guards keep Fitness and Miscellaneous intact
// rather than mangling them to fitnes/miscellaneou.
//
// ponytail: exact key equality, no edit distance. Add trigram/Levenshtein only
// if logs show real misses this cannot catch.
export function categoryMatchKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((w) => {
      if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
      if (
        w.length > 3 &&
        w.endsWith("s") &&
        !w.endsWith("ss") &&
        !w.endsWith("us")
      ) {
        return w.slice(0, -1);
      }
      return w;
    })
    .join(" ");
}
