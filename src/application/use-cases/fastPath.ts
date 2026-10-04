import { parseBareAmount } from "./carryFlow";
import { phraseMemoryKey } from "./memoryKey";

// The shape a repeat spend actually arrives in: a phrase and a number and
// nothing else — "chai 30", "30 auto", "petrol ₹1,200". Recognising it lets a
// category the user already corrected answer the message with no model call,
// which is the whole point: a parse of "chai 30" costs ~2k input tokens and a
// round-trip to reproduce a row that is already in CategoryMemory.
//
// The key is built with phraseMemoryKey — the same function
// rememberCategoryChoice writes with — so a lookup here and a correction there
// can never drift apart. Anything this returns null for is parsed normally.

// ponytail: 4 words. Enough for "swiggy biryani 300", short enough to keep
// questions like "how much did i spend on chai 30" out. Raise it if real
// messages turn out longer.
const MAX_TOKENS = 4;

// "rs. 1200" and "₹ 500" are one amount typed with a space. Re-attaching the
// marker keeps it a single token, so it reads as an amount instead of leaving a
// stray "rs" in the phrase — which would key the lookup "auto rs" and miss the
// "auto" the user actually taught us.
const SPACED_CURRENCY = /(₹|rs\.?)\s+(?=[\d,])/gi;

export interface PhraseAmount {
  phraseKey: string;
  phrase: string;
  amount: number;
}

export function parsePhraseAmount(text: string): PhraseAmount | null {
  const tokens = (text ?? "")
    .replace(SPACED_CURRENCY, "$1")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length < 2 || tokens.length > MAX_TOKENS) return null;

  let amount: number | null = null;
  const words: string[] = [];
  for (const token of tokens) {
    const value = parseBareAmount(token);
    if (value === null) {
      words.push(token);
      continue;
    }
    // A second number means this is not one simple spend — "chai 30, auto 80"
    // is a batch, and collapsing it here would silently drop a transaction.
    if (amount !== null) return null;
    amount = value;
  }
  if (amount === null || words.length === 0) return null;

  const phrase = words.join(" ");
  const phraseKey = phraseMemoryKey(phrase);
  if (!phraseKey) return null;

  return { phraseKey, phrase, amount };
}
