import { prisma } from "@/lib/prisma";

// Port of the bot's src/application/use-cases/memoryKey.ts. Duplicated, not
// imported: the web app is deployed rooted at web/ and cannot reach the backend
// source tree (same reason web/src/lib/budget.ts ports budgetMath.ts).
//
// Unicode-aware on purpose — a [^a-z0-9] strip would reduce "പെട്രോൾ 500" and
// "चाय 30" both to "", collapsing every native-script phrase onto one row.
const MAX_KEY_CHARS = 60;

export function phraseMemoryKey(raw?: string | null): string | null {
  if (!raw) return null;
  const key = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 0 && !/^\p{N}+$/u.test(w))
    .join(" ");
  if (key.length === 0 || key.length > MAX_KEY_CHARS) return null;
  return key;
}

// Record what a correction taught us so the bot files the next message with
// this phrase the way the user said. Keyed on the expense's note, never its
// rawText — on a batch every item carries the whole original message.
//
// Never throws: a failed lesson must not fail the user's edit.
export async function rememberCategoryChoice(
  userId: string,
  note: string | null | undefined,
  categoryId: string | null | undefined,
): Promise<void> {
  if (!categoryId) return;
  const phrase = note?.trim();
  const key = phraseMemoryKey(phrase);
  if (!key || !phrase) return;

  try {
    await prisma.categoryMemory.upsert({
      where: { userId_phraseKey: { userId, phraseKey: key } },
      update: { categoryId, hits: { increment: 1 }, lastUsedAt: new Date() },
      create: { userId, phraseKey: key, phrase, categoryId },
    });
  } catch {
    // Best-effort. The correction itself has already been saved.
  }
}
