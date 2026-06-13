import { describe, it, expect, vi, beforeEach } from "vitest";
import { OnboardingProcessor } from "./OnboardingProcessor";

describe("OnboardingProcessor (wizard)", () => {
  let userRepository: any;
  let budgetConfigRepository: any;
  let categoryRepository: any;
  let messageService: any;
  let processor: OnboardingProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    userRepository = { update: vi.fn().mockResolvedValue({}) };
    budgetConfigRepository = {
      findByUserId: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    };
    categoryRepository = { cloneGroupsForUser: vi.fn().mockResolvedValue(12) };
    messageService = {
      sendMessage: vi.fn().mockResolvedValue("m1"),
      sendInteractiveMessage: vi.fn().mockResolvedValue("m2"),
      editInteractiveMessage: vi.fn().mockResolvedValue(undefined),
    };
    processor = new OnboardingProcessor(
      userRepository,
      budgetConfigRepository,
      categoryRepository,
      messageService,
    );
  });

  const ctx = (over: any) => ({
    user: { id: "u1", hasOnboarded: false, monthlyIncome: null, ...over.user },
    platformUserId: "123",
    textMessage: over.textMessage,
    callbackMessageId: over.callbackMessageId,
  });

  it("handles /start, un-onboarded users, and ob: callbacks", () => {
    expect(processor.canHandle(ctx({ textMessage: "/start", user: {} }))).toBe(
      true,
    );
    expect(processor.canHandle(ctx({ textMessage: "ob:done", user: {} }))).toBe(
      true,
    );
    expect(
      processor.canHandle(
        ctx({ textMessage: "anything", user: { hasOnboarded: true } }),
      ),
    ).toBe(false);
  });

  it("captures income, creates the config, and shows the group keyboard", async () => {
    await processor.process(ctx({ textMessage: "50000", user: {} }));

    expect(userRepository.update).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        monthlyIncome: 50000,
        onboardingStep: "PICK_GROUPS",
      }),
    );
    expect(budgetConfigRepository.create).toHaveBeenCalled();
    const rows = messageService.sendInteractiveMessage.mock.calls[0][2];
    expect(rows.flat().some((b: any) => b.id === "ob:done")).toBe(true);
  });

  it("toggles a group selection and edits the keyboard in place", async () => {
    await processor.process(
      ctx({
        textMessage: "ob:grp:food",
        callbackMessageId: "55",
        user: {
          onboardingStep: "PICK_GROUPS",
          onboardingDraft: { income: 50000, groups: ["ess"] },
        },
      }),
    );

    expect(userRepository.update).toHaveBeenCalledWith("u1", {
      onboardingDraft: { income: 50000, groups: ["ess", "food"] },
    });
    expect(messageService.editInteractiveMessage).toHaveBeenCalled();
  });

  it("on Done clones the selected groups and advances to dosage", async () => {
    await processor.process(
      ctx({
        textMessage: "ob:done",
        callbackMessageId: "55",
        user: {
          onboardingStep: "PICK_GROUPS",
          onboardingDraft: { income: 50000, groups: ["ess", "save"] },
        },
      }),
    );

    expect(categoryRepository.cloneGroupsForUser).toHaveBeenCalledWith(
      "u1",
      expect.arrayContaining([
        expect.objectContaining({ name: "Essentials" }),
        expect.objectContaining({ name: "Savings" }),
      ]),
    );
    expect(userRepository.update).toHaveBeenCalledWith("u1", {
      onboardingStep: "PICK_DOSAGE",
    });
    const editRows = messageService.editInteractiveMessage.mock.calls[0][3];
    expect(editRows.flat().some((b: any) => b.id === "ob:dose:GENTLE")).toBe(
      true,
    );
  });

  it("finishes onboarding when a dosage is chosen", async () => {
    await processor.process(
      ctx({
        textMessage: "ob:dose:AGGRESSIVE",
        callbackMessageId: "55",
        user: { onboardingStep: "PICK_DOSAGE" },
      }),
    );

    expect(userRepository.update).toHaveBeenCalledWith("u1", {
      hasOnboarded: true,
      onboardingStep: null,
      onboardingDraft: null,
      notificationDosage: "AGGRESSIVE",
    });
  });
});
