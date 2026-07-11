import { describe, it, expect, vi, beforeEach } from "vitest";
import { BoxProcessor } from "./BoxProcessor";

const user = { id: "u1", telegramId: "123" };

describe("BoxProcessor", () => {
  let boxRepository: any;
  let messageService: any;
  let processor: BoxProcessor;

  const box = {
    id: "b1",
    name: "New York",
    icon: null,
    targetAmount: 200000,
    targetReachedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    boxRepository = {
      findByNameForUser: vi.fn().mockResolvedValue(box),
      addEntry: vi.fn().mockResolvedValue({ id: "be1" }),
      balanceFor: vi.fn().mockResolvedValue(5000),
      markTargetReached: vi.fn().mockResolvedValue(false),
    };
    messageService = { sendMessage: vi.fn().mockResolvedValue("m1") };
    processor = new BoxProcessor(boxRepository, messageService);
  });

  it("handles the BOX intent only", () => {
    expect(
      processor.canHandle({
        parsed: { intent: "BOX", confidence: 0.9 },
      } as any),
    ).toBe(true);
    expect(
      processor.canHandle({
        parsed: { intent: "EXPENSE", confidence: 0.9 },
      } as any),
    ).toBe(false);
  });

  it("adds money to a named box and reports progress", async () => {
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "add 5000 to New York",
      parsed: {
        intent: "BOX",
        amount: 5000,
        boxName: "New York",
        boxDirection: "IN",
        confidence: 0.9,
      },
    } as any);

    expect(boxRepository.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        boxId: "b1",
        amount: 5000,
        direction: "IN",
        source: "MANUAL",
      }),
    );
    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("₹5,000 → New York");
    expect(body).toContain("to go");
  });

  it("withdraws when direction is OUT", async () => {
    boxRepository.balanceFor.mockResolvedValue(3000);
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "take 2000 from New York",
      parsed: {
        intent: "BOX",
        amount: 2000,
        boxName: "New York",
        boxDirection: "OUT",
        confidence: 0.9,
      },
    } as any);
    expect(boxRepository.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({ direction: "OUT" }),
    );
  });

  it("celebrates once when the contribution reaches the target", async () => {
    boxRepository.balanceFor.mockResolvedValue(200000);
    boxRepository.markTargetReached.mockResolvedValue(true);
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "add 195000 to New York",
      parsed: {
        intent: "BOX",
        amount: 195000,
        boxName: "New York",
        boxDirection: "IN",
        confidence: 0.9,
      },
    } as any);
    expect(boxRepository.markTargetReached).toHaveBeenCalledWith("b1");
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "Goal reached",
    );
  });

  it("replies helpfully when the box does not exist", async () => {
    boxRepository.findByNameForUser.mockResolvedValue(null);
    await processor.process({
      user,
      platformUserId: "123",
      textMessage: "add 5000 to Mars",
      parsed: {
        intent: "BOX",
        amount: 5000,
        boxName: "Mars",
        boxDirection: "IN",
        confidence: 0.9,
      },
    } as any);
    expect(boxRepository.addEntry).not.toHaveBeenCalled();
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "couldn't find a box",
    );
  });
});
