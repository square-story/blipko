import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProcessIncomingMessageUseCase } from "./ProcessIncomingMessage";

describe("ProcessIncomingMessage", () => {
  let useCase: ProcessIncomingMessageUseCase;
  let mockUserRepository: any;
  let mockContactRepository: any;
  let mockTransactionRepository: any;
  let mockAiParser: any;
  let mockMessageService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRepository = {
      findByPhone: vi.fn(),
      create: vi.fn(),
    };
    mockContactRepository = {
      findByName: vi.fn(),
      create: vi.fn(),
    };
    mockTransactionRepository = {
      create: vi.fn(),
      findByContact: vi.fn(),
      getBalance: vi.fn(),
    };
    mockAiParser = {
      parseText: vi.fn(),
    };
    mockMessageService = {
      sendMessage: vi.fn(),
    };

    useCase = new ProcessIncomingMessageUseCase(
      mockAiParser,
      mockUserRepository,
      mockContactRepository,
      mockTransactionRepository,
      mockMessageService,
    );
  });

  it("should process a credit transaction correctly", async () => {
    const mockUser = { id: "user-1", phoneNumber: "1234567890" };
    const mockContact = { id: "contact-1", name: "Raju", userId: "user-1" };
    const mockParsedData = {
      intent: "CREDIT",
      amount: 500,
      name: "Raju",
      category: "Food",
      currency: "INR",
    };

    mockUserRepository.findByPhone.mockResolvedValue(mockUser);
    mockAiParser.parseText.mockResolvedValue(mockParsedData);
    mockContactRepository.findByName.mockResolvedValue(mockContact);
    mockTransactionRepository.create.mockResolvedValue({
      id: "tx-1",
      amount: 500,
    });

    await useCase.execute({
      senderPhone: "1234567890",
      textMessage: "Rajuin 500 koduthu",
    });

    expect(mockUserRepository.findByPhone).toHaveBeenCalledWith("1234567890");
    expect(mockAiParser.parseText).toHaveBeenCalledWith("Rajuin 500 koduthu");
    expect(mockContactRepository.findByName).toHaveBeenCalledWith(
      "user-1",
      "Raju",
    );
    expect(mockTransactionRepository.create).toHaveBeenCalledWith({
      amount: 500,
      intent: "CREDIT",
      description: "Food",
      userId: "user-1",
      contactId: "contact-1",
      category: "Food",
    });
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith({
      to: "1234567890",
      body: expect.stringContaining("Recorded CREDIT of 500.00 with Raju"),
    });
  });

  it("should create a new user if not found", async () => {
    const mockUser = { id: "user-1", phoneNumber: "1234567890" };
    const mockParsedData = { intent: "BALANCE", amount: 0, name: "Unknown" };

    mockUserRepository.findByPhone.mockResolvedValue(null);
    mockUserRepository.create.mockResolvedValue(mockUser);
    mockAiParser.parseText.mockResolvedValue(mockParsedData);

    await useCase.execute({
      senderPhone: "1234567890",
      textMessage: "Balance?",
    });

    expect(mockUserRepository.create).toHaveBeenCalledWith({
      phoneNumber: "1234567890",
    });
  });

  it("should create a new contact if not found", async () => {
    const mockUser = { id: "user-1", phoneNumber: "1234567890" };
    const mockContact = { id: "contact-1", name: "NewGuy", userId: "user-1" };
    const mockParsedData = {
      intent: "DEBIT",
      amount: 100,
      name: "NewGuy",
      category: "General",
      currency: "INR",
    };

    mockUserRepository.findByPhone.mockResolvedValue(mockUser);
    mockAiParser.parseText.mockResolvedValue(mockParsedData);
    mockContactRepository.findByName.mockResolvedValue(null);
    mockContactRepository.create.mockResolvedValue(mockContact);
    mockTransactionRepository.create.mockResolvedValue({
      id: "tx-2",
      amount: 100,
    });

    await useCase.execute({
      senderPhone: "1234567890",
      textMessage: "NewGuy 100 thannu",
    });

    expect(mockContactRepository.create).toHaveBeenCalledWith({
      name: "NewGuy",
      userId: "user-1",
    });
  });

  it("should handle BALANCE intent for a specific contact", async () => {
    const mockUser = { id: "user-1", phoneNumber: "1234567890" };
    const mockContact = { id: "contact-1", name: "Raju", userId: "user-1" };
    const mockParsedData = { intent: "BALANCE", amount: 0, name: "Raju" }; // Changed name to Raju

    mockUserRepository.findByPhone.mockResolvedValue(mockUser);
    mockAiParser.parseText.mockResolvedValue(mockParsedData);
    mockContactRepository.findByName.mockResolvedValue(mockContact); // Mock finding the contact
    mockTransactionRepository.findByContact.mockResolvedValue([
      { intent: "CREDIT", amount: 1500 },
      { intent: "DEBIT", amount: 500 },
    ]);

    await useCase.execute({
      senderPhone: "1234567890",
      textMessage: "Balance with Raju?",
    }); // Changed message

    expect(mockContactRepository.findByName).toHaveBeenCalledWith(
      "user-1",
      "Raju",
    ); // Verify contact lookup
    expect(mockTransactionRepository.findByContact).toHaveBeenCalledWith(
      "contact-1",
    );
    expect(mockMessageService.sendMessage).toHaveBeenCalledWith({
      to: "1234567890",
      body: expect.stringContaining(
        "Balance with Raju: 1000.00 (You are owed)",
      ),
    });
  });
});
