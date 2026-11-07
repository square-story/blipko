import { describe, expect, it, vi } from "vitest";
import { mergeTelegramUser } from "./mergeTelegramUser";

// A model mock whose every method resolves harmlessly.
const model = (overrides: Record<string, unknown> = {}) => ({
  updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  findMany: vi.fn().mockResolvedValue([]),
  findFirst: vi.fn().mockResolvedValue(null),
  findUnique: vi.fn().mockResolvedValue(null),
  update: vi.fn().mockResolvedValue({}),
  delete: vi.fn().mockResolvedValue({}),
  ...overrides,
});

describe("mergeTelegramUser clarity scores", () => {
  // Without this the bot user's ratings cascade away when it is deleted. The
  // web user wins a cycle both rated — (userId, cycleKey) is unique.
  it("moves the bot user's scores, dropping cycles the web user already rated", async () => {
    const tx: any = {
      expense: model(),
      income: model(),
      recurringRule: model(),
      parseLog: model(),
      conversationMessage: model(),
      budgetNudge: model(),
      category: model(),
      budgetConfig: model(),
      user: model(),
      clarityScore: model({
        findMany: vi.fn().mockResolvedValue([{ cycleKey: "2026-05-01" }]),
      }),
    };

    await mergeTelegramUser(tx, "bot", "web", "tg1");

    expect(tx.clarityScore.findMany).toHaveBeenCalledWith({
      where: { userId: "web" },
      select: { cycleKey: true },
    });
    expect(tx.clarityScore.deleteMany).toHaveBeenCalledWith({
      where: { userId: "bot", cycleKey: { in: ["2026-05-01"] } },
    });
    expect(tx.clarityScore.updateMany).toHaveBeenCalledWith({
      where: { userId: "bot" },
      data: { userId: "web" },
    });
    expect(tx.clarityScore.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.user.delete.mock.invocationCallOrder[0],
    );
  });
});
