import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProcessIncomingMessageUseCase } from "./ProcessIncomingMessage";

const onboardedUser = {
  id: "u1",
  telegramId: "123",
  name: "Sam",
  hasOnboarded: true,
  monthlyIncome: 50000,
};

const newUser = {
  id: "u1",
  telegramId: "123",
  name: "Sam",
  hasOnboarded: false,
  monthlyIncome: null,
};

describe("ProcessIncomingMessage (budget flow)", () => {
  let useCase: ProcessIncomingMessageUseCase;
  let userRepository: any;
  let expenseRepository: any;
  let categoryRepository: any;
  let budgetConfigRepository: any;
  let parseLogRepository: any;
  let conversationRepository: any;
  let aiParser: any;
  let messageService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    userRepository = {
      findByTelegramId: vi.fn().mockResolvedValue(onboardedUser),
      create: vi.fn().mockResolvedValue(newUser),
      update: vi.fn().mockResolvedValue(onboardedUser),
      linkTelegramByToken: vi.fn().mockResolvedValue(null),
    };
    expenseRepository = {
      create: vi.fn().mockResolvedValue({ id: "e1" }),
      findById: vi.fn(),
      findLastByUserId: vi.fn().mockResolvedValue(null),
      findByConfirmationMessageId: vi.fn().mockResolvedValue(null),
      updateConfirmationMessageId: vi.fn().mockResolvedValue(undefined),
      sumByBucketForMonth: vi.fn().mockResolvedValue(220),
      softDelete: vi.fn().mockResolvedValue(undefined),
    };
    categoryRepository = {
      findAllForUser: vi.fn().mockResolvedValue([]),
      findByNameForUser: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue({ id: "c1", name: "Food", bucket: "WANTS" }),
      create: vi.fn().mockResolvedValue({ id: "c1", name: "Food", bucket: "WANTS" }),
    };
    budgetConfigRepository = {
      create: vi.fn().mockResolvedValue({}),
      findByUserId: vi
        .fn()
        .mockResolvedValue({ needsPct: 50, wantsPct: 30, savingsPct: 20 }),
    };
    parseLogRepository = {
      create: vi.fn().mockResolvedValue({ id: "plog1" }),
      findById: vi.fn().mockResolvedValue(null),
    };
    conversationRepository = {
      getRecent: vi.fn().mockResolvedValue([]),
      append: vi.fn().mockResolvedValue(undefined),
    };
    aiParser = { parseText: vi.fn() };
    messageService = {
      sendMessage: vi.fn().mockResolvedValue("msg-id-123"),
      sendInteractiveMessage: vi.fn().mockResolvedValue("msg-id-456"),
      sendTypingIndicator: vi.fn(),
    };

    useCase = new ProcessIncomingMessageUseCase(
      aiParser,
      userRepository,
      expenseRepository,
      categoryRepository,
      budgetConfigRepository,
      parseLogRepository,
      conversationRepository,
      messageService,
    );
  });

  it("onboards a new user from their income number and shows the 50/30/20 split", async () => {
    userRepository.findByTelegramId.mockResolvedValue(newUser);

    await useCase.execute({ platformUserId: "123", textMessage: "50000" });

    expect(userRepository.update).toHaveBeenCalledWith("u1", {
      monthlyIncome: 50000,
      hasOnboarded: true,
    });
    expect(budgetConfigRepository.create).toHaveBeenCalledWith({ userId: "u1" });
    expect(aiParser.parseText).not.toHaveBeenCalled();
    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("monthly plan");
    expect(body).toContain("25,000"); // Needs
    expect(body).toContain("15,000"); // Wants
    expect(body).toContain("10,000"); // Savings
  });

  it("records a confident expense and shows remaining bucket budget", async () => {
    categoryRepository.findByNameForUser.mockResolvedValue({
      id: "c1",
      name: "Food",
      bucket: "WANTS",
    });
    aiParser.parseText.mockResolvedValue({
      intent: "EXPENSE",
      amount: 220,
      category: "Food",
      bucket: "WANTS",
      note: "lunch",
      confidence: 0.9,
    });

    await useCase.execute({ platformUserId: "123", textMessage: "lunch 220" });

    expect(expenseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        amount: 220,
        bucket: "WANTS",
        categoryId: "c1",
      }),
    );
    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("Wants · Food");
    expect(body).toContain("Wants left this month");
    expect(body).toContain("14,780"); // 15000 - 220
    expect(body).toContain("15,000");
    expect(expenseRepository.updateConfirmationMessageId).toHaveBeenCalledWith(
      "e1",
      "msg-id-123",
    );
  });

  it("asks for a bucket on a low-confidence parse instead of saving", async () => {
    aiParser.parseText.mockResolvedValue({
      intent: "EXPENSE",
      amount: 1500,
      confidence: 0.4,
    });

    await useCase.execute({ platformUserId: "123", textMessage: "paid 1500" });

    expect(parseLogRepository.create).toHaveBeenCalled();
    expect(expenseRepository.create).not.toHaveBeenCalled();
    const [, body, buttons] =
      messageService.sendInteractiveMessage.mock.calls[0];
    expect(body).toContain("which bucket");
    expect(buttons.map((b: any) => b.id)).toEqual([
      "bkt:plog1:NEEDS",
      "bkt:plog1:WANTS",
      "bkt:plog1:SAVINGS",
    ]);
  });

  it("records the expense after the user confirms the bucket via button", async () => {
    parseLogRepository.findById.mockResolvedValue({
      id: "plog1",
      rawText: "paid 1500",
      parsed: { intent: "EXPENSE", amount: 1500, note: "paid", confidence: 0.4 },
    });
    expenseRepository.sumByBucketForMonth.mockResolvedValue(1500);

    await useCase.execute({
      platformUserId: "123",
      textMessage: "bkt:plog1:WANTS",
    });

    expect(parseLogRepository.findById).toHaveBeenCalledWith("plog1");
    expect(aiParser.parseText).not.toHaveBeenCalled();
    expect(expenseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1500, bucket: "WANTS", parseLogId: "plog1" }),
    );
    const body = messageService.sendMessage.mock.calls[0][0].body;
    expect(body).toContain("Wants left this month");
    expect(body).toContain("13,500"); // 15000 - 1500
  });

  it("handles the plain 'status' command before AI parsing", async () => {
    await useCase.execute({ platformUserId: "123", textMessage: "status" });

    expect(aiParser.parseText).not.toHaveBeenCalled();
    expect(expenseRepository.create).not.toHaveBeenCalled();
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "This month — Day",
    );
  });

  it("undoes the last expense on the plain 'undo' command", async () => {
    expenseRepository.findLastByUserId.mockResolvedValue({
      id: "e1",
      amount: 220,
      bucket: "WANTS",
      categoryId: "c1",
      note: "lunch",
    });
    expenseRepository.sumByBucketForMonth.mockResolvedValue(0);

    await useCase.execute({ platformUserId: "123", textMessage: "undo" });

    expect(aiParser.parseText).not.toHaveBeenCalled();
    expect(expenseRepository.softDelete).toHaveBeenCalledWith("e1");
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "Removed: ₹220 Food",
    );
  });

  it("falls back to a friendly reply for non-financial messages", async () => {
    aiParser.parseText.mockResolvedValue({
      intent: "UNKNOWN",
      confidence: 0.9,
      conversational_response: "Hi! Text me a spend like \"chai 30\".",
    });

    await useCase.execute({ platformUserId: "123", textMessage: "hello" });

    expect(expenseRepository.create).not.toHaveBeenCalled();
    expect(messageService.sendMessage.mock.calls[0][0].body).toContain(
      "Text me a spend",
    );
  });
});
