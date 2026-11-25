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

describe("mergeTelegramUser balance anchor", () => {
  const tx = (botUser: unknown): any => ({
    expense: model(),
    income: model(),
    recurringRule: model(),
    parseLog: model(),
    conversationMessage: model(),
    budgetNudge: model(),
    category: model(),
    budgetConfig: model(),
    clarityScore: model(),
    user: model({ findUnique: vi.fn().mockResolvedValue(botUser) }),
  });

  // The anchor is the bot user's last stated balance; dropping it would make
  // the next "balance 9000" a silent first anchor instead of a check.
  it("carries the bot user's balance anchor to the web user", async () => {
    const at = new Date("2026-11-10T06:30:00Z");
    const t = tx({ balanceAnchor: "12400.00", balanceAnchorAt: at });
    await mergeTelegramUser(t, "bot", "web", "tg1");
    const profile = t.user.update.mock.calls.find(
      (c: any) => c[0].where.id === "web" && "payday" in c[0].data,
    );
    expect(profile[0].data).toMatchObject({
      balanceAnchor: "12400.00",
      balanceAnchorAt: at,
    });
  });
});
