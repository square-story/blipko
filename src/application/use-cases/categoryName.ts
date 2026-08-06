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
