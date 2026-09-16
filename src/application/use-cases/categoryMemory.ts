import { ICategoryMemoryRepository } from "../../domain/repositories/ICategoryMemoryRepository";
import { ParsedData } from "../../domain/entities/ParsedData";
import { phraseMemoryKey } from "./memoryKey";

// Record what a correction taught us, so the next message with the same phrase
// is filed the way the user said instead of re-guessed.
//
// Keyed on the expense's `note`, never `rawText`: BatchProcessor stores the
// WHOLE message as rawText on every item, so "chai 30, auto 80" would give both
// expenses the key "chai auto". A rawText fallback does not degrade here, it
// poisons the table — so a missing note means we learn nothing.
//
// Returns the phrase that was learned so the caller can tell the user, or null
// when there was nothing usable to learn.
export async function rememberCategoryChoice(
  repository: ICategoryMemoryRepository | null,
  userId: string,
  note: string | null | undefined,
  categoryId: string | null | undefined,
): Promise<string | null> {
  if (!repository || !categoryId) return null;
  const phrase = note?.trim();
  const key = phraseMemoryKey(phrase);
  if (!key || !phrase) return null;

  await repository.remember(userId, key, phrase, categoryId);
  return phrase;
}

// Shown once when a correction is learned, so the mapping is visible rather
// than silently sticky — re-correcting the same phrase overwrites it.
export function rememberedLine(phrase: string, categoryLabel: string): string {
  return `   · I'll remember "${phrase}" → ${categoryLabel}`;
}

// Apply what the user taught us, in place, before anything branches on the
// parsed batch. Mutating is deliberate: the single-transaction path aliases
// transactions[0], so one pass reaches both it and the batch path.
//
// EXPENSE only. INCOME has its own taxonomy and falls back to "Other Income"
// (countsAsEarnings: true), so leaking an expense phrase there would turn a
// refund into earnings and widen the user's budget. RECURRING is skipped
// because a mis-mapped rule auto-posts a wrong expense every month — twelve
// times the blast radius of a single spend.
export async function applyCategoryMemory(
  repository: ICategoryMemoryRepository | null,
  userId: string,
  transactions: ParsedData[],
): Promise<void> {
  if (!repository) return;

  for (const txn of transactions) {
    if (txn.intent !== "EXPENSE") continue;
    // note, never rawText: on a batch every item carries the whole message.
    const key = phraseMemoryKey(txn.note);
    if (!key) continue;

    const hit = await repository.findForPhrase(userId, key);
    // A miss also covers the refusals the repository makes on our behalf —
    // group rows and box-linked categories. See ICategoryMemoryRepository.
    if (!hit) continue;

    txn.category = hit.categoryName;
    // The category owns the bucket everywhere else in the codebase; setting it
    // keeps the pair consistent and clears the !bucket half of the confirmation
    // gate. confidence is deliberately untouched — it also encodes amount
    // ambiguity, which a remembered category says nothing about.
    txn.bucket = hit.bucket;
  }
}
