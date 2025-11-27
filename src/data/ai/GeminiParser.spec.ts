import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeminiParser } from "./GeminiParser";

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: mocks.generateContent,
      };
    },
    Type: {
      OBJECT: "OBJECT",
      STRING: "STRING",
      NUMBER: "NUMBER",
    },
    Schema: {},
  };
});

describe("GeminiParser", () => {
  let parser: GeminiParser;

  beforeEach(() => {
    vi.clearAllMocks();
    parser = new GeminiParser("fake-api-key", "fake-model");
  });

  it("should parse a credit transaction correctly", async () => {
    const mockResponse = {
      text: JSON.stringify({
        intent: "CREDIT",
        amount: 500,
        name: "Raju",
        category: "Food",
        currency: "INR",
      }),
    };

    mocks.generateContent.mockResolvedValue(mockResponse);

    const result = await parser.parseText("Rajuin 500 koduthu");

    expect(result).toEqual({
      intent: "CREDIT",
      amount: 500,
      name: "Raju",
      category: "Food",
      currency: "INR",
    });
    expect(mocks.generateContent).toHaveBeenCalledTimes(1);
  });

  it("should parse a debit transaction correctly", async () => {
    const mockResponse = {
      text: JSON.stringify({
        intent: "DEBIT",
        amount: 1000,
        name: "Amit",
        category: "Salary",
        currency: "INR",
      }),
    };

    mocks.generateContent.mockResolvedValue(mockResponse);

    const result = await parser.parseText("Amit 1000 thannu");

    expect(result).toEqual({
      intent: "DEBIT",
      amount: 1000,
      name: "Amit",
      category: "Salary",
      currency: "INR",
    });
  });

  it("should handle empty AI response gracefully", async () => {
    mocks.generateContent.mockResolvedValue({ text: null });

    const result = await parser.parseText("Some random text");

    expect(result).toEqual({
      intent: "BALANCE",
      amount: 0,
      name: "Unknown",
      category: "Error",
      currency: "INR",
    });
  });

  it("should handle JSON parse error gracefully", async () => {
    mocks.generateContent.mockResolvedValue({ text: "Invalid JSON" });

    const result = await parser.parseText("Some random text");

    expect(result).toEqual({
      intent: "BALANCE",
      amount: 0,
      name: "Unknown",
      category: "Error",
      currency: "INR",
    });
  });

  it("should throw error if API key is missing", () => {
    expect(() => new GeminiParser("")).toThrow(
      "GeminiParser: API Key is missing.",
    );
  });
});
