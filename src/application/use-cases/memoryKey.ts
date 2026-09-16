// The lookup key for what a user taught us by correcting a category: the phrase
// they typed, normalized so "chai 30", "Chai 30" and "chai  30" are one key.
//
// Deliberately NOT categoryMatchKey (categoryName.ts). That one strips
// [^a-z0-9], which deletes every non-Latin character — "പെട്രോൾ 500" and
// "चाय 30" would both reduce to "", and under @@unique([userId, phraseKey])
// every native-script message would collapse onto a single row and overwrite
// each other's category. This bot's whole premise is code-mixed Malayalam,
// Manglish and Hindi input, so the key has to be Unicode-aware.
//
// Amount tokens are dropped because the phrase is the stable part: "chai 30"
// and "chai 45" are the same lesson.

const MAX_KEY_CHARS = 60;

// Returns null for anything unusable — no usable phrase, or nothing but digits
// once the amount is stripped. Null means "do not learn, do not look up", and
// callers MUST honour it on both sides: a blank key would otherwise become a
// single bucket that every unparseable message falls into.
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
