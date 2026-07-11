import { describe, it, expect, vi, beforeEach } from "vitest";
import { SendBoxTargetAlertsUseCase } from "./SendBoxTargetAlerts";

const user = { id: "u1", telegramId: "123" };
const reachedBox = {
  id: "b1",
  name: "New York",
  icon: null,
  targetAmount: 200000,
  balance: 205000,
};

describe("SendBoxTargetAlerts", () => {
  let userRepository: any;
  let boxRepository: any;
  let messageService: any;
  let useCase: SendBoxTargetAlertsUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    userRepository = {
      findOnboardedWithTelegram: vi.fn().mockResolvedValue([user]),
    };
    boxRepository = {
      goalBoxesPendingAlert: vi.fn().mockResolvedValue([reachedBox]),
      markTargetReached: vi.fn().mockResolvedValue(true),
    };
    messageService = { sendMessage: vi.fn().mockResolvedValue("m1") };
    useCase = new SendBoxTargetAlertsUseCase(
      userRepository,
      boxRepository,
      messageService,
    );
  });

  it("sends one alert when a box reaches its target", async () => {
    const { sent } = await useCase.execute();
    expect(sent).toBe(1);
    expect(boxRepository.markTargetReached).toHaveBeenCalledWith("b1");
    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("Goal reached");
    expect(body).toContain("New York");
  });

  it("does not send when the stamp was already taken (idempotent)", async () => {
    boxRepository.markTargetReached.mockResolvedValue(false);
    const { sent } = await useCase.execute();
    expect(sent).toBe(0);
    expect(messageService.sendMessage).not.toHaveBeenCalled();
  });

  it("does nothing when no box has reached its target", async () => {
    boxRepository.goalBoxesPendingAlert.mockResolvedValue([]);
    const { sent } = await useCase.execute();
    expect(sent).toBe(0);
    expect(messageService.sendMessage).not.toHaveBeenCalled();
  });
});
