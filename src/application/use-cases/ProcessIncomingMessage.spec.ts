import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProcessIncomingMessageUseCase } from "./ProcessIncomingMessage";

describe("ProcessIncomingMessage", () => {
  let useCase: ProcessIncomingMessageUseCase;
  let mockUserRepository: any;
  let mockContactRepository: any;
  let mockTransactionRepository: any;
  let mockAiParser: any;
  let mockMessageService: any;
  let mockWalletRepository: any;
  let mockRecurringChargeRepository: any;
  let mockDueEntryRepository: any;
  let mockConversationRepository: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRepository = {
      findByTelegramId: vi.fn(),
      create: vi.fn(),
    };
    mockContactRepository = {
      findByName: vi.fn(),
      findSimilarByName: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
    };
    mockTransactionRepository = {
      create: vi.fn(),
      findByContact: vi.fn(),
      findById: vi.fn(),
      findByConfirmationId: vi.fn(),
      updateConfirmationMessageId: vi.fn(),
      findThreeTransactions: vi.fn().mockResolvedValue([]),
      getBalance: vi.fn(),
      getDailySummary: vi.fn(),
    };
    mockAiParser = {
      parseText: vi.fn(),
    };
    mockMessageService = {
      sendMessage: vi.fn().mockResolvedValue("msg-id-123"),
      sendInteractiveMessage: vi.fn(),
      sendTypingIndicator: vi.fn(),
    };
    mockWalletRepository = {
      create: vi.fn().mockResolvedValue({ id: "wallet-1", name: "Personal" }),
      findDefaultByUser: vi
        .fn()
        .mockResolvedValue({ id: "wallet-1", name: "Personal" }),
      findByName: vi.fn().mockResolvedValue(null),
      findByUserId: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      setDefault: vi.fn(),
      delete: vi.fn(),
    };
    mockRecurringChargeRepository = {
      create: vi.fn(),
      findByUserId: vi.fn().mockResolvedValue([]),
      findDueForNotification: vi.fn().mockResolvedValue([]),
      markNotified: vi.fn(),
      deactivate: vi.fn(),
    };
    mockDueEntryRepository = {
      create: vi.fn(),
      findPendingForCharge: vi.fn().mockResolvedValue([]),
      findUnnotified: vi.fn().mockResolvedValue([]),
      markNotified: vi.fn(),
      markPaid: vi.fn(),
      snooze: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
    };
    mockConversationRepository = {
      getRecent: vi.fn().mockResolvedValue([]),
      append: vi.fn().mockResolvedValue(undefined),
    };
    const mockGroupRepository = {
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
      findByInviteCode: vi.fn().mockResolvedValue(null),
      addMember: vi.fn(),
      removeMember: vi.fn(),
      findMembership: vi.fn().mockResolvedValue(null),
      findMembershipByUser: vi.fn().mockResolvedValue(null),
      findGroupContextForUser: vi.fn().mockResolvedValue(null),
      findGroupsByHead: vi.fn().mockResolvedValue([]),
      getGroupSummary: vi.fn().mockResolvedValue([]),
      regenerateInviteCode: vi.fn(),
    };

    useCase = new ProcessIncomingMessageUseCase(
      mockAiParser,
      mockUserRepository,
      mockContactRepository,
      mockTransactionRepository,
      mockMessageService,
      mockWalletRepository,
      mockRecurringChargeRepository,
      mockDueEntryRepository,
      mockGroupRepository,
      mockConversationRepository,
    );
  });

  it("should process a credit transaction correctly", async () => {
    const mockUser = { id: "user-1", telegramId: "1234567890", name: "User" };
    const mockContact = { id: "contact-1", name: "Raju", userId: "user-1" };
    const mockParsedData = {
      intent: "PAID",
      amount: 500,
      name: "Raju",
      category: "Food",
      currency: "INR",
    };

    mockUserRepository.findByTelegramId.mockResolvedValue(mockUser);
    mockAiParser.parseText.mockResolvedValue(mockParsedData);
    mockContactRepository.findSimilarByName.mockResolvedValue(mockContact);
    mockContactRepository.findByName.mockResolvedValue(mockContact);
    mockContactRepository.findById.mockResolvedValue({
      ...mockContact,
      currentBalance: 500,
    });
    mockTransactionRepository.create.mockResolvedValue({
      id: "tx-1",
      amount: 500,
      intent: "PAID",
      description: "Food",
    });
    mockTransactionRepository.findByContact.mockResolvedValue([]);

    await useCase.execute({
      platformUserId: "1234567890",
      textMessage: "Rajuin 500 koduthu",
    });

    expect(mockUserRepository.findByTelegramId).toHaveBeenCalledWith(
      "1234567890",
    );
    expect(mockAiParser.parseText).toHaveBeenCalledWith(
      "Rajuin 500 koduthu",
      null,
      [],
    );
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith({
      to: "1234567890",
      body: expect.stringContaining("Entry Added"),
    });
  });

  it("should create a new user if not found", async () => {
    const mockUser = { id: "user-1", telegramId: "1234567890", name: "User" };
    const mockParsedData = { intent: "BALANCE", amount: 0, name: "Unknown" };

    mockUserRepository.findByTelegramId.mockResolvedValue(null);
    mockUserRepository.create.mockResolvedValue(mockUser);
    mockAiParser.parseText.mockResolvedValue(mockParsedData);
    mockContactRepository.findByName.mockResolvedValue(null);
    mockContactRepository.findSimilarByName.mockResolvedValue(null);

    await useCase.execute({
      platformUserId: "1234567890",
      textMessage: "Balance?",
    });

    expect(mockUserRepository.create).toHaveBeenCalledWith({
      telegramId: "1234567890",
    });
  });

  it("should create a new contact if not found", async () => {
    const mockUser = { id: "user-1", telegramId: "1234567890", name: "User" };
    const mockContact = { id: "contact-1", name: "NewGuy", userId: "user-1" };
    const mockParsedData = {
      intent: "RECEIVED",
      amount: 100,
      name: "NewGuy",
      category: "General",
      currency: "INR",
    };

    mockUserRepository.findByTelegramId.mockResolvedValue(mockUser);
    mockAiParser.parseText.mockResolvedValue(mockParsedData);
    mockContactRepository.findSimilarByName.mockResolvedValue(null);
    mockContactRepository.findByName.mockResolvedValue(null);
    mockContactRepository.create.mockResolvedValue(mockContact);
    mockContactRepository.findById.mockResolvedValue({
      ...mockContact,
      currentBalance: 100,
    });
    mockTransactionRepository.create.mockResolvedValue({
      id: "tx-2",
      amount: 100,
      intent: "RECEIVED",
    });
    mockTransactionRepository.findByContact.mockResolvedValue([]);

    await useCase.execute({
      platformUserId: "1234567890",
      textMessage: "NewGuy 100 thannu",
    });

    expect(mockContactRepository.create).toHaveBeenCalledWith({
      name: "NewGuy",
      userId: "user-1",
    });
  });

  it("should handle BALANCE intent for a specific contact", async () => {
    const mockUser = { id: "user-1", telegramId: "1234567890", name: "User" };
    const mockContact = {
      id: "contact-1",
      name: "Raju",
      userId: "user-1",
      currentBalance: 1000,
    };
    const mockParsedData = { intent: "BALANCE", amount: 0, name: "Raju" };

    mockUserRepository.findByTelegramId.mockResolvedValue(mockUser);
    mockAiParser.parseText.mockResolvedValue(mockParsedData);
    mockContactRepository.findByName.mockResolvedValue(mockContact);
    mockTransactionRepository.findByContact.mockResolvedValue([]);
    mockTransactionRepository.findThreeTransactions.mockResolvedValue([]);

    await useCase.execute({
      platformUserId: "1234567890",
      textMessage: "Balance with Raju?",
    });

    expect(mockContactRepository.findByName).toHaveBeenCalledWith(
      "user-1",
      "Raju",
    );
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith({
      to: "1234567890",
      body: expect.stringContaining("Customer Report: Raju"),
    });
  });

  it("should handle VIEW_DAILY_SUMMARY intent", async () => {
    const mockUser = { id: "user-1", telegramId: "1234567890", name: "User" };
    const mockParsedData = { intent: "VIEW_DAILY_SUMMARY" };
    const mockSummary = {
      transactions: [
        { intent: "PAID", amount: 500, category: "Food" },
        { intent: "PAID", amount: 200, category: "Travel" },
      ],
      totalSpend: 700,
      categoryBreakdown: { Food: 500, Travel: 200 },
    };

    mockUserRepository.findByTelegramId.mockResolvedValue(mockUser);
    mockAiParser.parseText.mockResolvedValue(mockParsedData);
    mockTransactionRepository.getDailySummary.mockResolvedValue(mockSummary);

    await useCase.execute({
      platformUserId: "1234567890",
      textMessage: "Show today's spend",
    });

    expect(mockTransactionRepository.getDailySummary).toHaveBeenCalledWith(
      "user-1",
      expect.any(Date),
    );
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith({
      to: "1234567890",
      body: expect.stringContaining("Today's Summary"),
    });
  });
});
