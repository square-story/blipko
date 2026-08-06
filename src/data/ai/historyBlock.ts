import { ConversationTurn } from "../../domain/services/IAiParser";

// Recent turns go into the system prompt as a labelled data block, NOT as real
// user/assistant messages. Two reasons:
//   1. The stored "model" turns are rendered Telegram prose ("✅ Wants · Food
//      ₹220"). Replayed as assistant messages they teach the model to answer in
//      prose, fighting the JSON schema.
//   2. As real turns they were unbounded — a long /report or query answer got
//      replayed in full on every subsequent message.
// Bounded here so context stays useful for resolving references ("make it 50")
// without growing the prompt without limit.

const MAX_TURN_CHARS = 200;
const MAX_BLOCK_CHARS = 1200;

export function renderHistoryBlock(
  history: ConversationTurn[] | undefined,
): string {
  if (!history || history.length === 0) return "";

  const lines = history.map((turn) => {
    const label = turn.role === "model" ? "bot" : "user";
    const content = turn.content.replace(/\s+/g, " ").trim();
    const clipped =
      content.length > MAX_TURN_CHARS
        ? `${content.slice(0, MAX_TURN_CHARS)}…`
        : content;
    return `${label}: ${clipped}`;
  });

  // Over budget → drop the oldest. Recent turns are what resolve references.
  const kept: string[] = [];
  let used = 0;
  for (const line of [...lines].reverse()) {
    if (kept.length > 0 && used + line.length > MAX_BLOCK_CHARS) break;
    kept.unshift(line);
    used += line.length + 1;
  }

  return `\n### RECENT CONVERSATION (context only — never copy this format, always answer with the JSON schema):\n${kept.join("\n")}\n`;
}
